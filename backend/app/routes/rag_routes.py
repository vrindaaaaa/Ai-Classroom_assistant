from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DocumentChunk
from app.schemas import ChatRequest, ChatResponse
from app.services.ai_service import summarize_text

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/chat", response_model=ChatResponse)
def rag_chat(payload: ChatRequest, db: Session = Depends(get_db)):
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.content.ilike(f"%{payload.question}%"))
        .limit(3)
        .all()
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="No relevant document chunks found")

    context = "\n".join(chunk.content for chunk in chunks)
    answer = summarize_text(context)
    sources = [chunk.meta_data.get("source", "unknown") for chunk in chunks]
    return ChatResponse(answer=answer, sources=sources)
