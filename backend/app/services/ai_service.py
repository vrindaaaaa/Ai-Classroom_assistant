"""
ai_service.py
=============
Central AI service for the AI Classroom Assistant.

generate_student_explanation(text)
----------------------------------
Sends the COMPLETE extracted text to Gemini 1.5 Flash and returns a richly
formatted Markdown study guide using the exact 8-section structure below.

For documents longer than _CHUNK_CHARS the text is split at paragraph
boundaries, each chunk is explained separately, then a final merge call
stitches everything into one coherent guide.

Section structure (emojis and all):

    # 📘 Document Overview
    # 🎯 Purpose of the Document
    # 📖 Complete Explanation
    # 🧠 Important Concepts
    # 📋 Key Points
    # 💡 Real Life Example
    # 🎓 Student Notes
    # 📝 Exam Questions
    # 📚 Final Summary

Output is pure Markdown — headings, paragraphs, bullets, numbered lists,
tables and code blocks where appropriate. Never plain text, never JSON,
never HTML.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini SDK import
# ---------------------------------------------------------------------------
try:
    import google.generativeai as genai                          # type: ignore
    from google.generativeai.types import HarmCategory, HarmBlockThreshold  # type: ignore
    _GENAI_AVAILABLE = True
except ImportError:
    genai = None                                                  # type: ignore
    HarmCategory = None                                           # type: ignore
    HarmBlockThreshold = None                                     # type: ignore
    _GENAI_AVAILABLE = False

# ---------------------------------------------------------------------------
# Chunking — Gemini 1.5 Flash has a 1 M-token window (~3 M chars).
# We stay well under it with 80 000-char chunks so each prompt has room.
# ---------------------------------------------------------------------------
_CHUNK_CHARS = 80_000

# ---------------------------------------------------------------------------
# Safety settings — set to BLOCK_NONE so educational content is never refused
# ---------------------------------------------------------------------------
def _safety_settings():
    if HarmCategory is None or HarmBlockThreshold is None:
        return None
    return {
        HarmCategory.HARM_CATEGORY_HARASSMENT:        HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH:       HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }

# ---------------------------------------------------------------------------
# Generation config — ask for long, detailed Markdown output
# ---------------------------------------------------------------------------
_GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
}

# ---------------------------------------------------------------------------
# MAIN PROMPT — single document or single chunk
# ---------------------------------------------------------------------------
_MAIN_PROMPT = """You are an expert university professor and study coach who explains documents to college students.

A student has uploaded a study document. Your task is to produce a COMPLETE, DETAILED, BEAUTIFULLY FORMATTED study guide in Markdown.

**STRICT OUTPUT RULES:**
- Output ONLY pure Markdown. Never output JSON, HTML, or plain text.
- Use the EXACT section headings listed below (including emojis).
- Each section must be separated by a blank line and a horizontal rule (---).
- Write at least 1000–3000 words total depending on document size.
- Use multiple paragraphs. Leave a blank line between every paragraph.
- NEVER write everything in one big paragraph.
- Use simple English. When a concept is technical, explain it step by step.
- Use ## sub-headings, bullet lists (•), numbered lists and **bold text** freely.
- Use Markdown tables when comparisons help.
- Cover EVERY topic in the document. Do not skip anything.

---

**REQUIRED SECTIONS (output them in this exact order):**

# 📘 Document Overview

Write 3–5 sentences introducing what this document is about.

---

# 🎯 Purpose of the Document

Explain clearly why this document exists, what problem it solves, and who it is for.

---

# 📖 Complete Explanation

Explain EVERY topic from the document in order.

- Write multiple paragraphs.
- Leave a blank line between paragraphs.
- Use ## sub-headings for each major topic.
- Never write everything in one paragraph.

---

# 🧠 Important Concepts

