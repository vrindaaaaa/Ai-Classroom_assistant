import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, Quiz, QuizResult, StudyPlan
from app.services.ai_service import _build_model, _call_gemini

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = logging.getLogger("dashboard_routes")


_INSIGHTS_PROMPT = """You are an AI Classroom Assistant. Analyze the student's learning data and provide concise, actionable insights.

Student data:
- Average quiz score: {average_score}%
- Total quizzes completed: {total_quizzes}
- Documents uploaded: {documents_uploaded}
- Study plans generated: {study_plans}
- Learning streak: {learning_streak} days
- Study hours: {study_hours_per_day} hours
- Weak topics (with accuracy):
{weak_topics_detail}
- Strong topics (with accuracy):
{strong_topics_detail}

Generate exactly 4 insights in JSON format only. No markdown, no extra text.

[
  {
    "type": "strength|weakness|improvement|tip",
    "title": "Brief insight title",
    "description": "1-2 sentence actionable description",
    "priority": "high|medium|low"
  }
]
"""

_RECOMMENDATIONS_PROMPT = """You are an AI Classroom Assistant. Based on the student's weak topics, strong topics, and study patterns, generate 3 personalized recommendations.

Weak topics (with accuracy):
{weak_topics_detail}
Strong topics (with accuracy):
{strong_topics_detail}
Average score: {average_score}%
Study plans: {study_plans}

Generate exactly 3 recommendations in JSON format only. No markdown, no extra text.

[
  {
    "title": "Recommendation title",
    "description": "Why this helps",
    "action": "Specific action the student should take"
  }
]
"""


@router.get("")
@router.get("/")
def dashboard(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    total_documents = db.query(Document).filter(Document.owner_id == current_user.id).count()
    total_quizzes = db.query(Quiz).filter(Quiz.owner_id == current_user.id).count()
    total_study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).count()
    
    recent_uploads = db.query(Document).filter(Document.owner_id == current_user.id).order_by(Document.created_at.desc()).limit(5).all()
    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).order_by(QuizResult.created_at.desc()).all()
    recent_quizzes = db.query(Quiz).filter(Quiz.owner_id == current_user.id).order_by(Quiz.created_at.desc()).limit(5).all()

    valid_scores = [item.score for item in quiz_results if item.score is not None]
    average_score = round(sum(valid_scores) / len(valid_scores)) if valid_scores else 0

    learning_streak = _calculate_learning_streak(current_user.id, db)

    return {
        "message": f"Welcome back, {current_user.name}",
        "total_documents": total_documents,
        "total_quizzes": total_quizzes,
        "total_study_plans": total_study_plans,
        "learning_streak": learning_streak,
        "average_score": average_score,
        "recent_uploads": [
            {
                "id": item.id,
                "title": item.title,
                "file_type": item.file_type,
                "created_at": str(item.created_at) if item.created_at else None,
            }
            for item in recent_uploads
        ],
        "recent_quizzes": [
            {
                "id": q.id,
                "title": q.title,
                "created_at": str(q.created_at) if q.created_at else None,
            }
            for q in recent_quizzes
        ]
    }


def _calculate_learning_streak(user_id: int, db: Session) -> int:
    """Calculate consecutive active days from quizzes and study plans."""
    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == user_id).all()
    study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).all()
    
    dates_set = set()
    for res in quiz_results:
        if res.created_at:
            if isinstance(res.created_at, datetime):
                dates_set.add(res.created_at.date())
            else:
                try:
                    dates_set.add(datetime.fromisoformat(str(res.created_at)).date())
                except (ValueError, TypeError):
                    pass
    
    for plan in study_plans:
        if plan.created_at:
            if isinstance(plan.created_at, datetime):
                dates_set.add(plan.created_at.date())
            else:
                try:
                    dates_set.add(datetime.fromisoformat(str(plan.created_at)).date())
                except (ValueError, TypeError):
                    pass
    
    if not dates_set:
        return 0
    
    dates = sorted(dates_set, reverse=True)
    today = datetime.utcnow().date()
    if dates[0] != today and dates[0] != today - timedelta(days=1):
        return 0
    
    streak = 1
    current = dates[0]
    for d in dates[1:]:
        if d == current - timedelta(days=1):
            streak += 1
            current = d
        else:
            break
    return streak


