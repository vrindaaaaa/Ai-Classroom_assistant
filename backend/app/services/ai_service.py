"""
ai_service.py
=============
Central AI service for the AI Classroom Assistant.

generate_student_explanation(text)
-----------------------------------
Sends the COMPLETE extracted text to Gemini 1.5 Flash and returns a richly
formatted Markdown study guide.

For documents longer than _CHUNK_CHARS the text is split at paragraph
boundaries, each chunk is explained separately, then a final merge call
stitches everything into one coherent guide.

Section structure (emojis and all):

    # 📘 Document Overview
    # 🎯 Objectives
    # 📚 Complete Explanation
    # 🧠 Important Concepts
    # 📌 Key Takeaways
    # 💡 Real-world Examples
    # ⚠ Important Notes
    # 📝 Exam Questions
    # 📖 Final Revision Notes

Output is pure Markdown — headings, paragraphs, bullets, numbered lists,
tables and code blocks where appropriate. Never plain text, never JSON,
never HTML.

No fallback previews are returned. If the API key is missing or invalid,
a clear error is raised instead.
"""
from __future__ import annotations

import hashlib
import json as _json
import logging
import os
import time
import traceback
from typing import Any, Dict, List, Optional, Tuple

from app.config import GEMINI_API_KEY

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

_CACHED_MODEL = None
_CACHED_MODEL_NAME = None
_QUIZ_CACHE: Dict[str, List[Dict[str, Any]]] = {}

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
# Error classification
# ---------------------------------------------------------------------------
def _classify_gemini_error(exc: Exception) -> Tuple[str, str, Optional[int]]:
    """Classify a Gemini exception into (user_message, technical_reason, retry_after_seconds)."""
    error_str = str(exc).lower()
    raw = str(exc)

    if "429" in error_str or "quota" in error_str or "resource exhausted" in error_str:
        retry_after = None
        import re
        match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", raw)
        if match:
            retry_after = int(match.group(1))
        else:
            match = re.search(r"please retry in (\d+\.?\d*)s", raw, re.IGNORECASE)
            if match:
                retry_after = int(float(match.group(1)))
        return (
            "Daily Gemini API quota exceeded. Please check your plan/billing or try again later.",
            "quota_exceeded",
            retry_after,
        )
    if "invalid api key" in error_str or ("api_key" in error_str and "invalid" in error_str):
        return (
            "Invalid Gemini API key. Please update backend/.env with a valid key.",
            "invalid_api_key",
            None,
        )
    if "billing" in error_str:
        return (
            "Gemini billing issue. Please enable billing on your Google Cloud project.",
            "billing_required",
            None,
        )
    if "timeout" in error_str or "timed out" in error_str:
        return (
            "Gemini request timed out. Please try again.",
            "timeout",
            None,
        )
    if "temporarily unavailable" in error_str or "service unavailable" in error_str:
        return (
            "Gemini service is temporarily unavailable. Please retry in a few moments.",
            "service_unavailable",
            None,
        )
    if "prompt" in error_str and "token" in error_str:
        return (
            "Prompt exceeds Gemini token limit. Please use a shorter document or split it into smaller parts.",
            "prompt_too_long",
            None,
        )
    if "context" in error_str and ("limit" in error_str or "exceed" in error_str):
        return (
            "Context limit exceeded. The document may be too large for a single request.",
            "context_limit_exceeded",
            None,
        )
    return (
        f"AI service error: {str(exc)}",
        "unknown",
        None,
    )


