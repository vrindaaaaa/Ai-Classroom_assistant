import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  Sparkles,
  ClipboardCheck,
  FileText,
  Clock,
  Hash,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import quizService, { extractQuizError } from "../services/quizService";
import uploadService from "../services/uploadService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useParams } from "react-router-dom";
import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import ErrorBoundary from "../components/ErrorBoundary";

const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

function formatDate(dateStr) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString();
}

function validateQuestion(q) {
  if (!q || typeof q !== "object") return false;
  if (!q.question || typeof q.question !== "string" || q.question.trim() === "") return false;
  const type = q.type;
  if (type !== "mcq" && type !== "truefalse" && type !== "shortanswer") return false;
  if (type === "mcq") {
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (typeof q.correct_answer !== "string" || q.correct_answer.trim() === "") return false;
    if (!q.options.includes(q.correct_answer)) return false;
  }
  if (type === "truefalse") {
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (typeof q.correct_answer !== "string" || q.correct_answer.trim() === "") return false;
    if (!q.options.includes(q.correct_answer)) return false;
  }
  if (type === "shortanswer") {
    if (typeof q.correct_answer !== "string" || q.correct_answer.trim() === "") return false;
  }
  return true;
}

/* A question is renderable if it passes validation AND has renderable content.
   shortanswer questions NEVER need an options array — they render a textarea. */
function isQuestionRenderable(q) {
  if (!validateQuestion(q)) return false;
  if (q.type === "shortanswer") return true;
  return Array.isArray(q.options) && q.options.length > 0;
}

function findNextValid(startIdx, questions) {
  for (let i = startIdx; i < questions.length; i++) {
    if (isQuestionRenderable(questions[i])) return i;
  }
  return -1;
}

function findPrevValid(startIdx, questions) {
  for (let i = startIdx; i >= 0; i--) {
    if (isQuestionRenderable(questions[i])) return i;
  }
  return -1;
}

