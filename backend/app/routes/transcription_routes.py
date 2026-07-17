from fastapi import APIRouter, HTTPException, UploadFile, File
from app.services.ai_service import summarize_text

router = APIRouter(prefix="/transcribe", tags=["Transcription"])


@router.post("/audio")
def transcribe_audio(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required")
    content = file.file.read().decode("utf-8", errors="ignore")
    return {"transcript": content[:2000], "summary": summarize_text(content)}