# ---------------------------------------------------------------------------
# MAIN PROMPT — single document or single chunk
# ---------------------------------------------------------------------------
_MAIN_PROMPT = """You are an expert university professor and AI tutor who explains documents to college students.

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

# 🎯 Objectives

Explain clearly why this document exists, what problem it solves, and who it is for.

---

# 📚 Complete Explanation

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

# 📌 Key Takeaways

List the most important facts as bullet points:

• Point 1
• Point 2
• Point 3

---

# 💡 Real-world Examples

Give 2–3 concrete, easy-to-understand real-life examples that relate to the document's topics.

---

# ⚠ Important Notes

Write concise notes about things students should remember, common mistakes to avoid, and tricky points that often appear in exams.

---

# 📝 Exam Questions

Generate exactly 10 exam or viva questions based on this document. For each question write a clear, detailed answer.

Format:

**Q1. Question text?**

Answer text here.

**Q2. Question text?**

Answer text here.

---

# 📖 Final Revision Notes

Create short revision notes — the most important things to remember for exams, viva, or interviews. Make them concise and easy to memorize.

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
# 🎯 Objectives
# 📚 Complete Explanation
# 🧠 Important Concepts
# 📌 Key Takeaways
# 💡 Real-world Examples
# ⚠ Important Notes
# 📝 Exam Questions
# 📖 Final Revision Notes

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

        for sep in ("\n\n", "\n", " "):
            pos = text.rfind(sep, start, end)
            if pos > start:
                end = pos
                break

        chunks.append(text[start:end].strip())
        start = end

    return [c for c in chunks if c.strip()]


def _build_model():
    """Create and return a configured GenerativeModel instance.

    Caches the model instance to avoid repeated SDK configuration.
    """
    global _CACHED_MODEL, _CACHED_MODEL_NAME
    api_key = GEMINI_API_KEY
    logger.info("[ai_service] GEMINI_API_KEY present=%s len=%d", bool(api_key), len(api_key))
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing. "
            "Add a valid key to backend/.env and restart the server."
        )
    if "REPLACE_WITH_YOUR_ACTUAL" in api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is still set to the placeholder value. "
            "Replace it with a real key from https://aistudio.google.com/ and restart the server."
        )
    if not _GENAI_AVAILABLE:
        raise RuntimeError(
            "google-generativeai SDK is not installed. "
            "Run: pip install google-generativeai"
        )

    model_name = "gemini-flash-latest"
    if _CACHED_MODEL is not None and _CACHED_MODEL_NAME == model_name:
        logger.info("[ai_service] Returning cached Gemini model=%s", model_name)
        return _CACHED_MODEL

    try:
        genai.configure(api_key=api_key)
    except Exception as exc:
        traceback.print_exc()
        raise RuntimeError(f"Failed to configure Gemini SDK: {exc}") from exc
    logger.info("[ai_service] Gemini SDK configured model=%s", model_name)
    _CACHED_MODEL = genai.GenerativeModel(
        model_name=model_name,
        generation_config=_GENERATION_CONFIG,
    )
    _CACHED_MODEL_NAME = model_name
    return _CACHED_MODEL


def _call_gemini(model, prompt: str, max_retries: int = 3) -> str:
    """Make one Gemini API call, honouring safety settings.

    Retries on transient quota/rate-limit errors with exponential backoff.
    Returns ONLY the generated text. Never returns raw API response objects,
    JSON metadata, or internal error payloads.
    """
    logger.info("[ai_service] Gemini prompt length=%d", len(prompt))
    safety = _safety_settings()
    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            if safety:
                response = model.generate_content(prompt, safety_settings=safety)
            else:
                response = model.generate_content(prompt)
            text = (response.text or "").strip()
            logger.info("[ai_service] Gemini response length=%d", len(text))
            if not text:
                raise RuntimeError(
                    "Gemini returned an empty response. "
                    "This may indicate an invalid API key or a content-blocking safety filter."
                )
            return text
        except Exception as exc:
            last_exc = exc
            user_msg, reason, retry_after = _classify_gemini_error(exc)
            is_retryable = reason in {
                "quota_exceeded",
                "timeout",
                "service_unavailable",
                "context_limit_exceeded",
            }
            if is_retryable and attempt < max_retries:
                wait = min(retry_after or (2 ** attempt), 60)
                logger.warning(
                    "[ai_service] Gemini transient error attempt %d/%d reason=%s: %s. Retrying in %ds...",
                    attempt, max_retries, reason, exc, wait,
                )
                time.sleep(wait)
                continue
            break

    logger.error("[ai_service] Gemini failed after %d attempts: %s", max_retries, last_exc, exc_info=True)
    if last_exc:
        user_msg, reason, _ = _classify_gemini_error(last_exc)
        if reason == "invalid_api_key":
            raise RuntimeError(
                "AI service configuration error: Invalid Gemini API key. "
                "Please check backend/.env and ensure GEMINI_API_KEY is a valid key from https://aistudio.google.com/"
            ) from last_exc
        if reason == "quota_exceeded":
            raise RuntimeError(
                "AI service quota exceeded. Please check your Gemini API plan and billing, or try again later."
            ) from last_exc
        if reason == "billing_required":
            raise RuntimeError(
                "AI service billing required. Please enable billing on your Google Cloud project."
            ) from last_exc
        raise RuntimeError(f"AI service error: {user_msg}") from last_exc
    raise RuntimeError("AI service failed after retries.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def generate_student_explanation(text: str) -> str:
    """Return a complete Markdown study guide for the given document text.

    • Small documents  → single Gemini call with the full 9-section prompt.
    • Large documents  → chunk → partial explanations → merge into final guide.

    Raises RuntimeError if the API key is missing, the SDK is unavailable,
    or Gemini returns an error. No previews or fallbacks are returned.
    """
    logger.info("[explanation] STEP 1: Explanation generation requested")
    if not text or not text.strip():
        logger.error("[explanation] STEP 2: No content found in the document to explain.")
        raise ValueError("No content found in the document to explain.")

    logger.info("[explanation] STEP 3: Document text loaded length=%d", len(text))

    try:
        model = _build_model()
    except Exception as exc:
        logger.error("[explanation] STEP 6: Failed to build Gemini model: %s", exc, exc_info=True)
        raise

    chunks = _split_into_chunks(text)
    logger.info(
        "[explanation] STEP 4: Split into %d chunk(s) from %d chars",
        len(chunks), len(text),
    )

    logger.info("[explanation] STEP 7: Using model=%s", getattr(model, "model_name", "unknown"))

    # ── Single chunk (most documents) ───────────────────────────────────────
    if len(chunks) == 1:
        prompt = _MAIN_PROMPT.format(text=chunks[0])
        logger.info("[explanation] STEP 6: Prompt length=%d (single chunk)", len(prompt))
        logger.info("[explanation] STEP 8: Gemini request started (single chunk)")
        try:
            result = _call_gemini(model, prompt)
        except Exception as exc:
            logger.error("[explanation] STEP 9: Gemini request failed: %s", exc, exc_info=True)
            raise
        logger.info("[explanation] STEP 9: Gemini response received length=%d", len(result))
        logger.info("[explanation] STEP 10: Explanation generated successfully")
        return result

    # ── Multi-chunk path ─────────────────────────────────────────────────────
    total = len(chunks)
    partial_explanations: List[str] = []

    for i, chunk in enumerate(chunks, start=1):
        logger.info("[explanation] STEP 8: Gemini request started (chunk %d/%d)", i, total)
        chunk_prompt = _CHUNK_PROMPT.format(part=i, total=total, text=chunk)
        logger.info("[explanation] STEP 6: Prompt length=%d (chunk %d/%d)", len(chunk_prompt), i, total)
        try:
            partial = _call_gemini(model, chunk_prompt)
        except Exception as exc:
            logger.error("[explanation] STEP 9: Gemini request failed for chunk %d/%d: %s", i, total, exc, exc_info=True)
            raise
        logger.info("[explanation] STEP 9: Gemini response received for chunk %d/%d length=%d", i, total, len(partial))
        partial_explanations.append(f"## Part {i} of {total}\n\n{partial}")

    # Merge all partials into the canonical 9-section guide
    parts_text = "\n\n---\n\n".join(partial_explanations)
    merge_prompt = _MERGE_PROMPT.format(n=total, parts_text=parts_text)
    logger.info("[explanation] STEP 6: Merge prompt length=%d", len(merge_prompt))
    logger.info("[explanation] STEP 8: Gemini request started (merge)")
    try:
        final = _call_gemini(model, merge_prompt)
    except Exception as exc:
        logger.error("[explanation] STEP 9: Gemini merge request failed: %s", exc, exc_info=True)
        raise
    logger.info("[explanation] STEP 9: Gemini merge response received length=%d", len(final))
    logger.info("[explanation] STEP 10: Merged explanation generated successfully")
    return final


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
# QUIZ PROMPTS
# ---------------------------------------------------------------------------
_QUIZ_PROMPT = """Generate a quiz JSON from the document text below.

