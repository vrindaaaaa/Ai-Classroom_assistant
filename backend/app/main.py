import logging
import os
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.dependencies import get_current_user
from app.routes.auth_routes import router as auth_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.notes_routes import router as notes_router
from app.routes.planner_routes import router as planner_router
from app.routes.quiz_routes import router as quiz_router
from app.routes.quiz_history import router as quiz_history_router
from app.routes.rag_routes import router as rag_router
from app.routes.transcription_routes import router as transcription_router
from app.routes.upload_routes import router as upload_router
from fastapi import HTTPException

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
        "http://localhost:3000", "http://127.0.0.1:3000",
        "https://ai-classroom-assistant-gamma.vercel.app",
    "https://ai-classroom-assistant-iv9r42jmh-vrinda5.vercel.app"
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
app.include_router(quiz_history_router, prefix="/api")
app.include_router(planner_router, prefix="/api")
app.include_router(transcription_router, prefix="/api")


@app.on_event("startup")
def startup_event() -> None:
    logger.info("Initializing database")
    init_db()

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or "REPLACE_WITH_YOUR_ACTUAL" in api_key:
        logger.warning(
            "GEMINI_API_KEY is missing or still set to the placeholder value. "
            "AI explanations will fail until a valid key is added to backend/.env."
        )
    else:
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-flash-latest")
            model.generate_content("Say 'OK' only.", safety_settings={
                genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: genai.types.HarmBlockThreshold.BLOCK_NONE,
                genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            })
            logger.info("Gemini API key validated successfully.")
        except Exception as exc:
            logger.error("Gemini API key validation failed: %s", exc)


@app.get("/")
def root():
    return {"message": "Welcome to AI Classroom Assistant 🚀"}


@app.get("/health")
def health():
    return {"status": "Running", "database": "Ready"}


@app.get("/profile")
def profile(current_user=Depends(get_current_user)):
    return {"message": "Welcome!", "user": {"id": current_user.id, "email": current_user.email, "role": current_user.role}}


@app.get("/api/gemini/health")
def gemini_health():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or "REPLACE_WITH_YOUR_ACTUAL" in api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is missing or still set to the placeholder value.",
        )
    try:
        import google.generativeai as genai  # type: ignore
        from google.generativeai.types import HarmCategory, HarmBlockThreshold  # type: ignore
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            generation_config={"temperature": 0.7, "max_output_tokens": 64},
        )
        response = model.generate_content(
            "Say 'OK' only.",
            safety_settings={
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            },
        )
        text = (response.text or "").strip()
        if not text:
            raise RuntimeError("Gemini returned an empty response.")
        return {"status": "ok", "model": "gemini-1.5-flash", "response": text}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini connection failed: {exc}",
        ) from exc