def _normalize_topic(topic: str) -> str:
    """Normalize topic name for grouping similar topics."""
    topic = topic.lower().strip()
    stop_words = {"the", "a", "an", "of", "in", "on", "for", "with", "to", "and", "or", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to"}
    words = topic.split()
    while words and words[-1] in stop_words:
        words.pop()
    return " ".join(words) if words else topic


def _extract_topic_name(question: Dict[str, Any]) -> str:
    """Extract a meaningful topic name from a quiz question."""
    text = question.get("question", "")
    if not text:
        return "Unknown Topic"
    
    text = text.strip().rstrip("?").strip()
    
    prefixes = [
        "What is", "What are", "Explain", "Describe", "Define",
        "How does", "How do", "Why does", "Why do", "Which of the",
        "Select the", "Choose the", "Identify the", "What does",
        "When does", "Where does", "Who is", "Whose", "Compare the",
        "Analyze the", "Discuss the", "List the", "Name the",
        "Tell me about", "Give an example of", "What is the",
        "What are the", "How is the", "How do the", "Why is the",
    ]
    
    cleaned = text
    for prefix in prefixes:
        if text.lower().startswith(prefix.lower()):
            cleaned = text[len(prefix):].strip()
            break
    
    if not cleaned:
        cleaned = text
    
    for sep in [" that ", " which ", " in ", " on ", " for ", " with ", " and ", " or ", " as ", " by "]:
        idx = cleaned.lower().find(sep)
        if 10 < idx < 100:
            cleaned = cleaned[:idx].strip()
            break
    
    if len(cleaned) > 60:
        cleaned = cleaned[:60].rsplit(" ", 1)[0].strip()
    
    cleaned = cleaned.strip(".,;:!").strip()
    
    return cleaned if cleaned else text[:60].rsplit(" ", 1)[0].strip()


def _analyze_quiz_performance(user_id: int, db: Session) -> Dict[str, Any]:
    """Analyze quiz results to find weak and strong topics with accuracy metrics."""
    quiz_results = (
        db.query(QuizResult)
        .filter(QuizResult.user_id == user_id)
        .order_by(QuizResult.created_at.asc())
        .all()
    )
    
    topic_stats: Dict[str, Dict[str, Any]] = {}
    performance_chart = []
    document_performance: Dict[str, Dict[str, int]] = {}
    total_study_hours = 0
    
    for result in quiz_results:
        score = result.score if result.score is not None else 0
        created_at = result.created_at
        date_str = created_at.date().isoformat() if isinstance(created_at, datetime) else str(created_at)[:10] if created_at else None
        
        if date_str:
            performance_chart.append({
                "date": date_str,
                "score": round(score) if isinstance(score, float) else score,
            })
        
        quiz = db.query(Quiz).filter(Quiz.id == result.quiz_id).first()
        if not quiz or not quiz.questions:
            continue
        
        questions = quiz.questions
        answers = result.answers or {}
        
        for idx, question in enumerate(questions):
            user_answer = answers.get(str(idx)) or answers.get(idx)
            correct_answer = question.get("correct_answer", "")
            is_correct = user_answer == correct_answer
            
            topic_raw = _extract_topic_name(question)
            topic_norm = _normalize_topic(topic_raw)
            
            if topic_norm not in topic_stats:
                topic_stats[topic_norm] = {
                    "correct": 0, "incorrect": 0, "total": 0,
                    "display_name": topic_raw
                }
            
            topic_stats[topic_norm]["total"] += 1
            if is_correct:
                topic_stats[topic_norm]["correct"] += 1
            else:
                topic_stats[topic_norm]["incorrect"] += 1
        
        # Track document performance
        if quiz.document_id:
            doc_id = quiz.document_id
            if doc_id not in document_performance:
                document_performance[doc_id] = {"correct": 0, "total": 0, "title": ""}
            document_performance[doc_id]["total"] += len(questions)
            document_performance[doc_id]["correct"] += sum(
                1 for idx, q in enumerate(questions)
                if (answers.get(str(idx)) or answers.get(idx)) == q.get("correct_answer")
            )
            
            document = db.query(Document).filter(Document.id == doc_id).first()
            if document:
                document_performance[doc_id]["title"] = document.title
    
    weak_topics = []
    strong_topics = []
    
    for topic_norm, stats in topic_stats.items():
        accuracy = round((stats["correct"] / stats["total"]) * 100) if stats["total"] > 0 else 0
        topic_data = {
            "topic": stats.get("display_name", topic_norm),
            "accuracy": accuracy,
            "correct": stats["correct"],
            "incorrect": stats["incorrect"],
            "total": stats["total"],
        }
        if accuracy < 70:
            if stats["incorrect"] > 0:
                weak_topics.append(topic_data)
        else:
            if stats["correct"] > 0:
                strong_topics.append(topic_data)
    
    weak_topics.sort(key=lambda x: (x["accuracy"], -x["incorrect"]))
    weak_topics = weak_topics[:5]
    strong_topics.sort(key=lambda x: (x["accuracy"], -x["correct"]), reverse=True)
    strong_topics = strong_topics[:5]
    
    for topic in weak_topics:
        if topic["accuracy"] < 40:
            topic["recommendation"] = f"Revise {topic['topic']} concepts thoroughly and retake the quiz."
        elif topic["accuracy"] < 55:
            topic["recommendation"] = f"Practice more questions on {topic['topic']} to improve accuracy."
        else:
            topic["recommendation"] = f"Review {topic['topic']} and focus on areas where you made mistakes."
    
    doc_perf_list = []
    for doc_id, perf in document_performance.items():
        accuracy = round((perf["correct"] / perf["total"]) * 100) if perf["total"] > 0 else 0
        doc_perf_list.append({
            "document_id": doc_id,
            "title": perf["title"] or f"Document {doc_id}",
            "questions_answered": perf["total"],
            "correct_answers": perf["correct"],
            "accuracy": accuracy,
        })
    doc_perf_list.sort(key=lambda x: x["accuracy"], reverse=True)
    
    study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).all()
    for plan in study_plans:
        if plan.hours_per_day and plan.generated_plan and isinstance(plan.generated_plan, dict):
            days = plan.generated_plan.get("total_days", 0)
            total_study_hours += plan.hours_per_day * days
    
    return {
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
        "performance_chart": performance_chart,
        "document_performance": doc_perf_list,
        "total_study_hours": total_study_hours,
    }


def _get_recent_activity(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Get recent user activities."""
    activities = []
    
    recent_uploads = (
        db.query(Document)
        .filter(Document.owner_id == user_id)
        .order_by(Document.created_at.desc())
        .limit(10)
        .all()
    )
    for doc in recent_uploads:
        activities.append({
            "type": "upload",
            "title": f"Uploaded \"{doc.title}\"",
            "date": doc.created_at.isoformat() if doc.created_at else None,
            "icon": "FileText",
        })
    
    recent_results = (
        db.query(QuizResult)
        .filter(QuizResult.user_id == user_id)
        .order_by(QuizResult.created_at.desc())
        .limit(10)
        .all()
    )
    for result in recent_results:
        quiz = db.query(Quiz).filter(Quiz.id == result.quiz_id).first()
        title = quiz.title if quiz else "Quiz"
        activities.append({
            "type": "quiz",
            "title": f"Completed Quiz \"{title}\"",
            "date": result.created_at.isoformat() if result.created_at else None,
            "icon": "HelpCircle",
        })
    
    recent_plans = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == user_id)
        .order_by(StudyPlan.created_at.desc())
        .limit(10)
        .all()
    )
    for plan in recent_plans:
        activities.append({
            "type": "study_plan",
            "title": f"Generated Study Plan \"{plan.title}\"",
            "date": plan.created_at.isoformat() if plan.created_at else None,
            "icon": "Calendar",
        })
    
    activities.sort(key=lambda x: x["date"] or "", reverse=True)
    return activities[:10]


def _generate_ai_insights(average_score: int, total_quizzes: int, documents_uploaded: int, study_plans: int, learning_streak: int, weak_topics: List[Dict], strong_topics: List[Dict], study_hours: int) -> List[Dict[str, Any]]:
    """Generate AI-powered learning insights using Gemini."""
    try:
        weak_detail = "\n".join(
            f"- {t.get('topic', 'Unknown')}: {t.get('accuracy', 0)}% accuracy, {t.get('incorrect', 0)} incorrect"
            for t in weak_topics[:5]
        ) if weak_topics else "None identified yet"
        
        strong_detail = "\n".join(
            f"- {t.get('topic', 'Unknown')}: {t.get('accuracy', 0)}% accuracy, {t.get('correct', 0)} correct"
            for t in strong_topics[:5]
        ) if strong_topics else "None identified yet"
        
        prompt = _INSIGHTS_PROMPT.format(
            average_score=average_score,
            total_quizzes=total_quizzes,
            documents_uploaded=documents_uploaded,
            study_plans=study_plans,
            learning_streak=learning_streak,
            study_hours_per_day=study_hours,
            weak_topics_detail=weak_detail,
            strong_topics_detail=strong_detail,
        )
        
        model = _build_model()
        raw = _call_gemini(model, prompt)
        
        import json as _json
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].strip()
        
        insights = _json.loads(text)
        if isinstance(insights, list):
            return insights[:4]
    except Exception as exc:
        logger.error("[analytics] Failed to generate AI insights: %s", exc, exc_info=True)
    
    # Fallback insights
    insights = []
    if average_score >= 80:
        insights.append({"type": "strength", "title": "Excellent Performance", "description": "You're maintaining a strong average score. Keep up the good work!", "priority": "high"})
    elif average_score >= 60:
        insights.append({"type": "improvement", "title": "Room for Growth", "description": "Your scores are decent. Focus on weak topics to improve further.", "priority": "medium"})
    else:
        insights.append({"type": "weakness", "title": "Needs Attention", "description": "Consider revisiting foundational concepts and practicing more quizzes.", "priority": "high"})
    
    if learning_streak >= 7:
        insights.append({"type": "strength", "title": "Consistent Learner", "description": f"Amazing! {learning_streak} day learning streak. Consistency is key to mastery.", "priority": "high"})
    elif learning_streak >= 3:
        insights.append({"type": "tip", "title": "Building Momentum", "description": f"You have a {learning_streak} day streak. Try to extend it to 7 days!", "priority": "medium"})
    
    if weak_topics:
        weakest = weak_topics[0]
        insights.append({"type": "weakness", "title": "Focus on Weak Areas", "description": f"Your weakest topic is '{weakest.get('topic', 'Unknown')}' at {weakest.get('accuracy', 0)}% accuracy. Practice more on this.", "priority": "high"})
    
    if strong_topics:
        strongest = strong_topics[0]
        insights.append({"type": "strength", "title": "Leverage Strengths", "description": f"You're excelling at '{strongest.get('topic', 'Unknown')}' with {strongest.get('accuracy', 0)}% accuracy. Use this confidence to tackle harder topics.", "priority": "medium"})
    
    return insights[:4]


def _generate_ai_recommendations(weak_topics: List[Dict], strong_topics: List[Dict], average_score: int) -> List[Dict[str, Any]]:
    """Generate AI-powered personalized recommendations."""
    try:
        weak_detail = "\n".join(
            f"- {t.get('topic', 'Unknown')}: {t.get('accuracy', 0)}% accuracy, {t.get('incorrect', 0)} incorrect. {t.get('recommendation', '')}"
            for t in weak_topics[:3]
        ) if weak_topics else "None"
        
        strong_detail = "\n".join(
            f"- {t.get('topic', 'Unknown')}: {t.get('accuracy', 0)}% accuracy, {t.get('correct', 0)} correct"
            for t in strong_topics[:3]
        ) if strong_topics else "None"
        
        prompt = _RECOMMENDATIONS_PROMPT.format(
            weak_topics_detail=weak_detail,
            strong_topics_detail=strong_detail,
            average_score=average_score,
            study_plans=0,
        )
        
        model = _build_model()
        raw = _call_gemini(model, prompt)
        
        import json as _json
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].strip()
        
        recs = _json.loads(text)
        if isinstance(recs, list):
            return recs[:3]
    except Exception as exc:
        logger.error("[analytics] Failed to generate AI recommendations: %s", exc, exc_info=True)
    
    # Fallback recommendations
    recs = []
    if weak_topics:
        weakest = weak_topics[0]
        recs.append({
            "title": f"Review {weakest.get('topic', 'Weak Topics')}",
            "description": f"This topic has {weakest.get('accuracy', 0)}% accuracy. Focus on understanding core concepts.",
            "action": weakest.get("recommendation", "Practice more questions on weak topics")
        })
    if average_score < 70:
        recs.append({
            "title": "Practice More Quizzes",
            "description": "Regular quizzing improves retention significantly",
            "action": "Complete at least 2-3 quizzes this week"
        })
    if strong_topics:
        strongest = strong_topics[0]
        recs.append({
            "title": f"Advance Your Strength in {strongest.get('topic', 'Strong Topics')}",
            "description": f"You're at {strongest.get('accuracy', 0)}% accuracy. Try advanced material.",
            "action": "Explore advanced topics or related subjects"
        })
    return recs[:3]


def _calculate_achievements(total_quizzes: int, learning_streak: int, documents_uploaded: int, study_plans: int, average_score: int) -> List[Dict[str, Any]]:
    """Calculate achievement badges based on user activity."""
    achievements = []
    
    if total_quizzes >= 1:
        achievements.append({"id": "first_quiz", "title": "First Steps", "description": "Completed your first quiz", "icon": "HelpCircle", "unlocked": True})
    if total_quizzes >= 5:
        achievements.append({"id": "quiz_5", "title": "Quiz Enthusiast", "description": "Completed 5 quizzes", "icon": "HelpCircle", "unlocked": True})
    if total_quizzes >= 10:
        achievements.append({"id": "quiz_10", "title": "Quiz Master", "description": "Completed 10 quizzes", "icon": "Award", "unlocked": True})
    if total_quizzes >= 20:
        achievements.append({"id": "quiz_20", "title": "Quiz Champion", "description": "Completed 20 quizzes", "icon": "Trophy", "unlocked": True})
    
    if learning_streak >= 3:
        achievements.append({"id": "streak_3", "title": "Consistent Learner", "description": "3 day learning streak", "icon": "Flame", "unlocked": True})
    if learning_streak >= 7:
        achievements.append({"id": "streak_7", "title": "Week Warrior", "description": "7 day learning streak", "icon": "Flame", "unlocked": True})
    if learning_streak >= 30:
        achievements.append({"id": "streak_30", "title": "Unstoppable", "description": "30 day learning streak", "icon": "Flame", "unlocked": True})
    
    if documents_uploaded >= 1:
        achievements.append({"id": "first_doc", "title": "Knowledge Collector", "description": "Uploaded your first document", "icon": "FileText", "unlocked": True})
    if documents_uploaded >= 5:
        achievements.append({"id": "doc_5", "title": "Digital Librarian", "description": "Uploaded 5 documents", "icon": "FileText", "unlocked": True})
    
    if study_plans >= 1:
        achievements.append({"id": "first_plan", "title": "Strategic Thinker", "description": "Created your first study plan", "icon": "CalendarDays", "unlocked": True})
    
    if average_score >= 80:
        achievements.append({"id": "high_score", "title": "High Achiever", "description": "Achieved 80%+ average score", "icon": "Award", "unlocked": True})
    if average_score >= 95:
        achievements.append({"id": "perfectionist", "title": "Perfectionist", "description": "Achieved 95%+ average score", "icon": "Star", "unlocked": True})
    
    return achievements


def _calculate_goals(total_quizzes: int, documents_uploaded: int, study_plans: int, learning_streak: int, average_score: int, study_hours: int) -> List[Dict[str, Any]]:
    """Calculate goal completion progress."""
    goals = [
        {
            "id": "quizzes",
            "title": "Complete 10 Quizzes",
            "current": total_quizzes,
            "target": 10,
            "unit": "quizzes",
            "color": "indigo",
        },
        {
            "id": "documents",
            "title": "Upload 5 Documents",
            "current": documents_uploaded,
            "target": 5,
            "unit": "documents",
            "color": "emerald",
        },
        {
            "id": "study_plans",
            "title": "Create 3 Study Plans",
            "current": study_plans,
            "target": 3,
            "unit": "plans",
            "color": "violet",
        },
        {
            "id": "streak",
            "title": "7 Day Learning Streak",
            "current": learning_streak,
            "target": 7,
            "unit": "days",
            "color": "amber",
        },
        {
            "id": "score",
            "title": "80% Average Score",
            "current": average_score,
            "target": 80,
            "unit": "%",
            "color": "rose",
        },
        {
            "id": "hours",
            "title": "20 Study Hours",
            "current": study_hours,
            "target": 20,
            "unit": "hours",
            "color": "sky",
        },
    ]
    
    for goal in goals:
        goal["percentage"] = min(100, round((goal["current"] / goal["target"]) * 100)) if goal["target"] > 0 else 0
        goal["completed"] = goal["current"] >= goal["target"]
    
    return goals


@router.get("/analytics")
def analytics(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    logger.info("[analytics] Fetching analytics for user_id=%s", current_user.id)
    
    # Basic counts
    total_documents = db.query(Document).filter(Document.owner_id == current_user.id).count()
    total_quizzes = db.query(Quiz).filter(Quiz.owner_id == current_user.id).count()
    total_study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).count()
    
    # Quiz results for scoring
    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).all()
    valid_scores = [item.score for item in quiz_results if item.score is not None]
    average_score = round(sum(valid_scores) / len(valid_scores)) if valid_scores else 0
    
    # Learning streak
    learning_streak = _calculate_learning_streak(current_user.id, db)
    
    # Performance analysis
    perf_data = _analyze_quiz_performance(current_user.id, db)
    
    # Recent activity
    recent_activity = _get_recent_activity(current_user.id, db)
    
    # Study hours
    total_study_hours = perf_data.get("total_study_hours", 0)
    
    # AI Insights
    ai_insights = _generate_ai_insights(
        average_score, len(quiz_results), total_documents, total_study_plans,
        learning_streak, perf_data.get("weak_topics", []), perf_data.get("strong_topics", []), total_study_hours
    )
    
    # AI Recommendations
    ai_recommendations = _generate_ai_recommendations(
        perf_data.get("weak_topics", []), perf_data.get("strong_topics", []), average_score
    )
    
    # Achievements
    achievements = _calculate_achievements(len(quiz_results), learning_streak, total_documents, total_study_plans, average_score)
    
    # Goals
    goals = _calculate_goals(len(quiz_results), total_documents, total_study_plans, learning_streak, average_score, total_study_hours)
    
    logger.info(
        "[analytics] user_id=%s docs=%d quizzes=%d plans=%d avg_score=%d streak=%d hours=%d",
        current_user.id,
        total_documents,
        total_quizzes,
        total_study_plans,
        average_score,
        learning_streak,
        total_study_hours,
    )
    
    return {
        "average_score": average_score,
        "learning_streak": learning_streak,
        "total_quizzes": len(quiz_results),
        "documents_uploaded": total_documents,
        "study_plans": total_study_plans,
        "study_hours": total_study_hours,
        "weak_topics": perf_data.get("weak_topics", []),
        "strong_topics": perf_data.get("strong_topics", []),
        "recent_activity": recent_activity,
        "performance_chart": perf_data.get("performance_chart", []),
        "document_performance": perf_data.get("document_performance", []),
        "ai_insights": ai_insights,
        "ai_recommendations": ai_recommendations,
        "achievements": achievements,
        "goals": goals,
    }
# reload trigger

# reload analytics