Rules:
- Output ONLY valid JSON: {{"title": "...", "questions": [...]}}
- Exactly 20 questions: 10 MCQs, 5 True/False, 5 Short Answer
- Each question needs: id (int), type (mcq|truefalse|shortanswer), question, options (4 strings for mcq, ["True","False"] for truefalse, null for shortanswer), correct_answer, explanation
- MCQ correct_answer must match one option exactly
- Cover different topics from the document
- Do not repeat questions

DIFFICULTY: {difficulty}

DOCUMENT TEXT:
{text}
"""

_QUIZ_CHUNK_PROMPT = """Generate quiz JSON from Part {part}/{total} of a document.

Rules:
- Output ONLY valid JSON: {{"title": "...", "questions": [...]}}
- Exactly 5 questions: 3 MCQs, 1 True/False, 1 Short Answer
- Each question needs: id, type, question, options, correct_answer, explanation
- MCQ options: exactly 4 strings, correct_answer must match one
- True/False options: ["True", "False"]
- Short Answer options: null

DIFFICULTY: {difficulty}

DOCUMENT PORTION {part} of {total}:
{text}
"""

_QUIZ_MERGE_PROMPT = """Merge quiz parts into one final quiz JSON.

Rules:
- Output ONLY valid JSON: {{"title": "...", "questions": [...]}}
- Exactly 20 questions: 10 MCQs, 5 True/False, 5 Short Answer
- Remove duplicate questions
- Keep variety in topics and types
- Each question needs: id, type, question, options, correct_answer, explanation

PARTS ({n} total):
{parts_text}
"""

_SINGLE_QUESTION_PROMPT = """Generate ONE quiz question JSON.

Rules:
- Output ONLY valid JSON with keys: id, type, question, options, correct_answer, explanation
- Type must be: {required_type}
- MCQ: 4 options, correct_answer matches one option
- True/False: options = ["True", "False"]
- Short Answer: options = null
- Question must be complete and based on the document

DIFFICULTY: {difficulty}