For each important concept in the document, create a sub-heading (##) and explain it clearly.

Example format:

## Concept Name

Explanation of the concept in simple English.

---

# 📋 Key Points

List the most important facts as bullet points:

• Point 1
• Point 2
• Point 3

---

# 💡 Real Life Example

Give 2–3 concrete, easy-to-understand real-life examples that relate to the document's topics.

---

# 🎓 Student Notes

Write concise revision notes — the most important things to remember for exams, viva, or interviews.

---

# 📝 Exam Questions

Generate exactly 10 exam or viva questions based on this document. For each question write a clear, detailed answer.

Format:

**Q1. Question text?**

Answer text here.

**Q2. Question text?**

Answer text here.

---

# 📚 Final Summary

Summarize the entire document in 8–10 bullet points covering all the key topics.

---

Now produce the complete study guide for the following document text. Do NOT skip any section.

DOCUMENT TEXT:
{text}
"""

# ---------------------------------------------------------------------------
# CHUNK PROMPT — for one piece of a large document
# ---------------------------------------------------------------------------
_CHUNK_PROMPT = """You are an expert professor. You are reading Part {part} of {total} of a large study document.

Explain THIS PORTION completely in pure Markdown.

Rules:
- Use ## sub-headings for each topic in this portion.
- Write multiple paragraphs separated by blank lines.
- Use bullet points and numbered lists freely.
- Use **bold** for key terms.
- Cover every sentence — do NOT skip anything.
- Output only Markdown.

DOCUMENT PORTION {part} of {total}:
{text}
"""

# ---------------------------------------------------------------------------
# MERGE PROMPT — combines all chunk explanations into the final 9-section guide
# ---------------------------------------------------------------------------
_MERGE_PROMPT = """You are an expert professor. A student's document was too large to explain in one pass, so it was explained in {n} parts below.

Merge all {n} partial explanations into a single, coherent Markdown study guide.

Use EXACTLY these section headings (in this order):

# 📘 Document Overview
# 🎯 Purpose of the Document
# 📖 Complete Explanation
# 🧠 Important Concepts
# 📋 Key Points
# 💡 Real Life Example
# 🎓 Student Notes
# 📝 Exam Questions
# 📚 Final Summary

Rules:
- Combine and de-duplicate content from all parts.
- Preserve ALL details — do not summarize away important information.
- Write multiple paragraphs per section separated by blank lines.
- Use ## sub-headings inside "Complete Explanation" and "Important Concepts".
- Generate exactly 10 exam questions in "Exam Questions".
- Output ONLY pure Markdown.

PARTIAL EXPLANATIONS:
{parts_text}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _split_into_chunks(text: str, chunk_size: int = _CHUNK_CHARS) -> List[str]:
    """Split text at paragraph/line/space boundaries — never mid-word."""
    if len(text) <= chunk_size:
        return [text]

    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:])
            break

        # Prefer paragraph boundary, then line, then space
        for sep in ("\n\n", "\n", " "):
            pos = text.rfind(sep, start, end)
            if pos > start:
                end = pos
                break

        chunks.append(text[start:end].strip())
        start = end

    return [c for c in chunks if c.strip()]


def _build_model():
    """Create and return a configured GenerativeModel instance."""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY", "").strip())
    return genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=_GENERATION_CONFIG,
    )


