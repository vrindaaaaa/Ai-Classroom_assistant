import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import BASE_DIR

load_dotenv(BASE_DIR / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_classroom.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_quiz_document_id(db) -> None:
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("quizzes")]
    if "document_id" not in columns:
        db.execute(
            text("ALTER TABLE quizzes ADD COLUMN document_id INTEGER REFERENCES documents(id)")
        )
        db.commit()


def _migrate_quiz_result_document_id(db) -> None:
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("quiz_results")]
    if "document_id" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN document_id INTEGER REFERENCES documents(id)")
        )
        db.commit()
    if "quiz_title" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN quiz_title VARCHAR(255) DEFAULT ''")
        )
        db.commit()
    if "difficulty" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN difficulty VARCHAR(40) DEFAULT 'medium'")
        )
        db.commit()
    if "total_questions" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN total_questions INTEGER DEFAULT 0")
        )
        db.commit()
    if "percentage" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN percentage FLOAT DEFAULT 0.0")
        )
        db.commit()
    if "time_taken" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN time_taken INTEGER DEFAULT 0")
        )
        db.commit()
    if "answers" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN answers JSON DEFAULT '{}'")
        )
        db.commit()
    if "feedback" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN feedback TEXT DEFAULT ''")
        )
        db.commit()
    if "status" not in columns:
        db.execute(
            text("ALTER TABLE quiz_results ADD COLUMN status VARCHAR(40) DEFAULT 'completed'")
        )
        db.commit()


def _migrate_document_chunks(db) -> None:
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("document_chunks")]
    if "embedding" not in columns:
        db.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding JSON DEFAULT '[]'"))
        db.commit()
    if "chunk_index" not in columns:
        db.execute(text("ALTER TABLE document_chunks ADD COLUMN chunk_index INTEGER DEFAULT 0"))
        db.commit()
    if "page_number" not in columns:
        db.execute(text("ALTER TABLE document_chunks ADD COLUMN page_number INTEGER"))
        db.commit()


def _migrate_study_plans(db) -> None:
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("study_plans")]
    if "document_id" not in columns:
        db.execute(text("ALTER TABLE study_plans ADD COLUMN document_id INTEGER REFERENCES documents(id)"))
        db.commit()
    if "generated_plan" not in columns:
        db.execute(text("ALTER TABLE study_plans ADD COLUMN generated_plan JSON DEFAULT '{}'"))
        db.commit()


def init_db() -> None:
    from app.models import (
        User,
        Document,
        DocumentChunk,
        Quiz,
        QuizResult,
        StudyPlan,
        Transcript,
        Note,
        Recommendation,
        ChatHistory,
    )

    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        _migrate_quiz_document_id(conn)
        _migrate_quiz_result_document_id(conn)
        _migrate_document_chunks(conn)
        _migrate_study_plans(conn)