DOCUMENT TEXT:
{text}
"""


def _validate_single_question(q: Dict[str, Any], idx: int, difficulty: str) -> tuple:
    """Validate a single question dict.

    Returns (normalized_question_or_None, error_reason_string).
    """
    if not q or not isinstance(q, dict):
        return None, "Question is not a valid object"

    qtype = q.get("type")
    if qtype not in ("mcq", "truefalse", "shortanswer"):
        return None, f"Invalid question type: {qtype!r}"

    question_text = (q.get("question") or "").strip()
    if not question_text:
        return None, "Missing or empty question text"

    options = q.get("options")
    if options is None:
        options = q.get("choices")
    correct_answer = (q.get("correct_answer") or "").strip()
    explanation = (q.get("explanation") or "").strip()

    if qtype == "truefalse":
        if options is None:
            options = ["True", "False"]
        options = list(dict.fromkeys(options))[:2]
        if "True" not in options:
            options.append("True")
        if "False" not in options:
            options.append("False")
        options = options[:2]
        if correct_answer not in options:
            correct_answer = options[0] if options else "True"

    elif qtype == "shortanswer":
        options = None
        if not correct_answer:
            return None, "Missing correct_answer for shortanswer"

    elif qtype == "mcq":
        if options is None:
            return None, "Missing options for MCQ"
        if not isinstance(options, list):
            return None, "Options is not a list for MCQ"
        options = [str(o).strip() for o in options if str(o).strip()]
        options = list(dict.fromkeys(options))
        if len(options) < 4:
            return None, f"MCQ has only {len(options)} unique options, need exactly 4"
        options = options[:4]
        if correct_answer not in options:
            return None, "correct_answer does not match any option"

    if not explanation:
        explanation = f"Answer: {correct_answer}"

    return {
        "id": idx,
        "type": qtype,
        "question": question_text,
        "options": options,
        "correct_answer": correct_answer,
        "explanation": explanation,
        "difficulty": difficulty,
    }, ""


def _validate_quiz_questions(questions: List[Dict[str, Any]], difficulty: str) -> List[Dict[str, Any]]:
    """Validate and normalize quiz questions.

    Returns only valid questions. Logs invalid ones with reasons.
    """
    validated: List[Dict[str, Any]] = []
    seen_questions: set = set()

    for idx, q in enumerate(questions, start=1):
        normalized, reason = _validate_single_question(q, idx, difficulty)
        if normalized is None:
            logger.warning("Question %d invalid: %s. Question data: %s", idx, reason, q)
            continue

        question_key = normalized["question"].lower().strip()
        if question_key in seen_questions:
            logger.warning("Question %d is a duplicate, skipping.", idx)
            continue
        seen_questions.add(question_key)

        validated.append(normalized)

    return validated


def _regenerate_single_question(
    model,
    required_type: str,
    difficulty: str,
    text: str,
    max_retries: int = 3,
) -> Dict[str, Any]:
    """Regenerate a single invalid question using a targeted prompt."""
    for attempt in range(max_retries):
        try:
            prompt = _SINGLE_QUESTION_PROMPT.format(
                required_type=required_type,
                difficulty=difficulty.capitalize(),
                text=text,
            )
            raw = _call_gemini(model, prompt)
            parsed = _parse_single_question_json(raw, required_type, difficulty)
            if parsed:
                logger.info("Regenerated %s question successfully on attempt %d.", required_type, attempt + 1)
                return parsed
        except Exception:
            traceback.print_exc()
            logger.warning("Single question regeneration attempt %d failed.", attempt + 1)
    return {}


def _parse_single_question_json(raw: str, required_type: str, difficulty: str) -> Dict[str, Any] | None:
    """Parse a single question JSON from Gemini response."""
    import json as _json

    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
    if text.endswith("```"):
        text = text[:-3].strip()

    try:
        data = _json.loads(text)
    except _json.JSONDecodeError as exc:
        logger.error("Failed to parse single question JSON: %s", exc)
        return None

    if not isinstance(data, dict):
        return None

    normalized, reason = _validate_single_question(data, 1, difficulty)
    if normalized is None:
        logger.warning("Regenerated question invalid: %s", reason)
        return None

    if normalized["type"] != required_type:
        logger.warning(
            "Regenerated question type mismatch: expected %s, got %s",
            required_type,
            normalized["type"],
        )
        return None

    return normalized


def _retry_quiz_generation(
    model, prompt: str, difficulty: str, max_retries: int = 3
) -> List[Dict[str, Any]]:
    """Call Gemini and retry up to max_retries if the response is invalid/malformed."""
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        raw = ""
        try:
            raw = _call_gemini(model, prompt)
            questions = _parse_quiz_json(raw, difficulty)
            if questions:
                logger.info(
                    "Quiz generation succeeded on attempt %d with %d questions.",
                    attempt, len(questions),
                )
                return questions
            logger.warning(
                "Quiz generation attempt %d returned 0 valid questions. Raw response (first 500 chars): %r",
                attempt, raw[:500],
            )
        except Exception as exc:
            last_exc = exc
            traceback.print_exc()
            logger.error(
                "Quiz generation attempt %d/%d failed: %s: %s. Raw response (first 500 chars): %r",
                attempt, max_retries, type(exc).__name__, exc, raw[:500],
            )
    logger.error(
        "Quiz generation failed after %d attempts. Last exception: %s",
        max_retries, last_exc,
    )
    if last_exc:
        raise last_exc
    return []


def _parse_quiz_json(raw: str, difficulty: str) -> List[Dict[str, Any]]:
    """Parse Gemini's JSON response into a list of validated question dicts.

    Raises ValueError if the JSON is malformed or the questions array is empty,
    so that _retry_quiz_generation can log the real error and retry cleanly.
    """
    import json as _json

    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
    if text.endswith("```"):
        text = text[:-3].strip()

    try:
        data = _json.loads(text)
    except _json.JSONDecodeError as exc:
        logger.error(
            "Gemini returned malformed JSON (JSONDecodeError): %s. "
            "Raw text (first 800 chars): %r",
            exc, text[:800],
        )
        raise ValueError(f"Gemini returned malformed JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"Gemini JSON root is not an object, got {type(data).__name__}")

    questions = data.get("questions", [])
    if not questions:
        logger.error(
            "Gemini returned empty questions array. Full parsed data keys: %s",
            list(data.keys()),
        )
        raise ValueError("Gemini returned an empty 'questions' array.")

    validated = _validate_quiz_questions(questions, difficulty)
    logger.info("_parse_quiz_json: %d raw → %d valid questions", len(questions), len(validated))
    return validated


def _ensure_complete_quiz(
    questions: List[Dict[str, Any]],
    difficulty: str,
    model,
    text: str,
) -> List[Dict[str, Any]]:
    """Guarantee exactly 20 questions: 10 MCQs, 5 True/False, 5 Short Answer.

    Regenerates missing or invalid questions individually.
    """
    target_mix = {"mcq": 10, "truefalse": 5, "shortanswer": 5}
    current: Dict[str, List[Dict[str, Any]]] = {"mcq": [], "truefalse": [], "shortanswer": []}

    for q in questions:
        qtype = q.get("type")
        if qtype in current:
            current[qtype].append(q)

    result = list(questions)
    seen_texts = {q["question"].lower().strip() for q in result if q.get("question")}

    for qtype, target_count in target_mix.items():
        current_count = len(current[qtype])
        if current_count >= target_count:
            continue

        logger.info(
            "Need %d %s questions, have %d. Regenerating %d missing questions.",
            target_count,
            qtype,
            current_count,
            target_count - current_count,
        )

        needed = target_count - current_count
        for _ in range(needed):
            new_q = _regenerate_single_question(model, qtype, difficulty, text)
            if new_q and new_q.get("question"):
                q_text = new_q["question"].lower().strip()
                if q_text not in seen_texts:
                    seen_texts.add(q_text)
                    result.append(new_q)
                    logger.info("Added regenerated %s question: %s", qtype, q_text[:60])

    # Re-validate and deduplicate final set
    final_validated = _validate_quiz_questions(result, difficulty)

    # Enforce exact mix
    final_mix: Dict[str, List[Dict[str, Any]]] = {"mcq": [], "truefalse": [], "shortanswer": []}
    for q in final_validated:
        qtype = q.get("type")
        if qtype in final_mix:
            final_mix[qtype].append(q)

    final_quiz = []
    for qtype, target_count in target_mix.items():
        final_quiz.extend(final_mix[qtype][:target_count])

    # Reassign IDs
    for idx, q in enumerate(final_quiz, start=1):
        q["id"] = idx

    logger.info(
        "Final quiz: %d questions (%d MCQs, %d True/False, %d Short Answer).",
        len(final_quiz),
        len(final_mix["mcq"]),
        len(final_mix["truefalse"]),
        len(final_mix["shortanswer"]),
    )

    return final_quiz


# ---------------------------------------------------------------------------
# generate_quiz_questions — AI-powered using Gemini
# ---------------------------------------------------------------------------
def generate_quiz_questions(
    text: str, difficulty: str = "medium", title: str = ""
) -> List[Dict[str, Any]]:
    """Generate a complete quiz from the document text using Gemini.

    Returns a list of exactly 20 validated question dicts
    (10 MCQ, 5 True/False, 5 Short Answer).
    Falls back to a minimal deterministic generator only if the Gemini SDK
    is unavailable.
    """
    logger.info("[quiz] generate_quiz_questions called: text_len=%d difficulty=%s title=%s", len(text), difficulty, title)
    if not text or not text.strip():
        logger.warning("[quiz] Empty text provided, returning fallback")
        return _generate_quiz_fallback(text, difficulty)

    cache_key = hashlib.sha256(text.encode("utf-8")).hexdigest() + ":" + difficulty.lower()
    if cache_key in _QUIZ_CACHE:
        logger.info("[quiz] Cache hit for cache_key=%s (%d questions)", cache_key, len(_QUIZ_CACHE[cache_key]))
        return _QUIZ_CACHE[cache_key]

    model = _build_model()
    logger.info("[quiz] Gemini model built successfully")
    # Use smaller chunks for quizzes to stay well under token limits
    quiz_chunk_size = min(_CHUNK_CHARS, 15000)
    chunks = _split_into_chunks(text, chunk_size=quiz_chunk_size)
    logger.info(
        "[quiz] %d chars → %d quiz chunk(s), difficulty=%s, cache_key=%s",
        len(text), len(chunks), difficulty, cache_key,
    )

    questions: List[Dict[str, Any]] = []
    try:
        # ── Single chunk ──────────────────────────────────────────
        if len(chunks) == 1:
            prompt = _QUIZ_PROMPT.format(difficulty=difficulty.capitalize(), text=chunks[0])
            logger.info("[quiz] Prompt length=%d (single chunk)", len(prompt))
            logger.info("[quiz] Gemini request started (single chunk)")
            questions = _retry_quiz_generation(model, prompt, difficulty)
            logger.info("[quiz] Gemini response received: %d questions", len(questions))
            if questions:
                questions = _ensure_complete_quiz(questions, difficulty, model, chunks[0])
                if questions:
                    _QUIZ_CACHE[cache_key] = questions
                    return questions

        # ── Multi-chunk path ──────────────────────────────────────
        total = len(chunks)
        all_questions: List[Dict[str, Any]] = []

        for i, chunk in enumerate(chunks, start=1):
            logger.info("Generating quiz questions for chunk %d / %d …", i, total)
            chunk_prompt = _QUIZ_CHUNK_PROMPT.format(
                part=i, total=total, difficulty=difficulty.capitalize(), text=chunk,
            )
            logger.info("[quiz] Chunk %d prompt length=%d", i, len(chunk_prompt))
            chunk_questions = _retry_quiz_generation(model, chunk_prompt, difficulty)
            logger.info("[quiz] Chunk %d generated %d questions", i, len(chunk_questions))
            all_questions.extend(chunk_questions)

        # Merge all questions into one final quiz
        parts_text = "\n\n---\n\n".join(
            _json.dumps({"questions": q}) for q in all_questions
        )
        merge_prompt = _QUIZ_MERGE_PROMPT.format(n=total, parts_text=parts_text)
        logger.info("[quiz] Merge prompt length=%d", len(merge_prompt))
        merged_questions = _retry_quiz_generation(model, merge_prompt, difficulty)
        logger.info("[quiz] Merge generated %d questions", len(merged_questions))

        if merged_questions:
            merged_questions = _ensure_complete_quiz(merged_questions, difficulty, model, text)
            if merged_questions:
                _QUIZ_CACHE[cache_key] = merged_questions
                return merged_questions

        # Fallback: use whatever we got from chunks
        if all_questions:
            all_questions = _ensure_complete_quiz(all_questions, difficulty, model, text)
            if all_questions:
                _QUIZ_CACHE[cache_key] = all_questions
                return all_questions
    except RuntimeError:
        raise
    except Exception as exc:
        logger.error("Quiz generation unexpected error: %s", exc, exc_info=True)
        raise RuntimeError(f"Quiz generation failed: {exc}") from exc

    fallback = _generate_quiz_fallback(text, difficulty)
    if fallback:
        _QUIZ_CACHE[cache_key] = fallback
    return fallback


def _generate_quiz_fallback(
    text: str, difficulty: str
) -> List[Dict[str, Any]]:
    """Minimal deterministic fallback when Gemini is unavailable."""
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    questions: List[Dict[str, Any]] = []
    for idx, sentence in enumerate(sentences[:10], start=1):
        topic = sentence[:80]
        questions.append(
            {
                "id": idx,
                "type": "mcq",
                "question": f"What is the main idea of: {topic}?",
                "options": [
                    "A core concept from the material",
                    "An unrelated topic",
                    "A random example",
                    "A marketing slogan",
                ],
                "correct_answer": "A core concept from the material",
                "explanation": "This is a placeholder answer because the AI service was unavailable.",
                "difficulty": difficulty,
            }
        )
    return questions


# ---------------------------------------------------------------------------
# generate_study_plan
# ---------------------------------------------------------------------------
_PLANNER_PROMPT = """You are an AI Classroom Assistant creating a personalized study plan.

