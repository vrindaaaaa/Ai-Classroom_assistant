from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, Quiz, QuizResult, User
from app.schemas import QuizResultOut
from app.dependencies import get_current_user

router = APIRouter(prefix="/quiz-history", tags=["Quiz History"])


@router.get("")
def get_quiz_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search by quiz title"),
    document_id: Optional[int] = Query(None, description="Filter by document"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    status: Optional[str] = Query(None, description="Filter by completion status"),
    sort: str = Query("newest", description="Sort order: newest or oldest"),
):
    query = db.query(QuizResult).filter(QuizResult.user_id == current_user.id)

    if search:
        query = query.join(Quiz).filter(Quiz.title.ilike(f"%{search}%"))

    if document_id:
        query = query.filter(QuizResult.document_id == document_id)

    if difficulty:
        query = query.filter(QuizResult.difficulty == difficulty)

    if status == "completed":
        query = query.filter(QuizResult.percentage >= 100.0)
    elif status == "in_progress":
        query = query.filter(QuizResult.percentage < 100.0)

    if sort == "oldest":
        query = query.order_by(QuizResult.created_at.asc())
    else:
        query = query.order_by(QuizResult.created_at.desc())

    results = query.all()
    return [
        {
            "id": r.id,
            "quiz_id": r.quiz_id,
            "quiz_title": r.quiz_title,
            "document_id": r.document_id,
            "document_title": r.quiz.title if r.quiz else "",
            "difficulty": r.difficulty,
            "score": r.score,
            "total_questions": r.total_questions,
            "percentage": r.percentage,
            "time_taken": r.time_taken,
            "feedback": r.feedback,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in results
    ]


@router.get("/{quiz_result_id}")
def get_quiz_result_detail(
    quiz_result_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = db.query(QuizResult).filter(
        QuizResult.id == quiz_result_id,
        QuizResult.user_id == current_user.id,
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Quiz result not found")

    quiz = result.quiz
    questions = quiz.questions if quiz else []

    return {
        "id": result.id,
        "quiz_id": result.quiz_id,
        "quiz_title": result.quiz_title,
        "document_id": result.document_id,
        "document_title": quiz.title if quiz else "",
        "difficulty": result.difficulty,
        "score": result.score,
        "total_questions": result.total_questions,
        "percentage": result.percentage,
        "time_taken": result.time_taken,
        "feedback": result.feedback,
        "answers": result.answers,
        "questions": questions,
        "created_at": result.created_at.isoformat() if result.created_at else None,
    }


@router.delete("/{quiz_result_id}")
def delete_quiz_result(
    quiz_result_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = db.query(QuizResult).filter(
        QuizResult.id == quiz_result_id,
        QuizResult.user_id == current_user.id,
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Quiz result not found")

    db.delete(result)
    db.commit()
    return {"success": True, "message": "Quiz result deleted"}


@router.delete("")
def delete_all_quiz_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).all()
    for result in results:
        db.delete(result)
    db.commit()
    return {"success": True, "message": f"Deleted {len(results)} quiz result(s)"}