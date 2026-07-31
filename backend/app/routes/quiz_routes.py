import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, Quiz, QuizResult, User
from app.schemas import DocumentQuizGenerate, QuizCreate, QuizOut, QuizResultCreate, QuizResultOut
from app.services.ai_service import generate_quiz_questions
from app.dependencies import get_current_user

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])
logger = logging.getLogger("quiz_routes")


@router.get("/history")
def get_quiz_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.owner_id == current_user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    results = []
    for q in quizzes:
        latest_result = (
            db.query(QuizResult)
            .filter(QuizResult.quiz_id == q.id)
            .order_by(QuizResult.created_at.desc())
            .first()
        )
        total_q = len(q.questions or [])
        score_val = latest_result.score if latest_result else None
        percentage = latest_result.percentage if latest_result else None
        status = latest_result.status if latest_result else "new"
        results.append(
            {
                "id": q.id,
                "title": q.title,
                "difficulty": q.difficulty,
                "document_id": q.document_id,
                "document_title": q.document.title if q.document else "",
                "total_questions": total_q,
                "score": score_val,
                "percentage": percentage,
                "time_taken": latest_result.time_taken if latest_result else 0,
                "status": status,
                "created_at": q.created_at.isoformat() if q.created_at else None,
                "completed_at": latest_result.created_at.isoformat() if latest_result else None,
            }
        )
    return results


@router.get("/{quiz_id}/result")
def get_quiz_result(quiz_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.owner_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    result = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz_id, QuizResult.user_id == current_user.id)
        .order_by(QuizResult.created_at.desc())
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="No result found for this quiz")
    total = len(quiz.questions or [])
    correct = round((result.score / 100) * total) if total > 0 else 0
    return {
        "id": result.id,
        "quiz_id": result.quiz_id,
        "quiz_title": result.quiz_title,
        "difficulty": result.difficulty,
        "score": result.score,
        "percentage": result.percentage,
        "total_questions": result.total_questions or total,
        "correct_answers": correct,
        "wrong_answers": (result.total_questions or total) - correct,
        "time_taken": result.time_taken,
        "answers": result.answers,
        "feedback": result.feedback,
        "status": result.status,
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "questions": quiz.questions,
    }


@router.patch("/{quiz_id}/resume")
def resume_quiz(quiz_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.owner_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    result = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz_id, QuizResult.user_id == current_user.id)
        .order_by(QuizResult.created_at.desc())
        .first()
    )
    if result:
        result.status = "in_progress"
        db.commit()
        db.refresh(result)
    return {
        "id": quiz.id,
        "title": quiz.title,
        "difficulty": quiz.difficulty,
        "document_id": quiz.document_id,
        "document_title": quiz.document.title if quiz.document else "",
        "questions": quiz.questions,
        "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
        "resumed_result_id": result.id if result else None,
    }