STUDENT INPUT:
- Plan title: {title}
- Exam date: {exam_date}
- Study hours per day: {hours_per_day}
- Total days available: {total_days}

{document_context}

TASK:
Create a day-by-day study schedule JSON ONLY. No Markdown, no explanations, no plain text before or after the JSON.

OUTPUT FORMAT:
{{
  "title": "Study Plan: {title}",
  "total_days": {total_days},
  "hours_per_day": {hours_per_day},
  "plan": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "topics": ["Topic A", "Topic B"],
      "study_duration": "{hours_per_day} hours",
      "revision_task": "Quick revision of previous day's topics",
      "practice_task": "Practice questions on Topic A",
      "notes": "Focus on understanding key concepts"
    }}
  ]
}}

RULES:
- Distribute topics evenly across all days until the exam date.
- Reserve the last 2-3 days for full revision and mock tests.
- Each day must have realistic study tasks based on the document.
- Do NOT repeat the same task across consecutive days.
- Dates must be actual calendar dates starting from tomorrow.
- study_duration must match the hours_per_day.
- Return ONLY valid JSON. No extra text.
"""


def generate_study_plan(
    exam_date: str,
    hours_per_day: int,
    title: str = "Study Plan",
    document_text: str = "",
) -> Dict[str, Any]:
    """Generate an AI-powered personalized study plan using Gemini."""
    from datetime import datetime, timedelta

    try:
        total_days = max(1, (datetime.strptime(exam_date, "%Y-%m-%d").date() - datetime.now().date()).days)
    except Exception:
        total_days = 7

    document_context = ""
    if document_text and document_text.strip():
        document_context = f"DOCUMENT CONTENT:\n{document_text[:8000]}\n"

    model = _build_model()
    prompt = _PLANNER_PROMPT.format(
        title=title,
        exam_date=exam_date,
        hours_per_day=hours_per_day,
        total_days=total_days,
        document_context=document_context,
    )

    raw = _call_gemini(model, prompt)
    data = _parse_study_plan_json(raw, total_days, hours_per_day, exam_date)
    return data


def _parse_study_plan_json(
    raw: str,
    total_days: int,
    hours_per_day: int,
    exam_date: str,
) -> Dict[str, Any]:
    """Parse Gemini's study plan JSON response."""
    import json as _json
    from datetime import datetime, timedelta

    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
    if text.endswith("```"):
        text = text[:-3].strip()

    try:
        data = _json.loads(text)
    except _json.JSONDecodeError:
        logger.error("Failed to parse study plan JSON, using fallback")
        return _generate_study_plan_fallback(total_days, hours_per_day, exam_date)

    plan = data.get("plan", [])
    if not plan:
        return _generate_study_plan_fallback(total_days, hours_per_day, exam_date)

    start_date = datetime.now().date() + timedelta(days=1)
    normalized_plan = []

    for i, day in enumerate(plan[:total_days]):
        day_date = start_date + timedelta(days=i)
        normalized_plan.append({
            "day": day.get("day", i + 1),
            "date": day.get("date", day_date.isoformat()),
            "topics": day.get("topics", []),
            "study_duration": day.get("study_duration", f"{hours_per_day} hours"),
            "revision_task": day.get("revision_task", "Review notes"),
            "practice_task": day.get("practice_task", "Practice questions"),
            "notes": day.get("notes", ""),
        })

    return {
        "title": data.get("title", "Study Plan"),
        "total_days": total_days,
        "hours_per_day": hours_per_day,
        "plan": normalized_plan,
    }


