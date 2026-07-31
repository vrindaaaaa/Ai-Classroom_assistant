import logging
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, StudyPlan
from app.schemas import StudyPlanCreate, StudyPlanOut
from app.services.ai_service import generate_study_plan

router = APIRouter(prefix="/study-plans", tags=["Study Planner"])
logger = logging.getLogger("planner_routes")


def _plan_to_steps(plan_data: Dict[str, Any], hours_per_day: int) -> List[Dict[str, str]]:
    """Convert AI plan format to frontend-compatible steps format."""
    steps = []
    for day in plan_data.get("plan", []):
        topics = day.get("topics", [])
        focus = topics[0] if topics else day.get("notes", "Study")
        if len(topics) > 1:
            focus = f"{topics[0]} + {len(topics) - 1} more"

        steps.append({
            "day": f"Day {day.get('day', len(steps) + 1)}",
            "focus": focus,
            "hours": day.get("study_duration", f"{hours_per_day} hours"),
        })
    return steps


@router.post("/generate", response_model=StudyPlanOut)
def generate_plan(
    payload: StudyPlanCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(
        "[planner] Generate request: user_id=%s title=%r exam_date=%s hours=%d document_id=%s",
        current_user.id,
        payload.title,
        payload.exam_date,
        payload.hours_per_day,
        payload.document_id,
    )

    if not payload.title or not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        exam_dt = datetime.strptime(payload.exam_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam date format. Use YYYY-MM-DD")

    if exam_dt <= datetime.now().date():
        raise HTTPException(status_code=400, detail="Exam date must be in the future")

    if payload.hours_per_day < 1 or payload.hours_per_day > 12:
        raise HTTPException(status_code=400, detail="Study hours per day must be between 1 and 12")

    document_text = ""
    document_id = payload.document_id

    if document_id:
        document = (
            db.query(Document)
            .filter(Document.id == document_id, Document.owner_id == current_user.id)
            .first()
        )
        if document:
            document_text = document.content or ""
            logger.info("[planner] Using document: id=%s title=%s text_len=%d", document.id, document.title, len(document_text))
        else:
            logger.warning("[planner] Document not found: document_id=%s", document_id)

    try:
        plan_data = generate_study_plan(
            exam_date=payload.exam_date,
            hours_per_day=payload.hours_per_day,
            title=payload.title,
            document_text=document_text,
        )
    except Exception as exc:
        logger.error("[planner] AI generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate study plan. Please try again later.",
        ) from exc

    steps = _plan_to_steps(plan_data, payload.hours_per_day)

    plan = StudyPlan(
        user_id=current_user.id,
        document_id=document_id,
        title=payload.title,
        exam_date=payload.exam_date,
        hours_per_day=payload.hours_per_day,
        steps=steps,
        generated_plan=plan_data,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    logger.info("[planner] Plan created: id=%s steps=%d", plan.id, len(steps))
    return StudyPlanOut(
        id=plan.id,
        user_id=plan.user_id,
        document_id=plan.document_id,
        title=plan.title,
        exam_date=plan.exam_date,
        hours_per_day=plan.hours_per_day,
        steps=plan.steps,
        generated_plan=plan.generated_plan or {},
        created_at=plan.created_at,
    )


@router.get("/", response_model=List[StudyPlanOut])
def list_plans(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plans = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == current_user.id)
        .order_by(StudyPlan.created_at.desc())
        .all()
    )
    return [
        StudyPlanOut(
            id=p.id,
            user_id=p.user_id,
            document_id=p.document_id,
            title=p.title,
            exam_date=p.exam_date,
            hours_per_day=p.hours_per_day,
            steps=p.steps,
            generated_plan=p.generated_plan or {},
            created_at=p.created_at,
        )
        for p in plans
    ]


@router.get("/{planner_id}", response_model=StudyPlanOut)
def get_plan(
    planner_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.id == planner_id, StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    return StudyPlanOut(
        id=plan.id,
        user_id=plan.user_id,
        document_id=plan.document_id,
        title=plan.title,
        exam_date=plan.exam_date,
        hours_per_day=plan.hours_per_day,
        steps=plan.steps,
        generated_plan=plan.generated_plan or {},
        created_at=plan.created_at,
    )


@router.delete("/{planner_id}")
def delete_plan(
    planner_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.id == planner_id, StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    db.delete(plan)
    db.commit()
    return {"detail": "Study plan deleted successfully"}
