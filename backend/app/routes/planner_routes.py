from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StudyPlan
from app.schemas import StudyPlanCreate, StudyPlanOut
from app.services.ai_service import generate_study_plan

router = APIRouter(prefix="/study-plans", tags=["Study Planner"])


@router.post("/generate", response_model=StudyPlanOut)
def generate_plan(payload: StudyPlanCreate, db: Session = Depends(get_db)):
    steps = generate_study_plan(payload.exam_date, payload.hours_per_day)
    plan = StudyPlan(user_id=payload.user_id, title=payload.title, exam_date=payload.exam_date, hours_per_day=payload.hours_per_day, steps=steps)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan
