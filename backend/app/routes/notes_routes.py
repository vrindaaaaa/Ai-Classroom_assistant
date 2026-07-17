from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Note
from app.schemas import NoteCreate, NoteOut

router = APIRouter(prefix="/notes", tags=["Notes"])


@router.post("/", response_model=NoteOut)
def create_note(payload: NoteCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    note = Note(user_id=current_user.id, title=payload.title, body=payload.body)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/", response_model=List[NoteOut])
def list_notes(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Note).filter(Note.user_id == current_user.id).order_by(Note.created_at.desc()).all()