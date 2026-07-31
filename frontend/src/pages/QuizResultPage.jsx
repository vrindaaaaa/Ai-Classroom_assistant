import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Lightbulb,
  HelpCircle,
} from "lucide-react";
import quizService from "../services/quizService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import { Skeleton } from "../components/Loader";

const STATUS_COLORS = {
  completed: "text-emerald-700 bg-emerald-50",
  in_progress: "text-blue-700 bg-blue-50",
  abandoned: "text-red-700 bg-red-50",
};

export default function QuizResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const data = await quizService.getQuizResult(id);
        setResult(data);
      } catch (err) {
        console.error("Failed to load quiz result", err);
        addToast("Failed to load quiz result", "error");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchResult();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quiz Result" description="Loading your quiz results..." />
        <Card>
          <div className="space-y-3">
            <Skeleton variant="text" className="h-8 w-1/3" />
            <Skeleton variant="text" className="h-4 w-1/2" />
            <Skeleton variant="text" className="h-4 w-2/3" />
          </div>
        </Card>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quiz Result" description="Result not found" />
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-slate-100 text-slate-500 mb-4">
            <HelpCircle size={28} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No Result Found</h3>
          <p className="text-sm text-slate-500 mt-1">This quiz does not have any results yet.</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate("/quizzes")}>
            Back to Quiz Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const questions = result.questions || [];
  const answers = result.answers || {};
  const correctCount = result.correct_answers || 0;
  const incorrectCount = (result.total_questions || questions.length) - correctCount;
  const percentage = result.percentage ?? 0;

  const strongTopics = result.strong_topics || [];
  const weakTopics = result.weak_topics || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz Result"
        description={result.quiz_title || "Quiz Results"}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/quizzes")} className="flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Quiz Dashboard
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => navigate(`/quizzes/${id}/retake`)} className="flex items-center gap-2">
            <RotateCcw size={16} /> Retake Quiz
          </Button>
        </div>
      </div>

      {/* Score Card */}
      <Card className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold">Quiz Complete</h3>
            <p className="text-indigo-100 text-sm mt-1">You completed: {result.quiz_title}</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-2 ${STATUS_COLORS[result.status] || "bg-white/20 text-white"}`}>
              {(result.status || "completed").replace("_", " ").toUpperCase()}
            </span>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white font-extrabold text-xl border border-white/30">
            {Math.round(percentage)}%
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{Math.round(percentage)}%</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <BarChart3 size={20} />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Correct</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{correctCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Incorrect</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{incorrectCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <XCircle size={20} />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time Taken</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatTime(result.time_taken)}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Weak & Strong Topics */}
      {(strongTopics.length > 0 || weakTopics.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {strongTopics.length > 0 && (
            <Card title="Strong Topics" subtitle="Concepts you answered correctly">
              <div className="space-y-2">
                {strongTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    {topic}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {weakTopics.length > 0 && (
            <Card title="Weak Topics" subtitle="Concepts to review">
              <div className="space-y-2">
                {weakTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                    <XCircle size={14} className="text-red-600" />
                    {topic}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Questions Breakdown */}
      <Card title="Question Breakdown" subtitle="Review your answers">
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const userAnswer = answers[String(idx)] || answers[idx] || "";
            const isCorrect = userAnswer === q.correct_answer;
            return (
              <div key={idx} className={`rounded-xl border p-4 ${isCorrect ? "border-emerald-100 bg-emerald-50/30" : "border-red-100 bg-red-50/30"}`}>
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{q.question}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Your answer: <span className={isCorrect ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>{userAnswer || "No answer"}</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Correct answer: <span className="font-semibold">{q.correct_answer}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Feedback */}
      {result.feedback && (
        <Card title="Feedback" subtitle="AI-generated feedback">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Lightbulb size={18} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{result.feedback}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds) return "0m";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
