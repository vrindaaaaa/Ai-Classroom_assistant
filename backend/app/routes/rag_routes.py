import logging
import traceback
from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, DocumentChunk
from app.schemas import ChatRequest, ChatResponse
from app.services.ai_service import (
    _get_embedding,
    _cosine_similarity,
    search_similar_chunks,
    _call_gemini,
    _build_model,
)

router = APIRouter(prefix="/rag", tags=["RAG"])
logger = logging.getLogger("rag_routes")

_RAG_SYSTEM_PROMPT = """You are an AI Classroom Assistant.

Answer the student's question using ONLY the retrieved document chunks provided below.

Rules:
- Use the retrieved chunks as your primary source.
- If the answer is found, explain clearly with Markdown formatting.
- Include headings, bullet points, numbered lists, tables (when useful), and bold keywords.
- Include a short summary at the end when appropriate.
- If the answer is only partially supported, clearly distinguish what comes from the document and what is general explanation.
- If the answer is not found in the retrieved chunks, reply exactly: "I couldn't find that information in the uploaded document."
- Do not hallucinate. Do not invent facts.
- Always cite the source as: "Based on the uploaded document..."
- If page numbers are available in the context, reference them.

RETRIEVED CHUNKS:
{context}

STUDENT QUESTION:
{question}
"""


def _build_rag_context(chunks: List[DocumentChunk]) -> str:
    """Build a context string from retrieved chunks."""
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        page_info = ""
        if chunk.page_number:
            page_info = f" (Page {chunk.page_number})"
        context_parts.append(f"[Chunk {i}{page_info}]\n{chunk.content}")
    return "\n\n".join(context_parts)


def _build_fallback_answer(question: str, chunks: List[DocumentChunk], document_title: str) -> str:
    """Build a fallback answer from retrieved chunks when AI is unavailable."""
    context = _build_rag_context(chunks)
    return (
        f"**Based on the uploaded document:** {document_title}\n\n"
        f"{context}\n\n"
        f"---\n\n"
        f"**Note:** AI-powered explanation is currently unavailable. "
        f"Here are the most relevant excerpts from your document that may contain the answer to: *{question}*"
    )


@router.post("/chat", response_model=ChatResponse)
def rag_chat(
    payload: ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        logger.info(
            "[RAG] Chat request: user_id=%s document_id=%s question=%s history_turns=%d",
            current_user.id,
            payload.document_id,
            payload.question[:100],
            len(payload.conversation_history or []),
        )

        document = None
        if payload.document_id:
            document = (
                db.query(Document)
                .filter(Document.id == payload.document_id, Document.owner_id == current_user.id)
                .first()
            )
            if not document:
                logger.warning("[RAG] Document not found: document_id=%s", payload.document_id)
                raise HTTPException(status_code=404, detail="Document not found")
        else:
            document = (
                db.query(Document)
                .filter(Document.owner_id == current_user.id, Document.content.isnot(None))
                .order_by(Document.created_at.desc())
                .first()
            )
            if not document:
                logger.warning("[RAG] No documents found for user_id=%s", current_user.id)
                raise HTTPException(
                    status_code=404,
                    detail="No relevant document details found in your workspace database. Please upload documents first.",
                )

        logger.info("[RAG] Using document: id=%s title=%s", document.id, document.title)

        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.chunk_index.asc())
            .all()
        )
        logger.info("[RAG] Found %d chunks for document_id=%s", len(chunks), document.id)

        if not chunks:
            logger.warning("[RAG] No chunks found for document_id=%s", document.id)
            raise HTTPException(
                status_code=422,
                detail="Document has not been processed for chat. Please try re-uploading.",
            )

        question_embedding = _get_embedding(payload.question)
        if not question_embedding:
            logger.error("[RAG] Failed to generate embedding for question")
            raise HTTPException(
                status_code=500,
                detail="Failed to process question embedding. Please try again.",
            )

        top_chunks = search_similar_chunks(question_embedding, chunks, top_k=5)

        if not top_chunks:
            return ChatResponse(
                answer="I couldn't find that information in the uploaded document.",
                sources=[document.title or document.filename],
            )

        context = _build_rag_context(top_chunks)
        sources = [document.title or document.filename]
        if top_chunks[0].page_number:
            sources.append(f"Page {top_chunks[0].page_number}")

        conversation_context = ""
        if payload.conversation_history:
            conversation_context = "PREVIOUS CONVERSATION:\n"
            for turn in payload.conversation_history[-6:]:
                role = turn.get("role", "user")
                content = turn.get("content", "")
                if role == "user":
                    conversation_context += f"Student: {content}\n"
                else:
                    conversation_context += f"Assistant: {content}\n"
            conversation_context += "\n"

        prompt = (
            _RAG_SYSTEM_PROMPT.replace("{context}", context)
            .replace("{question}", payload.question)
        )
        if conversation_context:
            prompt = prompt.replace("STUDENT QUESTION:", f"{conversation_context}\nSTUDENT QUESTION:")

        try:
            model = _build_model()
            answer = _call_gemini(model, prompt)
            return ChatResponse(answer=answer, sources=sources)
        except Exception as ai_exc:
            logger.error("[RAG] AI generation failed, returning fallback: %s", ai_exc, exc_info=True)
            fallback = _build_fallback_answer(payload.question, top_chunks, document.title or document.filename)
            return ChatResponse(answer=fallback, sources=sources)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[RAG] Chat failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {type(exc).__name__}: {exc}",
        ) from exc