@router.post("/{quiz_id}/retake")
def retake_quiz(quiz_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.owner_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    new_quiz = Quiz(
        title=quiz.title,
        difficulty=quiz.difficulty,
        questions=quiz.questions,
        owner_id=current_user.id,
        document_id=quiz.document_id,
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    result = QuizResult(
        user_id=current_user.id,
        quiz_id=new_quiz.id,
        document_id=new_quiz.document_id,
        quiz_title=new_quiz.title,
        difficulty=new_quiz.difficulty,
        score=0.0,
        total_questions=len(new_quiz.questions or []),
        percentage=0.0,
        time_taken=0,
        answers={},
        feedback="",
        status="in_progress",
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return {
        "id": new_quiz.id,
        "title": new_quiz.title,
        "difficulty": new_quiz.difficulty,
        "document_id": new_quiz.document_id,
        "document_title": new_quiz.document.title if new_quiz.document else "",
        "questions": new_quiz.questions,
        "created_at": new_quiz.created_at.isoformat() if new_quiz.created_at else None,
        "result_id": result.id,
    }


@router.delete("/history")
def clear_quiz_history(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).all()
    for result in results:
        db.delete(result)
    db.commit()
    return {"success": True, "message": f"Deleted {len(results)} quiz result(s)"}


@router.get("/{quiz_id}")
def get_quiz(quiz_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.owner_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {
        "id": quiz.id,
        "title": quiz.title,
        "difficulty": quiz.difficulty,
        "document_id": quiz.document_id,
        "document_title": quiz.document.title if quiz.document else "",
        "questions": quiz.questions,
        "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
    }


@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.owner_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()
    return {"success": True, "message": "Quiz deleted"}


@router.get("/documents/{document_id}/quizzes")
def get_document_quiz_history(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.document_id == document_id, Quiz.owner_id == current_user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    results = []
    for q in quizzes:
        latest_result = (
            db.query(QuizResult)
            .filter(QuizResult.quiz_id == q.id)
            .order_by(QuizResult.created_at.desc())
            .first()
        )
        total_q = len(q.questions or [])
        score_val = latest_result.score if latest_result else None
        percentage = None
        if score_val is not None and total_q > 0:
            correct = round((score_val / 100) * total_q)
            percentage = {
                "score": score_val,
                "total_questions": total_q,
                "correct_answers": correct,
                "wrong_answers": total_q - correct,
                "percentage": score_val,
            }
        results.append(
            {
                "id": q.id,
                "title": q.title,
                "difficulty": q.difficulty,
                "score": score_val,
                "percentage": percentage,
                "feedback": latest_result.feedback if latest_result else "",
                "created_at": q.created_at.isoformat() if q.created_at else None,
            }
        )
    return results


@router.post("/generate", response_model=List[QuizOut])
def generate_quizzes(payload: QuizCreate, db: Session = Depends(get_db)):
    logger.info("[quiz] POST /generate payload: title=%r difficulty=%s material_len=%d", payload.title, payload.difficulty, len(payload.material or ""))
    try:
        questions = generate_quiz_questions(payload.material, payload.difficulty, title=payload.title or "")
    except RuntimeError as ai_exc:
        from app.services.ai_service import _classify_gemini_error
        user_msg, reason, retry_after = _classify_gemini_error(ai_exc)
        status_code = 503 if reason in {"quota_exceeded", "service_unavailable"} else 500
        logger.error("[quiz] /generate AI error: reason=%s error=%s", reason, ai_exc, exc_info=True)
        raise HTTPException(
            status_code=status_code,
            detail={
                "message": user_msg,
                "reason": reason,
                "retry_after": retry_after,
            },
        ) from ai_exc
    safe_title = payload.title or "Untitled Quiz"
    quiz = Quiz(title=safe_title, difficulty=payload.difficulty, questions=questions)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    logger.info("[quiz] /generate saved quiz_id=%s title=%s questions=%d", quiz.id, quiz.title, len(quiz.questions))
    return [QuizOut(id=quiz.id, title=quiz.title, difficulty=quiz.difficulty, questions=quiz.questions)]

@router.post("/documents/{document_id}/quiz/generate", response_model=QuizOut)
def generate_document_quiz(
    document_id: int,
    payload: DocumentQuizGenerate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(
        "Quiz generation started: document_id=%s user_id=%s difficulty=%s title=%s",
        document_id, current_user.id, payload.difficulty, payload.title,
    )
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            logger.warning("Quiz generation failed: document not found: document_id=%s", document_id)
            raise HTTPException(status_code=404, detail="Document not found")
        if not document.content or not document.content.strip():
            logger.warning("Quiz generation failed: document has no extractable text: document_id=%s", document_id)
            raise HTTPException(status_code=422, detail="Document has no extractable text")

        content = document.content or ""
        logger.info(
            "Document found: title=%s content_length=%d chars",
            document.title, len(content),
        )

        from app.services.ai_service import generate_quiz_questions, _classify_gemini_error
        try:
            questions = generate_quiz_questions(content, payload.difficulty, title=payload.title or document.title or "")
        except RuntimeError as ai_exc:
            user_msg, reason, retry_after = _classify_gemini_error(ai_exc)
            logger.error(
                "Quiz generation AI service error: reason=%s retry_after=%s error=%s",
                reason, retry_after, ai_exc,
            )
            status_code = 503 if reason in {"quota_exceeded", "service_unavailable"} else 500
            raise HTTPException(
                status_code=status_code,
                detail={
                    "message": user_msg,
                    "reason": reason,
                    "retry_after": retry_after,
                },
            ) from ai_exc

        logger.info("AI service returned %d questions", len(questions) if questions else 0)

        if not questions:
            logger.error("Quiz generation failed: AI service returned no questions")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate quiz questions. Please try again.",
            )

        logger.info("Saving quiz to database...")
        safe_title = payload.title or document.title or "Untitled Quiz"
        quiz = Quiz(
            title=safe_title,
            difficulty=payload.difficulty,
            questions=questions,
            owner_id=current_user.id,
            document_id=document_id,
        )
        db.add(quiz)
        db.commit()
        db.refresh(quiz)
        
        in_progress = QuizResult(
            user_id=current_user.id,
            quiz_id=quiz.id,
            document_id=document_id,
            quiz_title=quiz.title,
            difficulty=quiz.difficulty,
            score=0.0,
            total_questions=len(quiz.questions or []),
            percentage=0.0,
            time_taken=0,
            answers={},
            feedback="",
            status="in_progress",
        )
        db.add(in_progress)
        db.commit()
        
        logger.info("Quiz saved successfully: quiz_id=%s title=%s questions=%d", quiz.id, quiz.title, len(quiz.questions))

        return QuizOut(id=quiz.id, title=quiz.title, difficulty=quiz.difficulty, questions=quiz.questions)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Quiz generation failed with unexpected error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {exc}",
        ) from exc


@router.post("/documents/{document_id}/quiz/submit")
def submit_document_quiz(
    document_id: int,
    payload: QuizResultCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id, Quiz.owner_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    total = len(quiz.questions)
    score = payload.score
    correct = round((score / 100) * total) if total > 0 else 0
    percentage = score

    existing = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz.id, QuizResult.user_id == current_user.id, QuizResult.status == "in_progress")
        .order_by(QuizResult.created_at.desc())
        .first()
    )
    if existing:
        existing.score = float(score)
        existing.total_questions = total
        existing.percentage = percentage
        existing.time_taken = payload.time_taken
        existing.answers = payload.selected_answers or {}
        existing.feedback = f"Score: {score}% ({correct}/{total} correct)"
        existing.status = "completed"
        db.commit()
        db.refresh(existing)
        result = existing
    else:
        result = QuizResult(
            user_id=current_user.id,
            quiz_id=quiz.id,
            document_id=quiz.document_id,
            quiz_title=quiz.title,
            difficulty=quiz.difficulty,
            score=float(score),
            total_questions=total,
            percentage=percentage,
            time_taken=payload.time_taken,
            answers=payload.selected_answers or {},
            feedback=f"Score: {score}% ({correct}/{total} correct)",
            status="completed",
        )
        db.add(result)
        db.commit()
        db.refresh(result)

    strong_topics: List[str] = []
    weak_topics: List[str] = []
    if total > 0:
        type_scores: dict = {}
        for q in quiz.questions:
            qtype = q.get("type", "mcq")
            if qtype not in type_scores:
                type_scores[qtype] = {"correct": 0, "total": 0}
            type_scores[qtype]["total"] += 1

        selected_answers = payload.selected_answers or {}
        for idx, q in enumerate(quiz.questions):
            qtype = q.get("type", "mcq")
            correct_answer = q.get("correct_answer", "")
            user_answer = selected_answers.get(str(idx), "")
            if user_answer == correct_answer:
                type_scores[qtype]["correct"] += 1

        for qtype, stats in type_scores.items():
            if stats["total"] > 0:
                pct = (stats["correct"] / stats["total"]) * 100
                label = {"mcq": "Multiple Choice", "truefalse": "True/False", "shortanswer": "Short Answer"}.get(qtype, qtype)
                if pct >= 70:
                    strong_topics.append(f"{label} ({pct:.0f}%)")
                elif pct <= 40:
                    weak_topics.append(f"{label} ({pct:.0f}%)")

    return {
        "score": score,
        "percentage": f"{score}%",
        "correct_answers": correct,
        "wrong_answers": total - correct,
        "total_questions": total,
        "explanation": f"You got {correct} out of {total} questions correct.",
        "strong_topics": strong_topics,
        "weak_topics": weak_topics,
    }


@router.post("/results", response_model=QuizResultOut)
def save_quiz_result(payload: QuizResultCreate, db: Session = Depends(get_db)):
    result = QuizResult(user_id=payload.user_id, quiz_id=payload.quiz_id, score=payload.score, feedback=payload.feedback)
    db.add(result)
    db.commit()
    db.refresh(result)
    return result