def _generate_study_plan_fallback(
    total_days: int,
    hours_per_day: int,
    exam_date: str,
) -> Dict[str, Any]:
    """Generate a deterministic fallback study plan."""
    from datetime import datetime, timedelta

    start_date = datetime.now().date() + timedelta(days=1)
    plan = []

    for i in range(total_days):
        day_date = start_date + timedelta(days=i)
        if i < total_days - 2:
            focus = f"Study core concepts and complete practice exercises (Day {i + 1})"
            revision = "Revise previous day's notes"
            practice = "Solve practice problems"
        elif i < total_days - 1:
            focus = "Full revision of all topics"
            revision = "Review all summaries and flashcards"
            practice = "Take a mock test"
        else:
            focus = "Final review and light revision before exam"
            revision = "Quick skim of key formulas and concepts"
            practice = "Relax and rest mentally"

        plan.append({
            "day": i + 1,
            "date": day_date.isoformat(),
            "topics": [f"Study Session {i + 1}"],
            "study_duration": f"{hours_per_day} hours",
            "revision_task": revision,
            "practice_task": practice,
            "notes": focus,
        })

    return {
        "title": "Study Plan",
        "total_days": total_days,
        "hours_per_day": hours_per_day,
        "plan": plan,
    }


# ---------------------------------------------------------------------------
# chat_with_document — RAG-style QA using a specific uploaded document
# ---------------------------------------------------------------------------
_CHAT_PROMPT = """You are an AI study assistant. Answer the student's question using ONLY the provided document context.

RULES:
- Answer ONLY using the uploaded document content provided below.
- If the answer is not found in the document, reply exactly: "I couldn't find this information in the selected document."
- Do not invent facts, do not use outside knowledge.
- Keep answers concise but complete.
- Format the response in Markdown with headings, bullet points, numbered lists, tables (when useful), and bold keywords.
- Include a short summary at the end when appropriate.
- If the question is ambiguous, ask for clarification instead of guessing.

DOCUMENT CONTEXT:
{context}

{conversation_context}

STUDENT QUESTION:
{question}
"""


