import logging
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.dependencies import get_current_user
from app.routes.auth_routes import router as auth_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.notes_routes import router as notes_router
from app.routes.ocr_routes import router as ocr_router
from app.routes.planner_routes import router as planner_router
from app.routes.quiz_routes import router as quiz_router
from app.routes.rag_routes import router as rag_router
from app.routes.transcription_routes import router as transcription_router
from app.routes.upload_routes import router as upload_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_classroom")

app = FastAPI(title="AI Classroom Assistant", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
        "http://localhost:5176", "http://127.0.0.1:5176",
        "http://localhost:3000", "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(notes_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(rag_router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(planner_router, prefix="/api")
app.include_router(ocr_router, prefix="/api")
app.include_router(transcription_router, prefix="/api")


@app.on_event("startup")
def startup_event() -> None:
    logger.info("Initializing database")
    init_db()


@app.get("/")
def root():
    return {"message": "Welcome to AI Classroom Assistant 🚀"}


@app.get("/health")
def health():
    return {"status": "Running", "database": "Ready"}


@app.get("/profile")
def profile(current_user=Depends(get_current_user)):
    return {"message": "Welcome!", "user": {"id": current_user.id, "email": current_user.email, "role": current_user.role}}