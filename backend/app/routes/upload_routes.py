"""
upload_routes.py
================
Handles document lifecycle: upload, list, download, delete.

What changed in this version
-----------------------------
* After extracting text the route calls ``generate_student_explanation()``
  from ai_service, which now sends the COMPLETE text to Gemini (no 8 000-char
  cap) and uses a chunk-and-merge strategy for very large documents.
* ``document.content`` stores the FULL extracted text — the previous 10 000-char
  cap has been removed.  SQLite TEXT columns are unbounded.
* The response includes ``content`` (full raw text) and ``student_explanation``
  (complete AI study guide).

All authentication and upload logic is unchanged.
"""

from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, DocumentChunk
from app.schemas import DocumentOut
from app.services.ai_service import generate_student_explanation, summarize_text
from app.services.document_extractor import DocumentExtractionError, extract_text

router = APIRouter(prefix="/documents", tags=["Documents"])

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
    - ``content``             – up to 10 000 chars of extracted raw text
    - ``summary``             – short plain-text summary
    - ``student_explanation`` – detailed AI explanation (Gemini-powered when
                                GEMINI_API_KEY is set, otherwise a fallback)
    """
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

    # ------------------------------------------------------------------
    # 3. Persist file to disk
    # ------------------------------------------------------------------
    upload_path = get_document_file_path(document)
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(contents)  # bytes – never decode for PDFs

    # ------------------------------------------------------------------
    # 4. Extract text
    # ------------------------------------------------------------------
    try:
        extracted_text = extract_text(upload_path)
    except DocumentExtractionError as exc:
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

    # ------------------------------------------------------------------
    # 5. Generate AI explanation + plain summary
    # ------------------------------------------------------------------
    # Generate a student-friendly explanation via Gemini (or fallback if
    # GEMINI_API_KEY is not configured).
    student_explanation = generate_student_explanation(extracted_text)

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

    # ------------------------------------------------------------------
    # 7. Store a searchable chunk for RAG / Q&A
    # ------------------------------------------------------------------
    chunk = DocumentChunk(
        document_id=document.id,
        content=extracted_text[:2000],
        meta_data={"source": filename},
    )
    db.add(chunk)
    db.commit()

    return document


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
