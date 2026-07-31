from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from pydantic import BaseModel, ConfigDict, EmailStr
except ImportError:  # pragma: no cover
    from pydantic import BaseModel, EmailStr

    class ConfigDict(dict):  # type: ignore
        pass


class BaseSchema(BaseModel):
    if "ConfigDict" in globals():
        model_config = ConfigDict(from_attributes=True)
    else:  # pragma: no cover
        class Config:
            orm_mode = True


class UserRegister(BaseSchema):
    name: str
    email: EmailStr
    password: str
    role: str = "student"


class UserLogin(BaseSchema):
    email: EmailStr
    password: str


class Token(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    role: str


class DocumentCreate(BaseSchema):
    title: str
    filename: str
    file_type: str
    content: str
    summary: Optional[str] = None
    student_explanation: Optional[str] = None


class DocumentOut(DocumentCreate):
    id: int
    owner_id: int
    created_at: datetime
    extracted_text: Optional[str] = None


class DocumentChunkOut(BaseSchema):
    id: int
    document_id: int
    content: str
    meta_data: Dict[str, Any]


class QuizCreate(BaseSchema):
    title: str
    difficulty: str = "medium"
    material: str


class DocumentQuizGenerate(BaseSchema):
    title: str
    difficulty: str = "medium"


class QuizOut(BaseSchema):
    id: int
    title: str
    difficulty: str
    questions: List[Dict[str, Any]]


class QuizResultCreate(BaseSchema):
    user_id: int
    quiz_id: int
    score: float
    feedback: str = ""
    selected_answers: Dict[str, str] = {}
    time_taken: int = 0
    document_id: int | None = None
    quiz_title: str = ""
    difficulty: str = "medium"


class QuizResultOut(BaseSchema):
    id: int
    user_id: int
    quiz_id: int
    document_id: int | None = None
    quiz_title: str = ""
    difficulty: str = "medium"
    score: float
    total_questions: int = 0
    percentage: float = 0.0
    time_taken: int = 0
    answers: Dict[str, str] = {}
    feedback: str = ""
    created_at: datetime


class StudyPlanCreate(BaseSchema):
    user_id: int | None = None
    title: str
    exam_date: str
    hours_per_day: int
    document_id: int | None = None


class StudyPlanOut(BaseSchema):
    id: int
    user_id: int
    document_id: int | None = None
    title: str
    exam_date: str
    hours_per_day: int
    steps: List[Dict[str, Any]]
    generated_plan: Dict[str, Any]
    created_at: datetime


class NoteCreate(BaseSchema):
    title: str
    body: str


class NoteOut(NoteCreate):
    id: int
    user_id: int
    created_at: datetime


class ChatRequest(BaseSchema):
    question: str
    document_id: int | None = None
    conversation_history: List[Dict[str, str]] = []


class ChatResponse(BaseSchema):
    answer: str
    sources: List[str]


class TranscriptCreate(BaseSchema):
    title: str
    content: str
    summary: Optional[str] = None


class TranscriptOut(TranscriptCreate):
    id: int
    user_id: int
    created_at: datetime