export default function QuizPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { id: quizIdParam } = useParams();

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState(null);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [strongTopics, setStrongTopics] = useState([]);
  const [weakTopics, setWeakTopics] = useState([]);
  const [quizError, setQuizError] = useState("");
  const [error, setError] = useState("");

  // Load existing quiz if quizId is present in URL
  useEffect(() => {
    if (!quizIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await quizService.getQuiz(quizIdParam);
        if (!cancelled && data) {
          setQuizData({ id: data.id, title: data.title, difficulty: data.difficulty, questions: data.questions });
          setSelectedDocId(String(data.document_id || ""));
          setTitle(data.title || "");
          setDifficulty(data.difficulty || "medium");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load quiz", err);
          addToast("Failed to load quiz", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quizIdParam]);

  // Watchdog: auto-advance if a question is stuck un-renderable for 3 seconds
  const watchdogRef = React.useRef(null);
  const clearWatchdog = () => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  };

  // ── Fetch documents ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingDocs(true);
        setDocuments((await uploadService.getDocuments()) || []);
      } catch (err) {
        console.error("Failed to fetch documents", err);
      } finally { setLoadingDocs(false); }
    })();
  }, []);

  // Cleanup watchdog on unmount
  useEffect(() => () => clearWatchdog(), []);

  // ── Watchdog: if currentQ is stuck in un-renderable state, auto-advance ──────
  useEffect(() => {
    clearWatchdog();
    if (!quizData || submitted) return;
    const q = quizData.questions[currentQ];
    if (q && !isQuestionRenderable(q)) {
      console.warn(`[QuizPage] Q${currentQ + 1} (type="${q.type}") not renderable — watchdog 3s`);
      watchdogRef.current = setTimeout(() => {
        console.warn(`[QuizPage] Watchdog fired for Q${currentQ + 1}. Auto-advancing.`);
        const next = findNextValid(currentQ + 1, quizData.questions);
        if (next >= 0) { setCurrentQ(next); return; }
        const prev = findPrevValid(currentQ - 1, quizData.questions);
        if (prev >= 0) setCurrentQ(prev);
      }, 3000);
    }
    return () => clearWatchdog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, quizData, submitted]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleDocSelect = (docId) => {
    setSelectedDocId(docId);
    setSelectedDoc(documents.find((d) => d.id === parseInt(docId)) || null);
    setQuizData(null); setSelectedAnswers({}); setSubmitted(false);
    setScore(0); setCurrentQ(0); setQuizError(""); clearWatchdog();
  };

  const handleGenerate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedDocId || !title) {
      addToast("Please select a document and enter a quiz title.", "warning"); return;
    }
    setLoading(true); setError(""); setQuizError(""); setQuizData(null);
    setSelectedAnswers({}); setSubmitted(false); setScore(0); setCurrentQ(0);
    setStrongTopics([]); setWeakTopics([]); clearWatchdog();
    try {
      const data = await quizService.generateDocumentQuiz(selectedDocId, title, difficulty);
      if (!data?.questions?.length) { setQuizError("No questions were generated. Please try again."); return; }
      const validQuestions = data.questions.filter(validateQuestion);
      if (!validQuestions.length) { setQuizError("All generated questions are invalid. Please try again."); return; }
      const firstIdx = findNextValid(0, validQuestions);
      setCurrentQ(firstIdx >= 0 ? firstIdx : 0);
      setQuizData({ ...data, questions: validQuestions });
      addToast(`Quiz generated! ${validQuestions.length} questions ready.`, "success");
    } catch (err) {
      console.error("Quiz generation failed", err);
      if (err?.response?.data) console.error("Backend error:", err.response.data);
      const msg = extractQuizError(err);
      setQuizError(msg); setError(msg); addToast(msg, "error");
    } finally { setLoading(false); }
  };

  const handleSelectAnswer = (qIdx, choice) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: choice }));
  };

  const handleNext = () => {
    if (!quizData?.questions) return;
    clearWatchdog();
    const next = findNextValid(currentQ + 1, quizData.questions);
    if (next >= 0) setCurrentQ(next);
  };

  const handlePrev = () => {
    if (!quizData?.questions) return;
    clearWatchdog();
    const prev = findPrevValid(currentQ - 1, quizData.questions);
    if (prev >= 0) setCurrentQ(prev);
  };

  const handleSubmitAnswers = async () => {
    if (!quizData) return;
    const questions = quizData.questions;
    // Only require mcq + truefalse answered; shortanswer is optional
    const answerableIdxs = questions.map((q, i) => i).filter(i => questions[i].type !== "shortanswer");
    const unanswered = answerableIdxs.filter(i => !selectedAnswers[i]);
    if (unanswered.length > 0) {
      addToast(`Please answer all multiple-choice questions. (${answerableIdxs.length - unanswered.length}/${answerableIdxs.length} answered)`, "warning");
      return;
    }
    let correctCount = 0;
    questions.forEach((q, idx) => { if (selectedAnswers[idx] === q.correct_answer) correctCount++; });
    const finalScore = Math.round((correctCount / questions.length) * 100);
    setScore(finalScore); setSubmitted(true); clearWatchdog();
    addToast(`You scored ${finalScore}%!`, "success");
    setSavingResult(true);
    try {
      const result = await quizService.submitDocumentQuiz(
        selectedDocId, user?.id || 1, quizData.id, finalScore,
        `Difficulty: ${DIFFICULTY_LABELS[quizData.difficulty] || quizData.difficulty}. Completed successfully.`,
        selectedAnswers
      );
      setStrongTopics(result.strong_topics || []);
      setWeakTopics(result.weak_topics || []);
      addToast("Quiz results saved!", "success");
    } catch { addToast("Could not save quiz results", "error"); }
    finally { setSavingResult(false); }
  };

  const handleRetake = () => {
    setSelectedAnswers({}); setSubmitted(false); setScore(0);
    const first = quizData ? findNextValid(0, quizData.questions) : 0;
    setCurrentQ(first >= 0 ? first : 0);
    setStrongTopics([]); setWeakTopics([]); clearWatchdog();
  };

  const handleRegenerate = () => {
    setQuizError(""); setQuizData(null); setSelectedAnswers({}); setSubmitted(false);
    setScore(0); setCurrentQ(0); setStrongTopics([]); setWeakTopics([]); clearWatchdog();
    handleGenerate(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = quizData?.questions?.length || 0;
  const correctCount = totalQuestions > 0 ? Math.round((score / 100) * totalQuestions) : 0;
  const currentQuestion = quizData?.questions?.[currentQ] ?? null;
  const isCurrentRenderable = currentQuestion ? isQuestionRenderable(currentQuestion) : false;
  const isLastQuestion = !quizData?.questions ? false : findNextValid(currentQ + 1, quizData.questions) < 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz Generator"
        description="Select an uploaded document to generate a customized practice quiz."
      />

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left: Parameters */}
        <Card title="Quiz Parameters">
          <form onSubmit={handleGenerate} className="space-y-4">
            <Input
              label="Quiz Title"
              placeholder="e.g. Organic Chemistry Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none transition-all duration-200 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Source Document</label>
              {loadingDocs ? (
                <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center px-3">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-500">Loading documents…</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 text-center">
                  No uploaded documents. Upload a file first.
                </div>
              ) : (
                <>
                  <select
                    value={selectedDocId}
                    onChange={(e) => handleDocSelect(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none transition-all duration-200 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">— Select a document —</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title || doc.filename} ({doc.file_type?.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {selectedDoc && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText size={14} className="text-indigo-500" />
                        <span className="font-semibold text-slate-900">{selectedDoc.title || selectedDoc.filename}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Hash size={12} /> {selectedDoc.file_type?.toUpperCase()}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(selectedDoc.created_at)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
            <Button type="submit" variant="primary" className="w-full justify-center" loading={loading} disabled={!selectedDocId || !title}>
              Generate Quiz
            </Button>
          </form>
        </Card>

        {/* Right: Quiz Board */}
        <div className="lg:col-span-2">
          {loading ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4 animate-pulse">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">Generating your practice quiz…</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">Analyzing your document, summarizing topics, and formatting quiz options.</p>
            </Card>
          ) : !quizData ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">No active quiz</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-1">Select a document and enter a title to build custom multiple-choice questions.</p>
            </Card>
          ) : quizError ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">Quiz Error</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">{quizError}</p>
              <Button variant="primary" className="mt-4 flex items-center gap-1" onClick={handleRegenerate}>
                <RefreshCw size={14} /> Regenerate Quiz
              </Button>
            </Card>
          ) : submitted ? (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Quiz Complete</h3>
                  <p className="text-indigo-100 text-sm mt-1">You completed: {quizData.title}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white font-extrabold text-lg border border-white/30">
                  {score}%
                </div>
              </div>
              <Card title="Quiz Results">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-2xl font-bold text-emerald-700">{score}%</p>
                      <p className="text-xs text-emerald-600 mt-1">Score</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-2xl font-bold text-slate-700">{answeredCount}</p>
                      <p className="text-xs text-slate-500 mt-1">Answered</p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 p-3">
                      <p className="text-2xl font-bold text-indigo-700">{correctCount}</p>
                      <p className="text-xs text-indigo-600 mt-1">Correct</p>
                    </div>
                  </div>
                  {(strongTopics.length > 0 || weakTopics.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {strongTopics.length > 0 && (
                        <div className="rounded-xl bg-emerald-50 p-3">
                          <p className="text-sm font-semibold text-emerald-800">Strong Topics</p>
                          <ul className="mt-1 space-y-1">{strongTopics.map((t, i) => <li key={i} className="text-xs text-emerald-700">• {t}</li>)}</ul>
                        </div>
                      )}
                      {weakTopics.length > 0 && (
                        <div className="rounded-xl bg-red-50 p-3">
                          <p className="text-sm font-semibold text-red-800">Weak Topics</p>
                          <ul className="mt-1 space-y-1">{weakTopics.map((t, i) => <li key={i} className="text-xs text-red-700">• {t}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                  {quizData.questions.map((q, idx) => {
                    const correctAnswer = q.correct_answer || q.options?.[0];
                    const userAnswer = selectedAnswers[idx];
                    const isCorrect = userAnswer === correctAnswer;
                    return (
                      <div key={idx} className={`p-4 rounded-xl border ${isCorrect ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                        <div className="flex items-start gap-2">
                          {isCorrect ? <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />}
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Q{idx + 1}: {q.question}</p>
                            <p className="text-xs text-slate-600 mt-1">Your answer: {userAnswer || "Not answered"}</p>
                            {!isCorrect && <p className="text-xs text-emerald-700 mt-0.5">Correct: {correctAnswer}</p>}
                            {q.explanation && <p className="text-xs text-slate-500 mt-1">{q.explanation}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <div className="flex gap-3">
                <Button variant="primary" onClick={handleRetake} className="flex items-center gap-1">
                  <RotateCcw size={14} /> Retake Quiz
                </Button>
              </div>
            </div>
          ) : (
            <ErrorBoundary
              onRetry={() => { setQuizData(null); handleGenerate(null); }}
              onBack={() => { setQuizData(null); setSelectedDocId(""); setTitle(""); }}
            >
              <div className="space-y-6">
                {totalQuestions > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500">Q{currentQ + 1} of {totalQuestions}</span>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{answeredCount}/{totalQuestions} answered</span>
                  </div>
                )}

                {!quizData?.questions?.length ? (
                  <Card className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4"><AlertCircle size={24} /></div>
                    <h3 className="text-lg font-semibold text-slate-950">Quiz data unavailable</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">The quiz could not be loaded. Please try generating a new quiz.</p>
                    <Button variant="primary" className="mt-4 flex items-center gap-1" onClick={handleRegenerate}><RefreshCw size={14} /> Regenerate Quiz</Button>
                  </Card>
                ) : !currentQuestion ? (
                  <Card className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4"><AlertCircle size={24} /></div>
                    <h3 className="text-lg font-semibold text-slate-950">Question not found</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">Could not load question {currentQ + 1}.</p>
                    <Button variant="primary" className="mt-4" onClick={() => setCurrentQ(findNextValid(0, quizData.questions) >= 0 ? findNextValid(0, quizData.questions) : 0)}>
                      Go to first question
                    </Button>
                  </Card>
                ) : !isCurrentRenderable ? (
                  <Card className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4"><Loader2 size={24} className="animate-spin" /></div>
                    <h3 className="text-lg font-semibold text-slate-950">Preparing question…</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">Question {currentQ + 1} will auto-advance in 3 seconds, or skip it now.</p>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="flex items-center gap-1"
                        onClick={() => { clearWatchdog(); const p = findPrevValid(currentQ - 1, quizData.questions); if (p >= 0) setCurrentQ(p); }}
                        disabled={findPrevValid(currentQ - 1, quizData.questions) < 0}>
                        <ChevronLeft size={14} /> Previous
                      </Button>
                      <Button variant="primary" size="sm" className="flex items-center gap-1"
                        onClick={() => { clearWatchdog(); const n = findNextValid(currentQ + 1, quizData.questions); if (n >= 0) setCurrentQ(n); }}
                        disabled={findNextValid(currentQ + 1, quizData.questions) < 0}>
                        Skip <ChevronRight size={14} />
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card
                    title={quizData.title}
                    subtitle={`${DIFFICULTY_LABELS[quizData.difficulty] || quizData.difficulty} · Question ${currentQ + 1} of ${totalQuestions}`}
                  >
                    <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          currentQuestion.type === "mcq" ? "bg-indigo-100 text-indigo-700"
                          : currentQuestion.type === "truefalse" ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                        }`}>
                          {currentQuestion.type === "mcq" ? "Multiple Choice" : currentQuestion.type === "truefalse" ? "True / False" : "Short Answer"}
                        </span>
                      </div>

                      <div className="font-semibold text-slate-900 text-base">
                        {currentQ + 1}. {currentQuestion.question}
                      </div>

                      {(currentQuestion.type === "mcq" || currentQuestion.type === "truefalse") && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {currentQuestion.options.map((opt, optIdx) => {
                            const isSelected = selectedAnswers[currentQ] === opt;
                            const correctAnswer = currentQuestion.correct_answer;
                            let choiceStyle = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
                            if (isSelected && !submitted) choiceStyle = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100";
                            if (submitted) {
                              if (opt === correctAnswer) choiceStyle = "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100";
                              else if (isSelected) choiceStyle = "border-red-600 bg-red-50 text-red-800 ring-2 ring-red-100";
                              else choiceStyle = "opacity-50 border-slate-200 bg-white text-slate-700";
                            }
                            return (
                              <label key={optIdx} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${choiceStyle}`}>
                                <input type="radio" name={`question-${currentQ}`} value={opt} checked={isSelected}
                                  onChange={() => handleSelectAnswer(currentQ, opt)} disabled={submitted} className="accent-indigo-600 h-4 w-4" />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {currentQuestion.type === "shortanswer" && (
                        <div className="space-y-2">
                          <textarea rows={3} placeholder="Type your answer here…"
                            value={selectedAnswers[currentQ] || ""}
                            onChange={(e) => handleSelectAnswer(currentQ, e.target.value)}
                            disabled={submitted}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none disabled:opacity-60"
                          />
                          {submitted && (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                              <span className="font-semibold">Model answer: </span>{currentQuestion.correct_answer}
                            </div>
                          )}
                        </div>
                      )}

                      {!submitted && (
                        <div className="flex justify-between pt-4">
                          <Button variant="outline" size="sm" onClick={handlePrev}
                            disabled={findPrevValid(currentQ - 1, quizData.questions) < 0}
                            className="flex items-center gap-1">
                            <ChevronLeft size={14} /> Previous
                          </Button>
                          {!isLastQuestion ? (
                            <Button variant="primary" size="sm" onClick={handleNext} className="flex items-center gap-1">
                              Next <ChevronRight size={14} />
                            </Button>
                          ) : (
                            <Button variant="primary" size="sm" onClick={handleSubmitAnswers} loading={savingResult} className="flex items-center gap-1">
                              <ClipboardCheck size={14} /> Submit Quiz
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}