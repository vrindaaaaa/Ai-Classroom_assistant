from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, Quiz, QuizResult, Recommendation, StudyPlan

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
@router.get("/")
def dashboard(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    document_count = db.query(Document).filter(Document.owner_id == current_user.id).count()
    quiz_count = db.query(Quiz).filter(Quiz.owner_id == current_user.id).count()
    study_plan_count = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).count()
    recent_uploads = db.query(Document).filter(Document.owner_id == current_user.id).order_by(Document.created_at.desc()).limit(3).all()
    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).order_by(QuizResult.created_at.desc()).limit(5).all()
    recommendations = db.query(Recommendation).filter(Recommendation.user_id == current_user.id).order_by(Recommendation.created_at.desc()).limit(5).all()

    return {
        "message": f"Welcome back, {current_user.name}",
        "role": current_user.role,
        "document_count": document_count,
        "quiz_count": quiz_count,
        "study_plan_count": study_plan_count,
        "recent_uploads": [
            {"title": item.title, "file_type": item.file_type, "summary": item.summary or "No summary yet"}
            for item in recent_uploads
        ],
        "quiz_results": [{"score": item.score, "feedback": item.feedback} for item in quiz_results],
        "recommendations": [{"topic": item.topic, "reason": item.reason} for item in recommendations],
    }


@router.get("/analytics")
def analytics(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).all()
    average_score = round(sum(item.score for item in quiz_results) / len(quiz_results), 1) if quiz_results else 0
    return {
        "average_score": average_score,
        "quiz_count": len(quiz_results),
        "weak_topics": ["Concept review", "Practice questions"],
        "learning_streak": 3,
    }