import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  Clock,
  Hash,
  FileText,
  BarChart3,
  Trash2,
  Play,
  RotateCcw,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import quizService from "../services/quizService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import { Skeleton } from "../components/Loader";

const DIFFICULTY_COLORS = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-slate-100 text-slate-600", icon: HelpCircle },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  abandoned: { label: "Abandoned", color: "bg-red-100 text-red-700", icon: XCircle },
};

function formatDateTime(dateStr) {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(seconds) {
  if (!seconds) return "0m";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function QuizDashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const data = await quizService.getQuizDashboardHistory();
      setQuizzes(data || []);
      } catch {
        console.error("Failed to load quiz history");
        addToast("Failed to load quiz history", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const filtered = quizzes
    .filter((q) => {
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

  const stats = {
    total: quizzes.length,
    completed: quizzes.filter((q) => q.status === "completed").length,
    inProgress: quizzes.filter((q) => q.status === "in_progress").length,
    avgScore: quizzes.length
      ? Math.round(
          quizzes.filter((q) => q.status === "completed" && q.percentage != null)
            .reduce((sum, q) => sum + (q.percentage || 0), 0) /
          Math.max(1, quizzes.filter((q) => q.status === "completed" && q.percentage != null).length)
        )
      : 0,
  };

  const handleDelete = async (quizId) => {
    try {
      await quizService.deleteQuiz(quizId);
      addToast("Quiz deleted", "success");
      fetchQuizzes();
    } catch {
      addToast("Failed to delete quiz", "error");
    }
  };

  const handleClearHistory = async () => {
    try {
      setClearing(true);
      await quizService.clearQuizHistory();
      addToast("Quiz history cleared", "success");
      setShowClearConfirm(false);
      fetchQuizzes();
    } catch {
      addToast("Failed to clear history", "error");
    } finally {
      setClearing(false);
    }
  };

  const handleRetake = async (quizId) => {
    try {
      const data = await quizService.retakeQuiz(quizId);
      addToast("New quiz created from retake", "success");
      navigate(`/quizzes/${data.id}`);
    } catch {
      addToast("Failed to retake quiz", "error");
    }
  };

  const handleResume = async (quizId) => {
    try {
      const data = await quizService.resumeQuiz(quizId);
      navigate(`/quizzes/${data.id}`);
    } catch {
      addToast("Failed to resume quiz", "error");
    }
  };

  const handleViewResult = (quizId) => {
    navigate(`/quizzes/${quizId}/result`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes"
        description="Manage your quizzes, review results, and track your progress."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => navigate("/quizzes/generate")} className="flex items-center gap-2">
            <Plus size={16} /> Generate New Quiz
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowClearConfirm(true)} className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 size={16} /> Clear History
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quizzes</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <HelpCircle size={20} />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.completed}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.inProgress}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock size={20} />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Score</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.avgScore}%</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <BarChart3 size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search quizzes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="all">All Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Quiz List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton variant="text" className="h-5 w-3/4 mb-3" />
              <Skeleton variant="text" className="h-4 w-1/2 mb-2" />
              <Skeleton variant="text" className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-slate-100 text-slate-500 mb-4">
            <HelpCircle size={28} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No quizzes yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Generate your first quiz from an uploaded document to start practicing.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => navigate("/quizzes/generate")}>
            Generate New Quiz
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((quiz) => {
            const statusCfg = STATUS_CONFIG[quiz.status] || STATUS_CONFIG.new;
            const StatusIcon = statusCfg.icon;
            const diffColor = DIFFICULTY_COLORS[quiz.difficulty] || DIFFICULTY_COLORS.medium;
            return (
              <Card key={quiz.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{quiz.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {quiz.document_title ? (
                        <span className="flex items-center gap-1">
                          <FileText size={12} /> {quiz.document_title}
                        </span>
                      ) : (
                        "No source document"
                      )}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusCfg.color}`}>
                    <StatusIcon size={12} /> {statusCfg.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 font-medium ${diffColor}`}>
                    {(quiz.difficulty || "medium").charAt(0).toUpperCase() + (quiz.difficulty || "medium").slice(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash size={12} /> {quiz.total_questions || 0} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {formatTime(quiz.time_taken)}
                  </span>
                  {quiz.status === "completed" && quiz.percentage != null && (
                    <span className="font-semibold text-slate-700">{quiz.percentage}%</span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">{formatDateTime(quiz.created_at)}</span>
                  <div className="flex items-center gap-1">
                    {quiz.status === "in_progress" && (
                      <Button variant="ghost" size="sm" onClick={() => handleResume(quiz.id)} className="text-blue-600 hover:bg-blue-50">
                        <Play size={14} /> Resume
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleRetake(quiz.id)} className="text-indigo-600 hover:bg-indigo-50">
                      <RotateCcw size={14} /> Retake
                    </Button>
                    {quiz.status === "completed" && (
                      <Button variant="ghost" size="sm" onClick={() => handleViewResult(quiz.id)} className="text-emerald-600 hover:bg-emerald-50">
                        <Eye size={14} /> View Result
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(quiz.id)} className="text-red-600 hover:bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Clear History Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Clear Quiz History</h3>
                <p className="text-sm text-slate-500 mt-1">
                  This will permanently delete all quiz results from your account. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowClearConfirm(false)} disabled={clearing}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleClearHistory} loading={clearing} className="bg-red-600 hover:bg-red-700 text-white">
                Clear All History
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
