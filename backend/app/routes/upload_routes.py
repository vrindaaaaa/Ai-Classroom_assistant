"""
upload_routes.py
===============
Handles document lifecycle: upload, list, download, delete.

Debug logging:
- Logs incoming request params
- Logs extracted text length
- Logs Gemini request/response
- Logs SQLAlchemy save
- Logs returned JSON
- Prints full traceback on every exception
- Always returns JSON errors
"""

import logging
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, DocumentChunk, Quiz, QuizResult
from app.schemas import DocumentOut, QuizOut, QuizResultCreate, QuizResultOut
from app.services.ai_service import generate_quiz_questions, generate_student_explanation, generate_chunks_and_embeddings, summarize_text
from app.services.document_extractor import DocumentExtractionError, extract_text

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = logging.getLogger("upload_routes")


class QuizGenerateBody(BaseModel):
    title: Optional[str] = None
    difficulty: str = "medium"

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BASE_DIR / "uploads"
ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx"}
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB


def get_user_upload_dir(user_id: int) -> Path:
    path = UPLOAD_ROOT / str(user_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_document_file_path(document: Document) -> Path:
    return get_user_upload_dir(document.owner_id) / f"{document.id}.{document.file_type}"


# ---------------------------------------------------------------------------
# Upload endpoint
# ---------------------------------------------------------------------------
@router.post("/upload", response_model=DocumentOut)
def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a study document (PDF / DOCX / PPTX).

    On success the response includes:
    - ``content``             – full extracted raw text
    - ``summary``             – short plain-text summary
    - ``student_explanation`` – complete AI study guide from Gemini

    On failure returns JSON: {"success": false, "error": "...", "trace": "..."}
    """
    try:
        # ------------------------------------------------------------------
        # 1. Basic validation
        # ------------------------------------------------------------------
        if not file.filename:
            raise HTTPException(status_code=400, detail="A filename is required")

        filename = Path(file.filename).name
        extension = filename.split(".")[-1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '.{extension}'. Allowed: PDF, DOCX, PPTX",
            )

        logger.info("[upload] incoming request title=%r filename=%r", title, filename)

        # Read once – file.file.read() returns bytes directly; no .decode() for PDFs
        contents = file.file.read()
        size = len(contents)

        if size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if size > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413, detail="File exceeds maximum size of 25 MB"
            )

        # ------------------------------------------------------------------
        # 2. Create initial DB record (so we have the generated ``id`` for the
        #    filename before writing the file to disk)
        # ------------------------------------------------------------------
        document = Document(
            title=title.strip() or Path(filename).stem,
            filename=filename,
            file_type=extension,
            content="",
            summary="",
            student_explanation="",
            owner_id=current_user.id,
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        logger.info("[upload] DB record created id=%s", document.id)

        # ------------------------------------------------------------------
        # 3. Persist file to disk
        # ------------------------------------------------------------------
        upload_path = get_document_file_path(document)
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        upload_path.write_bytes(contents)  # bytes – never decode for PDFs
        logger.info("[upload] file saved path=%s size=%d", upload_path, size)

        # ------------------------------------------------------------------
        # 4. Extract text
        # ------------------------------------------------------------------
        try:
            extracted_text = extract_text(upload_path)
            logger.info("[upload] text extraction succeeded length=%d", len(extracted_text))
        except DocumentExtractionError as exc:
            logger.error("[upload] text extraction failed: %s", exc, exc_info=True)
            traceback.print_exc()
            document.content = ""
            document.summary = str(exc)
            document.student_explanation = ""
            db.add(document)
            db.commit()
            db.refresh(document)
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if not extracted_text or not extracted_text.strip():
            document.content = ""
            document.summary = "Uploaded document is empty or did not contain extractable text."
            document.student_explanation = ""
            db.add(document)
            db.commit()
            db.refresh(document)
            raise HTTPException(
                status_code=422,
                detail="Uploaded document is empty or did not contain extractable text",
            )

        logger.info("[upload] extracted text length=%d", len(extracted_text))

        # ------------------------------------------------------------------
        # 5. Generate AI explanation + plain summary
        # ------------------------------------------------------------------
        student_explanation = ""
        try:
            student_explanation = generate_student_explanation(extracted_text)
        except Exception as exc:
            traceback.print_exc()
            logger.error("[upload] Gemini failed: %s", exc, exc_info=True)

        logger.info("[upload] Gemini explanation length=%d", len(student_explanation))

        # Short plain-text summary for list views / search snippets
        summary = summarize_text(extracted_text)

        # ------------------------------------------------------------------
        # 6. Persist text, summary, and explanation
        # ------------------------------------------------------------------
        document.content = extracted_text          # full text – no truncation
        document.summary = summary
        document.student_explanation = student_explanation
        db.add(document)
        db.commit()
        db.refresh(document)
        logger.info("[upload] document saved id=%s", document.id)

        # ------------------------------------------------------------------
        # 7. Generate semantic chunks and embeddings for RAG
        # ------------------------------------------------------------------
        try:
            page_count = 0
            if extension == "pdf":
                try:
                    import fitz
                    page_count = len(fitz.open(str(upload_path)))
                except Exception:
                    page_count = 0

            logger.info("[upload] Generating RAG chunks: text_len=%d page_count=%d", len(extracted_text), page_count)
            chunk_data = generate_chunks_and_embeddings(extracted_text, document.id, page_count)
            logger.info("[upload] Generated %d chunk data items", len(chunk_data))
            for i, c in enumerate(chunk_data):
                db.add(DocumentChunk(
                    document_id=c["document_id"],
                    content=c["content"],
                    chunk_index=c["chunk_index"],
                    page_number=c["page_number"],
                    embedding=c["embedding"],
                    meta_data=c["meta_data"],
                ))
                logger.info("[upload] Chunk %d: content_len=%d embedding_len=%d page=%s",
                    i, len(c["content"]), len(c["embedding"]) if c["embedding"] else 0, c["page_number"])
            db.commit()
            logger.info("[upload] saved %d RAG chunks for document_id=%d", len(chunk_data), document.id)
        except Exception as exc:
            traceback.print_exc()
            logger.error("[upload] RAG chunking failed: %s", exc, exc_info=True)

        payload = DocumentOut.model_validate(document) if hasattr(DocumentOut, "model_validate") else DocumentOut.from_orm(document)
        logger.info("[upload] returning JSON id=%s title=%r", payload.id, payload.title)
        return payload

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        logger.error("[upload] unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(exc),
                "trace": traceback.format_exc(),
            },
        )


# ---------------------------------------------------------------------------
# List documents
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[DocumentOut])
def list_documents(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Delete document
# ---------------------------------------------------------------------------
@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document or document.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = get_document_file_path(document)
    if file_path.exists():
        file_path.unlink()

    db.delete(document)
    db.commit()
    return {"detail": "Document deleted successfully"}


# ---------------------------------------------------------------------------
# Retrieve document details OR Download file
# ---------------------------------------------------------------------------
@router.get("/{document_id}", response_model=None)
def get_or_download_document(
    document_id: int,
    download: bool = False,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document or document.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    if download:
        file_path = get_document_file_path(document)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document file not available")

        return FileResponse(
            path=file_path,
            media_type="application/octet-stream",
            filename=document.filename,
        )

    # Resolve Pydantic compatibility (v1 vs v2) dynamically
    if hasattr(DocumentOut, "model_validate"):
        return DocumentOut.model_validate(document)
    return DocumentOut.from_orm(document)


@router.post("/{document_id}/explanation")
def generate_document_explanation(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info("[explanation] STEP 1: Explanation request received: document_id=%s user_id=%s", document_id, current_user.id)
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document or document.owner_id != current_user.id:
            logger.warning("[explanation] STEP 2: Document not found or unauthorized: document_id=%s user_id=%s", document_id, current_user.id)
            raise HTTPException(status_code=404, detail="Document not found")

        logger.info("[explanation] STEP 3: Document loaded from database: id=%s title=%r", document.id, document.title)
        content = document.content or ""
        logger.info("[explanation] STEP 4: Extracted text length=%d", len(content))

        if not content.strip():
            logger.warning("[explanation] Document has no extractable text: document_id=%s", document_id)
            raise HTTPException(status_code=422, detail="Document has no extractable text. Please re-upload the file.")

        from app.services.ai_service import generate_student_explanation, _classify_gemini_error
        logger.info("[explanation] STEP 5: Generating explanation for document_id=%s", document_id)
        try:
            explanation = generate_student_explanation(content)
        except RuntimeError as ai_exc:
            user_msg, reason, retry_after = _classify_gemini_error(ai_exc)
            logger.error("[explanation] STEP 8/9: Gemini failed reason=%s error=%s", reason, ai_exc, exc_info=True)
            status_code = 503 if reason in {"quota_exceeded", "service_unavailable"} else 500
            raise HTTPException(
                status_code=status_code,
                detail={
                    "message": user_msg,
                    "reason": reason,
                    "retry_after": retry_after,
                },
            ) from ai_exc

        logger.info("[explanation] STEP 10: Explanation generated length=%d", len(explanation))

        document.student_explanation = explanation
        db.add(document)
        db.commit()
        db.refresh(document)
        logger.info("[explanation] Explanation saved successfully: document_id=%s", document.id)

        return {"success": True, "explanation": explanation, "length": len(explanation)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[explanation] Unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Explanation generation failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Document-based Quiz Generation
# ---------------------------------------------------------------------------
@router.post("/{document_id}/quiz/generate", response_model=QuizOut)
def generate_document_quiz(
    document_id: int,
    body: QuizGenerateBody = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    POST /api/documents/{document_id}/quiz/generate

    Accepts optional JSON body: {"title": "...", "difficulty": "medium"}
    Returns HTTP 200 with QuizOut on success, or structured error JSON:
    {"success": false, "step": "...", "error": "...", "detail": "..."}
    """
    difficulty = (body.difficulty if body else None) or "medium"
    quiz_title = (body.title if body else None) or None

    def _step_error(step: str, exc: Exception, status: int = 500) -> JSONResponse:
        """Return a structured error response with full diagnostics."""
        tb = traceback.format_exc()
        exc_type = type(exc).__name__
        frame = sys.exc_info()[2]
        filename = lineno = func = "unknown"
        if frame:
            while frame.tb_next:
                frame = frame.tb_next
            filename = frame.tb_frame.f_code.co_filename
            lineno = frame.tb_lineno
            func = frame.tb_frame.f_code.co_name
        logger.error(
            "[QUIZ][STEP: %s] %s: %s\n  File: %s, line %d, in %s\n%s",
            step, exc_type, exc, filename, lineno, func, tb,
        )
        return JSONResponse(
            status_code=status,
            content={
                "success": False,
                "step": step,
                "error": str(exc),
                "exception": exc_type,
                "file": filename,
                "line": lineno,
                "function": func,
                "traceback": tb,
            },
        )

    # ── [1] Authentication ──────────────────────────────────────────────────
    try:
        user_id = current_user.id
        logger.info("[1] Authentication successful: user_id=%s", user_id)
    except Exception as exc:
        return _step_error("Authentication", exc, 401)

    # ── [2] Document lookup ─────────────────────────────────────────────────
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document or document.owner_id != current_user.id:
            logger.warning(
                "[2] Document not found or unauthorized: document_id=%s user_id=%s",
                document_id, user_id,
            )
            return JSONResponse(
                status_code=404,
                content={"success": False, "step": "Document Lookup", "error": "Document not found or access denied."},
            )
        logger.info("[2] Document found: id=%s title=%r owner=%s", document.id, document.title, document.owner_id)
    except Exception as exc:
        return _step_error("Document Lookup", exc)

    # Use document title as fallback
    if not quiz_title:
        quiz_title = document.title

    # ── [3] Extracted text check ────────────────────────────────────────────
    try:
        content = document.content or ""
        if not content.strip():
            logger.warning("[3] Document has no extractable text: document_id=%s", document_id)
            return JSONResponse(
                status_code=422,
                content={"success": False, "step": "Extracted Text", "error": "Document has no extractable text. Please re-upload the file."},
            )
        logger.info("[3] Extracted text loaded: %d characters", len(content))
    except Exception as exc:
        return _step_error("Extracted Text", exc)

    # ── [4] AI quiz generation ──────────────────────────────────────────────
    logger.info("[4] AI quiz generation started: difficulty=%s", difficulty)
    questions = None
    try:
        questions = generate_quiz_questions(content, difficulty)
        logger.info("[5] Gemini response received: %d questions returned", len(questions) if questions else 0)
    except Exception as exc:
        return _step_error("AI Generation", exc)

    # ── [6] JSON parsing / validation check ────────────────────────────────
    try:
        if not questions:
            raise ValueError("AI service returned zero questions after all retries. Check the Gemini API key and quota.")
        logger.info("[6] JSON parsed: %d questions", len(questions))
    except Exception as exc:
        return _step_error("JSON Parsing", exc)

    # ── [7] Question validation ─────────────────────────────────────────────
    try:
        valid_types = {"mcq", "truefalse", "shortanswer"}
        invalid = [
            i for i, q in enumerate(questions)
            if not isinstance(q, dict)
            or not q.get("question")
            or q.get("type") not in valid_types
        ]
        if invalid:
            logger.warning("[7] %d questions failed final validation (indices %s)", len(invalid), invalid)
        else:
            logger.info("[7] Quiz validation successful: all %d questions valid", len(questions))
    except Exception as exc:
        return _step_error("Question Validation", exc)

    # ── [8] Database insert ─────────────────────────────────────────────────
    try:
        quiz = Quiz(
            title=quiz_title,
            difficulty=difficulty,
            questions=questions,
            owner_id=current_user.id,
            document_id=document_id,
        )
        db.add(quiz)
        db.commit()
        db.refresh(quiz)
        logger.info(
            "[8] Quiz saved to database: quiz_id=%s title=%r questions=%d",
            quiz.id, quiz.title, len(quiz.questions),
        )
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        return _step_error("Database Insert", exc)

    # ── [9] HTTP 200 response ───────────────────────────────────────────────
    logger.info("[9] Returning HTTP 200: quiz_id=%s", quiz.id)
    return QuizOut(id=quiz.id, title=quiz.title, difficulty=quiz.difficulty, questions=quiz.questions)


@router.get("/{document_id}/quiz", response_model=QuizOut)
def get_document_quiz(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = (
        db.query(Quiz)
        .filter(Quiz.document_id == document_id, Quiz.owner_id == current_user.id)
        .order_by(Quiz.created_at.desc())
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz found for this document")
    return QuizOut(id=quiz.id, title=quiz.title, difficulty=quiz.difficulty, questions=quiz.questions)


@router.post("/{document_id}/quiz/submit")
def submit_document_quiz(
    document_id: int,
    payload: QuizResultCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    total = len(quiz.questions)
    score = payload.score
    correct = round((score / 100) * total) if total > 0 else 0

    result = QuizResult(
        user_id=current_user.id,
        quiz_id=quiz.id,
        score=float(score),
        feedback=f"Score: {score}% ({correct}/{total} correct)",
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return {
        "score": score,
        "percentage": f"{score}%",
        "correct_answers": correct,
        "wrong_answers": total - correct,
        "total_questions": total,
        "explanation": f"You got {correct} out of {total} questions correct.",
        "strong_topics": [],
        "weak_topics": [],
    }