def _call_gemini(model, prompt: str) -> str:
    """Make one Gemini API call, honouring safety settings."""
    safety = _safety_settings()
    if safety:
        response = model.generate_content(prompt, safety_settings=safety)
    else:
        response = model.generate_content(prompt)
    return (response.text or "").strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def generate_student_explanation(text: str) -> str:
    """Return a complete Markdown study guide for the given document text.

    • Small documents  → single Gemini call with the full 9-section prompt.
    • Large documents  → chunk → partial explanations → merge into final guide.
    • No API key / SDK → graceful fallback (plain preview + notice).
    """
    if not text or not text.strip():
        return "No content found in the document to explain."

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        logger.warning(
            "GEMINI_API_KEY is not set — returning fallback explanation. "
            "Add GEMINI_API_KEY to backend/.env to enable AI explanations."
        )
        return _fallback_explanation(text)

    if not _GENAI_AVAILABLE:
        logger.warning("google-generativeai not installed. Run: pip install google-generativeai")
        return _fallback_explanation(text)

    try:
        model = _build_model()
        chunks = _split_into_chunks(text)
        logger.info(
            "generate_student_explanation: %d chars → %d chunk(s)",
            len(text), len(chunks),
        )

        # ── Single chunk (most documents) ───────────────────────────────────
        if len(chunks) == 1:
            prompt = _MAIN_PROMPT.format(text=chunks[0])
            result = _call_gemini(model, prompt)
            if not result:
                logger.warning("Gemini returned empty response — using fallback.")
                return _fallback_explanation(text)
            logger.info("Explanation generated successfully (%d chars)", len(result))
            return result

        # ── Multi-chunk path ─────────────────────────────────────────────────
        total = len(chunks)
        partial_explanations: List[str] = []

        for i, chunk in enumerate(chunks, start=1):
            logger.info("Explaining chunk %d / %d …", i, total)
            chunk_prompt = _CHUNK_PROMPT.format(part=i, total=total, text=chunk)
            partial = _call_gemini(model, chunk_prompt)
            if partial:
                partial_explanations.append(f"## Part {i} of {total}\n\n{partial}")

        if not partial_explanations:
            logger.warning("All chunk calls returned empty — using fallback.")
            return _fallback_explanation(text)

        # Merge all partials into the canonical 9-section guide
        parts_text = "\n\n---\n\n".join(partial_explanations)
        merge_prompt = _MERGE_PROMPT.format(n=total, parts_text=parts_text)
        final = _call_gemini(model, merge_prompt)

        if not final:
            logger.warning("Merge call returned empty — concatenating parts.")
            return "\n\n---\n\n".join(partial_explanations)

        logger.info("Merged explanation generated (%d chars)", len(final))
        return final

    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc, exc_info=True)
        return (
            f"> ⚠️ **AI explanation could not be generated** "
            f"(`{type(exc).__name__}: {exc}`).\n\n"
            f"Below is a short preview of the document:\n\n"
            + summarize_text(text, max_length=1000)
        )


# ---------------------------------------------------------------------------
# Fallback (no API key)
# ---------------------------------------------------------------------------
def _fallback_explanation(text: str) -> str:
    preview = summarize_text(text, max_length=1000)
    return (
        "# 📘 Document Overview\n\n"
        + preview
        + "\n\n---\n\n"
        "> 🔑 **Full AI explanation unavailable.**\n>"
        "\n> Add `GEMINI_API_KEY` to `backend/.env` to enable "
        "complete, student-friendly study guides."
    )


# ---------------------------------------------------------------------------
# summarize_text (backward-compat helper)
# ---------------------------------------------------------------------------
def summarize_text(text: str, max_length: int = 220) -> str:
    """Return a short plain-text preview of *text*."""
    if not text:
        return "No content available to summarize."
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_length:
        return cleaned
    return cleaned[:max_length].rstrip() + "..."


# ---------------------------------------------------------------------------
# generate_quiz_questions
# ---------------------------------------------------------------------------
def generate_quiz_questions(
    text: str, difficulty: str = "medium"
) -> List[Dict[str, Any]]:
    """Generate simple MCQs from text (deterministic fallback)."""
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    questions: List[Dict[str, Any]] = []
    for idx, sentence in enumerate(sentences[:4], start=1):
        topic = sentence[:60]
        questions.append(
            {
                "id": idx,
                "question": f"What is the main idea of: {topic}?",
                "choices": [
                    "A core concept from the material",
                    "An unrelated topic",
                    "A random example",
                    "A marketing slogan",
                ],
                "answer": "A core concept from the material",
                "difficulty": difficulty,
            }
        )
    return questions


# ---------------------------------------------------------------------------
# generate_study_plan
# ---------------------------------------------------------------------------
def generate_study_plan(
    exam_date: str, hours_per_day: int
) -> List[Dict[str, str]]:
    return [
        {"day": "Day 1", "focus": "Review core concepts and gather all notes",   "hours": f"{hours_per_day}h"},
        {"day": "Day 2", "focus": "Practice quizzes and identify weak topics",   "hours": f"{hours_per_day}h"},
        {"day": "Day 3", "focus": "Revise with summaries and flashcards",        "hours": f"{hours_per_day}h"},
    ]


# ---------------------------------------------------------------------------
# recommend_topics
# ---------------------------------------------------------------------------
def recommend_topics(
    quiz_scores: List[Dict[str, Any]], documents: List[str]
) -> List[str]:
    weak = [item["topic"] for item in quiz_scores if item.get("score", 0) < 70]
    return weak[:3] if weak else documents[:3]
