/**
 * DocumentExplanationPage.jsx
 * ============================
 * Renders the AI-generated study guide using react-markdown + remark-gfm.
 * Styled to look and feel like a ChatGPT response — large headings, paragraph
 * spacing, bullet lists, numbered lists, bold text, tables, code blocks, and
 * smooth scrolling.
 *
 * Props / Router:
 *   Route: /documents/:id/explanation
 *   Fetches: GET /api/documents/{id}  → document.student_explanation (Markdown)
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  Sparkles,
  AlertCircle,
  FileText,
} from "lucide-react";
import uploadService from "../services/uploadService";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";

// ---------------------------------------------------------------------------
// ChatGPT-style typography — injected once as a <style> tag
// ---------------------------------------------------------------------------
const PROSE_STYLES = `
  .ai-prose {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 1rem;
    line-height: 1.8;
    color: #1e293b;
  }

  /* Headings */
  .ai-prose h1 {
    font-size: 1.7rem;
    font-weight: 800;
    color: #0f172a;
    margin: 2.4rem 0 0.6rem;
    padding-bottom: 0.4rem;
    border-bottom: 2px solid #e2e8f0;
    letter-spacing: -0.02em;
  }
  .ai-prose h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e3a5f;
    margin: 1.8rem 0 0.5rem;
  }
  .ai-prose h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #334155;
    margin: 1.4rem 0 0.4rem;
  }

  /* First h1 on page — no top margin */
  .ai-prose > h1:first-child {
    margin-top: 0;
  }

  /* Paragraphs */
  .ai-prose p {
    margin: 0 0 1.1rem;
    color: #374151;
  }

  /* Horizontal rule */
  .ai-prose hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 2rem 0;
  }

  /* Unordered lists */
  .ai-prose ul {
    list-style: none;
    padding-left: 0;
    margin: 0.6rem 0 1.1rem;
  }
  .ai-prose ul li {
    position: relative;
    padding-left: 1.5rem;
    margin-bottom: 0.45rem;
    color: #374151;
  }
  .ai-prose ul li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #6366f1;
    font-size: 1.1em;
    line-height: 1.6;
  }

  /* Ordered lists */
  .ai-prose ol {
    padding-left: 1.5rem;
    margin: 0.6rem 0 1.1rem;
    counter-reset: item;
    list-style: none;
  }
  .ai-prose ol li {
    position: relative;
    padding-left: 0.5rem;
    margin-bottom: 0.45rem;
    color: #374151;
    counter-increment: item;
  }
  .ai-prose ol li::before {
    content: counter(item) ".";
    position: absolute;
    left: -1.5rem;
    color: #6366f1;
    font-weight: 700;
    min-width: 1.2rem;
  }

  /* Bold / italic */
  .ai-prose strong {
    font-weight: 700;
    color: #0f172a;
  }
  .ai-prose em {
    font-style: italic;
    color: #475569;
  }

  /* Inline code */
  .ai-prose code {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.3rem;
    padding: 0.1em 0.4em;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.88em;
    color: #7c3aed;
  }

  /* Code blocks */
  .ai-prose pre {
    background: #0f172a;
    border-radius: 0.75rem;
    padding: 1.1rem 1.4rem;
    margin: 1.2rem 0;
    overflow-x: auto;
  }
  .ai-prose pre code {
    background: none;
    border: none;
    padding: 0;
    color: #e2e8f0;
    font-size: 0.9rem;
    line-height: 1.7;
  }

  /* Block quotes */
  .ai-prose blockquote {
    border-left: 4px solid #6366f1;
    background: #f5f3ff;
    border-radius: 0 0.5rem 0.5rem 0;
    margin: 1.2rem 0;
    padding: 0.8rem 1.2rem;
    color: #4c1d95;
  }
  .ai-prose blockquote p {
    margin: 0;
    color: #4c1d95;
  }

  /* Tables */
  .ai-prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.4rem 0;
    font-size: 0.95rem;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .ai-prose thead {
    background: #6366f1;
    color: white;
  }
  .ai-prose thead th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.92rem;
    letter-spacing: 0.01em;
  }
  .ai-prose tbody tr {
    border-bottom: 1px solid #e2e8f0;
    transition: background 0.15s;
  }
  .ai-prose tbody tr:last-child {
    border-bottom: none;
  }
  .ai-prose tbody tr:hover {
    background: #f5f3ff;
  }
  .ai-prose tbody td {
    padding: 0.65rem 1rem;
    color: #374151;
    vertical-align: top;
  }
  .ai-prose tbody tr:nth-child(even) {
    background: #fafafa;
  }
  .ai-prose tbody tr:nth-child(even):hover {
    background: #f5f3ff;
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DocumentExplanationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Inject prose CSS once
  useEffect(() => {
    if (document.getElementById("ai-prose-styles")) return;
    const style = document.createElement("style");
    style.id = "ai-prose-styles";
    style.textContent = PROSE_STYLES;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Fetch document
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const data = await uploadService.getDocument(id);
        setDocumentData(data);
      } catch (err) {
        console.error("Failed to load document", err);
        addToast("Failed to load document details", "error");
        navigate("/upload");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate, addToast]);

  const explanation = documentData?.student_explanation || "";

  // Copy to clipboard
  const handleCopy = async () => {
    if (!explanation) return;
    try {
      await navigator.clipboard.writeText(explanation);
      setCopied(true);
      addToast("Explanation copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Failed to copy", "error");
    }
  };

  // Download as .md file
  const handleDownload = () => {
    if (!explanation) return;
    const blob = new Blob([explanation], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentData?.title ?? "document"}_study_guide.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addToast("Download started", "success");
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (!documentData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="text-red-400" size={40} />
        <p className="text-lg text-slate-500 font-medium">Document not found.</p>
        <button
          onClick={() => navigate("/upload")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <ArrowLeft size={16} /> Back to Documents
        </button>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        className="sticky top-0 z-20 bg-white/80 border-b border-slate-200 px-4 sm:px-8 py-3"
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left — back + title */}
          <div className="min-w-0">
            <button
              onClick={() => navigate("/upload")}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition mb-1"
            >
              <ArrowLeft size={14} />
              Back to Documents
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <FileText size={16} className="text-indigo-600" />
              </div>
              <h1 className="text-base font-bold text-slate-900 truncate">
                {documentData.title}
              </h1>
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopy}
              disabled={!explanation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition disabled:opacity-40"
            >
              {copied
                ? <><Check size={14} className="text-emerald-500" /><span className="text-emerald-600">Copied</span></>
                : <><Copy size={14} /><span>Copy</span></>
              }
            </button>
            <button
              onClick={handleDownload}
              disabled={!explanation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition disabled:opacity-40"
            >
              <Download size={14} />
              <span>Download .md</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── AI badge ────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-6 pb-2">
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-200">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">AI Study Guide</p>
            <p className="text-white/80 text-xs leading-tight mt-0.5">
              Powered by Gemini 1.5 Flash · Covers the complete document
            </p>
          </div>
        </div>
      </div>

      {/* ── Markdown body ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 pb-24 pt-4">
        {explanation ? (
          <div
            className="ai-prose bg-white rounded-2xl shadow-sm border border-slate-100 px-6 sm:px-10 py-8 sm:py-10"
            style={{ minHeight: "60vh" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {explanation}
            </ReactMarkdown>
          </div>
        ) : (
          /* No explanation stored */
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <AlertCircle size={32} className="text-amber-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700">
              AI Explanation Unavailable
            </p>
            <p className="text-sm text-slate-500 max-w-sm">
              Please ensure <code className="bg-slate-100 px-1 rounded">GEMINI_API_KEY</code> is
              configured in <code className="bg-slate-100 px-1 rounded">backend/.env</code> and
              re-upload your document.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
