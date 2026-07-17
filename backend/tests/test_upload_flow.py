from io import BytesIO
from pathlib import Path

from docx import Document as DocxDocument
from fastapi import UploadFile

from app.database import Base, SessionLocal, engine
from app.models import User, Document
from app.routes.upload_routes import upload_document


def test_upload_document_extracts_text_and_saves_summary(tmp_path: Path):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    # Clean up existing test user to avoid UNIQUE constraint conflicts
    existing_user = db.query(User).filter(User.email == "flow@example.com").first()
    if existing_user:
        # Delete dependent documents first
        db.query(Document).filter(Document.owner_id == existing_user.id).delete()
        db.delete(existing_user)
        db.commit()

    user = User(name="Test User", email="flow@example.com", password_hash="hash", role="student")
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        doc_path = tmp_path / "sample.docx"
        document = DocxDocument()
        document.add_paragraph("This is the uploaded document body")
        document.save(doc_path)

        with doc_path.open("rb") as handle:
            upload_file = UploadFile(filename="sample.docx", file=BytesIO(handle.read()))
            uploaded = upload_document(
                title="Flow Test",
                file=upload_file,
                current_user=user,
                db=db,
            )

        assert uploaded.content is not None
        assert "This is the uploaded document body" in uploaded.content
        assert uploaded.summary
        assert uploaded.filename == "sample.docx"
    finally:
        db.close()