def chat_with_document(question: str, document_text: str, conversation_history: List[Dict[str, str]] = None) -> str:
    """Answer a question using only the provided document text.

    Optionally includes previous conversation turns for context.
    Returns a Markdown-formatted answer.
    """
    if not document_text or not document_text.strip():
        raise ValueError("The selected document has no extractable text.")

    conversation_context = ""
    if conversation_history:
        conversation_context = "PREVIOUS CONVERSATION:\n"
        for turn in conversation_history[-6:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                conversation_context += f"Student: {content}\n"
            else:
                conversation_context += f"Assistant: {content}\n"
        conversation_context += "\n"

    model = _build_model()
    prompt = (
        _CHAT_PROMPT.replace("{context}", document_text)
        .replace("{conversation_context}", conversation_context)
        .replace("{question}", question)
    )
    logger.info("chat_with_document: question length=%d, context length=%d, history turns=%d", len(question), len(document_text), len(conversation_history or []))
    answer = _call_gemini(model, prompt)
    logger.info("chat_with_document: answer generated (%d chars)", len(answer))
    return answer


# ---------------------------------------------------------------------------
# RAG helpers — chunking, embeddings, similarity search
# ---------------------------------------------------------------------------
_RAG_EMBEDDING_MODEL_NAME = "models/gemini-embedding-001"
_CHUNK_CHARS = 2500
_OVERLAP_CHARS = 400
_TOP_K = 5


def _chunk_text(text: str, chunk_size: int = _CHUNK_CHARS, overlap: int = _OVERLAP_CHARS) -> List[str]:
    """Split text into semantic chunks with sentence-boundary awareness."""
    if not text or not text.strip():
        return []

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    chunks: List[str] = []
    start = 0
    length = len(text)

    while start < length:
        end = min(start + chunk_size, length)
        if end < length:
            window = text[start:end]
            for sep in ("\n\n", "\n", ". ", "? ", "! ", " "):
                idx = window.rfind(sep)
                if idx > chunk_size // 2:
                    end = start + idx + len(sep)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= length:
            break

        start = max(start + 1, end - overlap)

    return [c for c in chunks if c.strip()]


def _get_embedding(text: str) -> List[float]:
    """Return a single embedding vector for the given text."""
    if not text or not text.strip():
        return []

    try:
        response = genai.embed_content(model=_RAG_EMBEDDING_MODEL_NAME, content=text)
        vector = response.get("embedding", [])
        if not vector:
            logger.warning("[rag] Empty embedding returned for text length=%d", len(text))
        return vector
    except Exception as exc:
        logger.error("[rag] Failed to generate embedding: %s", exc, exc_info=True)
        return []


def generate_chunks_and_embeddings(text: str, document_id: int, page_count: int = 0) -> List[Dict[str, Any]]:
    """Create semantic chunks and generate embeddings for a document."""
    raw_chunks = _chunk_text(text)
    if not raw_chunks:
        return []

    results: List[Dict[str, Any]] = []
    total = len(raw_chunks)

    for idx, chunk_text in enumerate(raw_chunks):
        page_number = None
        if page_count > 0:
            estimated_page = max(1, min(page_count, round((idx + 1) / total * page_count)))
            page_number = estimated_page

        embedding = _get_embedding(chunk_text)
        results.append(
            {
                "document_id": document_id,
                "content": chunk_text,
                "chunk_index": idx,
                "page_number": page_number,
                "embedding": embedding,
                "meta_data": {
                    "source": "upload",
                    "chunk": idx + 1,
                    "total_chunks": total,
                },
            }
        )

    logger.info("[rag] Generated %d chunks with embeddings for document_id=%d", len(results), document_id)
    return results


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y

    denom = (norm_a ** 0.5) * (norm_b ** 0.5)
    return dot / denom if denom > 0 else 0.0


def search_similar_chunks(query_embedding: List[float], chunks: List[Any], top_k: int = _TOP_K) -> List[Any]:
    """Return the top-k most similar chunks for the query embedding."""
    if not query_embedding or not chunks:
        return []

    scored = []
    for chunk in chunks:
        emb = getattr(chunk, "embedding", None) or []
        score = _cosine_similarity(query_embedding, emb)
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]


# ---------------------------------------------------------------------------
# recommend_topics
# ---------------------------------------------------------------------------
def recommend_topics(
    quiz_scores: List[Dict[str, Any]], documents: List[str]
) -> List[str]:
    weak = [item["topic"] for item in quiz_scores if item.get("score", 0) < 70]
    return weak[:3] if weak else documents[:3]
