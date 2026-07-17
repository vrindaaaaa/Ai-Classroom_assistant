from pathlib import Path

import pytest
from docx import Document as DocxDocument

from app.services.document_extractor import DocumentExtractionError, extract_text


def test_extract_text_from_docx(tmp_path: Path):
    file_path = tmp_path / "sample.docx"
    doc = DocxDocument()
    doc.add_paragraph("Hello from the document extractor")
    doc.save(file_path)

    extracted = extract_text(file_path)

    assert "Hello from the document extractor" in extracted


def test_extract_text_raises_for_unsupported_extension(tmp_path: Path):
    file_path = tmp_path / "sample.txt"
    file_path.write_text("not supported", encoding="utf-8")

    with pytest.raises(DocumentExtractionError):
        extract_text(file_path)
