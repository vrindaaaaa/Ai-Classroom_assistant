from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Quiz, QuizResult
from app.schemas import QuizCreate, QuizOut, QuizResultCreate, QuizResultOut
from app.services.ai_service import generate_quiz_questions

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


@router.post("/generate", response_model=List[QuizOut])
def generate_quizzes(payload: QuizCreate, db: Session = Depends(get_db)):
    questions = generate_quiz_questions(payload.material, payload.difficulty)
    quiz = Quiz(title=payload.title, difficulty=payload.difficulty, questions=questions)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return [QuizOut(id=quiz.id, title=quiz.title, difficulty=quiz.difficulty, questions=quiz.questions)]


@router.post("/results", response_model=QuizResultOut)
def save_quiz_result(payload: QuizResultCreate, db: Session = Depends(get_db)):
    result = QuizResult(user_id=payload.user_id, quiz_id=payload.quiz_id, score=payload.score, feedback=payload.feedback)
    db.add(result)
    db.commit()
    db.refresh(result)
    return result
