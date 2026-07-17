import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Download, Check, FileText } from "lucide-react";
import uploadService from "../services/uploadService";
import { useToast } from "../context/ToastContext";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import Loader from "../components/Loader";
import Card from "../components/Card";

export default function DocumentTextPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const data = await uploadService.getDocument(id);
        setDocumentData(data);
      } catch (err) {
        console.error("Failed to load document details", err);
        addToast("Failed to load document details", "error");
        navigate("/upload");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDocument();
    }
  }, [id, navigate, addToast]);

  const handleCopyText = async () => {
    const text = documentData?.extracted_text || documentData?.content || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addToast("Extracted text copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
      addToast("Failed to copy text", "error");
    }
  };

  const handleDownloadText = () => {
    const text = documentData?.extracted_text || documentData?.content || "";
    if (!text) return;
    try {
      const element = document.createElement("a");
      const file = new Blob([text], { type: "text/plain;charset=utf-8" });
      element.href = URL.createObjectURL(file);
      element.download = `${documentData.title || "document"}_extracted.txt`;
      document.body.appendChild(element);
      element.click();
      element.remove();
      addToast("Extracted text download started", "success");
    } catch (err) {
      console.error("Failed to download text", err);
      addToast("Failed to download text", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg text-slate-500 font-medium">Document not found.</p>
        <Button variant="secondary" onClick={() => navigate("/upload")}>
          <ArrowLeft size={16} className="mr-2" />
          Back to Documents
        </Button>
      </div>
    );
  }

  const textContent = documentData.extracted_text || documentData.content || "";

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      {/* Sticky page header for a professional feel */}
      <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-1 cursor-pointer"
          >
            <ArrowLeft size={14} className="mr-1" />
            Back to Documents
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate max-w-lg">
            {documentData.title}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Uploaded on {new Date(documentData.created_at).toLocaleDateString()} • {documentData.file_type.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            disabled={!textContent}
            className="h-9 px-3"
          >
            {copied ? (
              <>
                <Check size={14} className="mr-1.5 text-emerald-500" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} className="mr-1.5 text-slate-500" />
                <span>Copy Text</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadText}
            disabled={!textContent}
            className="h-9 px-3"
          >
            <Download size={14} className="mr-1.5 text-slate-500" />
            <span>Download Text</span>
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm rounded-3xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <FileText size={18} className="text-indigo-500" />
          <span className="font-semibold text-slate-800 text-sm">📖 Extracted Text</span>
        </div>
        
        {textContent ? (
          <div className="p-6 bg-white">
            <div className="font-sans text-base leading-relaxed text-slate-700 whitespace-pre-wrap max-h-[70vh] overflow-y-auto pr-2 select-text selection:bg-indigo-100 selection:text-indigo-900 font-normal">
              {textContent}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 bg-white">
            <p className="text-sm">No text content available in this document.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
