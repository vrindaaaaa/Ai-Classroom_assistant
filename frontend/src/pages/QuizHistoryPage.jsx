import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  Search,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  Calendar,
  FileText,
} from "lucide-react";
import quizService from "../services/quizService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";

const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

function formatDate(dateStr) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString();
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function QuizHistoryPage() {
  const { addToast } = useToast();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDocument, setFilterDocument] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [viewingQuiz, setViewingQuiz] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await quizService.getQuizHistory();
      setHistory(data || []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredHistory = history.filter((q) => {
    if (search && !q.quiz_title?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterDifficulty !== "all" && q.difficulty !== filterDifficulty) {
      return false;
    }
    if (filterStatus === "completed" && (!q.percentage || q.percentage.percentage < 100)) {
      return false;
    }
    if (filterStatus === "in_progress" && q.percentage && q.percentage.percentage >= 100) {
      return false;
    }
    if (filterDocument !== "all" && q.document_id !== parseInt(filterDocument)) {
      return false;
    }
    return true;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();
    return sortOrder === "oldest" ? aDate - bDate : bDate - aDate;
  });

  const handleDelete = async (quizResultId) => {
    try {
      await quizService.deleteQuizResult(quizResultId);
      addToast("Quiz result deleted", "success");
      setDeleteConfirmId(null);
      fetchHistory();
    } catch {
      addToast("Failed to delete quiz result", "error");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await quizService.deleteAllQuizHistory();
      addToast("All quiz history deleted", "success");
      setDeleteAllConfirm(false);
      fetchHistory();
    } catch {
      addToast("Failed to delete quiz history", "error");
    }
  };

  const handleViewDetails = async (quizResultId) => {
    try {
      const data = await quizService.getQuizResultDetail(quizResultId);
      setViewingQuiz(data);
    } catch {
      addToast("Failed to load quiz details", "error");
    }
  };

  const closeDetails = () => {
    setViewingQuiz(null);
  };

  const uniqueDocuments = [...new Set(history.map((q) => q.document_title).filter(Boolean))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz History"
        description="View all your previous quiz attempts, scores, and details."
      />

      {/* Filters */}
      <Card title="Filters">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
          </select>

          <select
            value={filterDocument}
            onChange={(e) => setFilterDocument(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All Documents</option>
            {uniqueDocuments.map((doc) => (
              <option key={doc} value={doc}>
                {doc}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </Card>

      {/* Delete All */}
      {history.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteAllConfirm(true)}
            className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete All History
          </Button>
        </div>
      )}

      {/* Delete All Confirmation */}
      {deleteAllConfirm && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Are you sure you want to delete all quiz history?
              </p>
              <p className="text-xs text-red-600 mt-1">
                This will permanently remove all your quiz attempts. This action cannot be undone.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteAllConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteAll}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete All
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* History List */}
      {loading ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 size={24} className="animate-spin text-indigo-600 mb-3" />
          <p className="text-sm text-slate-500">Loading quiz history…</p>
        </Card>
      ) : sortedHistory.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4">
            <HelpCircle size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-950">No quiz history</h3>
          <p className="text-sm text-slate-500 max-w-xs mt-1">
            Complete a quiz to see your history here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedHistory.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {q.quiz_title}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {q.document_title && (
                    <span className="flex items-center gap-1 inline">
                      <FileText size={10} /> {q.document_title}
                    </span>
                  )}
                  {" · "}
                  {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                  {" · "}
                  <Calendar size={10} className="inline" /> {formatDate(q.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {q.percentage ? (
                    <>
                      <p className="text-sm font-bold text-indigo-600">
                        {q.percentage.correct_answers} / {q.percentage.total_questions}
                      </p>
                      <p className="text-xs text-slate-500">
                        {q.percentage.percentage}% · {formatTime(q.time_taken)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-400">—</p>
                      <p className="text-xs text-slate-500">Not completed</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(q.id)}
                    className="flex items-center gap-1"
                  >
                    <Eye size={14} /> Details
                  </Button>
                  {deleteConfirmId === q.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleDelete(q.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirmId(q.id)}
                      className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      {viewingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-950">
                {viewingQuiz.quiz_title}
              </h3>
              <button
                onClick={closeDetails}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-indigo-50 p-3 text-center">
                <p className="text-xl font-bold text-indigo-700">
                  {viewingQuiz.percentage}%
                </p>
                <p className="text-xs text-indigo-600 mt-1">Score</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-bold text-slate-700">
                  {viewingQuiz.correct_answers} / {viewingQuiz.total_questions}
                </p>
                <p className="text-xs text-slate-500 mt-1">Correct</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-bold text-slate-700">
                  {formatTime(viewingQuiz.time_taken)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Time Taken</p>
              </div>
            </div>

            {(viewingQuiz.strong_topics?.length > 0 || viewingQuiz.weak_topics?.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {viewingQuiz.strong_topics?.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-800">Strong Topics</p>
                    <ul className="mt-1 space-y-1">
                      {viewingQuiz.strong_topics.map((topic, i) => (
                        <li key={i} className="text-xs text-emerald-700">• {topic}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {viewingQuiz.weak_topics?.length > 0 && (
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-800">Weak Topics</p>
                    <ul className="mt-1 space-y-1">
                      {viewingQuiz.weak_topics.map((topic, i) => (
                        <li key={i} className="text-xs text-red-700">• {topic}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {viewingQuiz.questions?.map((q, idx) => {
                const userAnswer = viewingQuiz.answers?.[String(idx)];
                const correctAnswer = q.correct_answer;
                const isCorrect = userAnswer === correctAnswer;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      isCorrect
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      Q{idx + 1}: {q.question}
                    </p>
                    <div className="mt-2 space-y-1">
                      {q.options?.map((opt, oi) => (
                        <p
                          key={oi}
                          className={`text-xs ${
                            opt === correctAnswer
                              ? "text-emerald-700 font-semibold"
                              : opt === userAnswer && !isCorrect
                              ? "text-red-700 font-semibold"
                              : "text-slate-600"
                          }`}
                        >
                          {opt === correctAnswer && "✓ "}
                          {opt === userAnswer && !isCorrect && "✗ "}
                          {opt}
                        </p>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-slate-500 mt-2">{q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}