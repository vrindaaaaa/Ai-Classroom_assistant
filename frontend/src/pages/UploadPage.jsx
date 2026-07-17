import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Trash2,
  Download,
  Search,
  BookOpen,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import uploadService from "../services/uploadService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Skeleton } from "../components/Loader";

const ACCEPTED_TYPES = ["pdf", "docx", "pptx"];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Upload Result Panel                                                  */
/* ------------------------------------------------------------------ */
function UploadResultPanel({ result, onDismiss, onDelete, onDownload, deleting }) {
  const navigate = useNavigate();
  if (!result) return null;

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-emerald-600 text-white">
        <CheckCircle2 size={20} />
        <span className="font-semibold text-base">Document Uploaded Successfully</span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-emerald-100 hover:text-white text-xl leading-none cursor-pointer"
          aria-label="Dismiss result"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Document metadata block */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FileText size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Document Name</p>
              <p className="font-bold text-slate-900 mt-0.5 break-words">{result.title || result.filename}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Upload Date</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {new Date(result.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">File Type</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5 uppercase">
                {result.file_type}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation / Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/documents/${result.id}/extracted`)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm"
          >
            <BookOpen size={14} />
            <span>View Extracted Text</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/documents/${result.id}/explanation`)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm"
          >
            <Sparkles size={14} className="text-purple-500" />
            <span>View AI Explanation</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(result)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm"
          >
            <Download size={14} />
            <span>Download</span>
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleting === result.id}
            onClick={() => onDelete(result.id)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main UploadPage component                                            */
/* ------------------------------------------------------------------ */
export default function UploadPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [uploadResult, setUploadResult] = useState(null); // stores last upload response
  const inputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await uploadService.getDocuments();
      setDocuments(data || []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
      addToast("Failed to load documents list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const resetFileInput = () => {
    setFile(null);
    setUploadProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const validateFile = (selectedFile) => {
    if (!selectedFile) return "Please choose a file to upload.";
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !ACCEPTED_TYPES.includes(extension))
      return "Only PDF, DOCX, and PPTX files are supported.";
    if (selectedFile.size > MAX_FILE_SIZE)
      return "File is too large. Maximum size is 25 MB.";
    return "";
  };

  const handleSelectedFile = (selectedFile) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      resetFileInput();
      setTitle("");
      return;
    }
    setError("");
    setFile(selectedFile);
    if (selectedFile && !title) {
      const nameWithoutExt =
        selectedFile.name.substring(0, selectedFile.name.lastIndexOf(".")) ||
        selectedFile.name;
      setTitle(nameWithoutExt);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    handleSelectedFile(selectedFile);
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event) => { preventDefaults(event); setDragActive(true); };
  const handleDragLeave = (event) => { preventDefaults(event); setDragActive(false); };
  const handleDrop = (event) => {
    preventDefaults(event);
    setDragActive(false);
    const selectedFile = event.dataTransfer.files?.[0] || null;
    handleSelectedFile(selectedFile);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a file to upload."); return; }

    setUploading(true);
    setError("");
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const newDoc = await uploadService.uploadDocument(
        title || file.name,
        file,
        (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(
              Math.round((progressEvent.loaded * 100) / progressEvent.total)
            );
          }
        }
      );

      setUploadResult(newDoc);            // ← store for result panel
      addToast(`Successfully uploaded "${newDoc.title}"`, "success");
      setTitle("");
      resetFileInput();
      await fetchDocuments();
    } catch (err) {
      console.error("Upload failed", err);
      const raw = err.response?.data?.detail;
      let message;
      if (Array.isArray(raw)) {
        message = raw.map((e) => e.msg || JSON.stringify(e)).join("; ");
      } else if (typeof raw === "string") {
        message = raw;
      } else {
        message = "Upload failed. Please try again.";
      }
      setError(message);
      addToast(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm("Delete this document?")) return;
    setDeleting(documentId);
    try {
      await uploadService.deleteDocument(documentId);
      addToast("Document deleted", "success");
      // If the deleted doc was the one shown in the result panel, clear it
      if (uploadResult && uploadResult.id === documentId) setUploadResult(null);
      await fetchDocuments();
    } catch (err) {
      console.error("Delete failed", err);
      addToast("Failed to delete document", "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await uploadService.downloadDocument(doc.id);
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename || `${doc.title}.${doc.file_type}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast("Download started", "success");
    } catch (err) {
      console.error("Download failed", err);
      addToast("Failed to download file", "error");
    }
  };

  const filteredDocs = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.filename || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage your study files in one secure workspace."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ---- Left column: upload form + result panel ---- */}
        <div className="lg:col-span-4 space-y-5">
          <Card title="Upload New Document">
            <form onSubmit={handleUploadSubmit} className="space-y-5">
              <Input
                label="Document title"
                placeholder="e.g. Biology Chapter 4"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                required
              />

              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-3xl border-2 p-6 text-center transition ${
                  dragActive
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-dashed border-slate-300 bg-slate-50"
                }`}
              >
                <input
                  ref={inputRef}
                  id="file-input"
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  <UploadCloud size={32} className="text-indigo-600" />
                  <p className="font-semibold text-slate-800">Drag and drop files here</p>
                  <p className="text-sm text-slate-500">PDF, DOCX, PPTX up to 25 MB.</p>
                  {file && (
                    <p className="text-sm text-slate-600">Selected: {file.name}</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {uploading && (
                <div className="rounded-2xl bg-slate-100 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>
                      {uploadProgress < 100
                        ? "Uploading & extracting…"
                        : "Generating AI explanation…"}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={uploading}
                disabled={!file}
              >
                Upload Document
              </Button>
            </form>
          </Card>

          {/* ---- Result panel (appears after successful upload) ---- */}
          <UploadResultPanel
            result={uploadResult}
            onDismiss={() => setUploadResult(null)}
            onDelete={handleDelete}
            onDownload={handleDownload}
            deleting={deleting}
          />
        </div>

        {/* ---- Right column: document table ---- */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your documents</h2>
              <p className="text-sm text-slate-500">
                Manage uploads, downloads, and file history in one place.
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, file, or type"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <Card title="Uploaded files">
            {loading ? (
              <div className="space-y-3">
                <Skeleton variant="text" className="h-12" />
                <Skeleton variant="text" className="h-12" />
                <Skeleton variant="text" className="h-12" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <EmptyState
                title={searchTerm ? "No matching documents" : "No uploaded documents yet"}
                description={
                  searchTerm
                    ? "Try another search term."
                    : "Upload your first study file to get started."
                }
                icon={FileText}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Title</th>
                      <th className="px-4 py-3 text-left font-semibold">Filename</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                      <th className="px-4 py-3 text-left font-semibold">Uploaded</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 text-slate-900 font-medium">
                          {doc.title}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {doc.filename || `${doc.title}.${doc.file_type}`}
                        </td>
                        <td className="px-4 py-4 uppercase text-slate-500">
                          {doc.file_type}
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/documents/${doc.id}/extracted`)}
                              className="flex items-center gap-1 py-1.5 px-3 text-xs"
                            >
                              <BookOpen size={12} />
                              <span>Text</span>
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/documents/${doc.id}/explanation`)}
                              className="flex items-center gap-1 py-1.5 px-3 text-xs"
                            >
                              <Sparkles size={12} className="text-purple-500" />
                              <span>AI Guide</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                              className="flex items-center gap-1 py-1.5 px-3 text-xs"
                            >
                              <Download size={12} />
                              <span>Download</span>
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              loading={deleting === doc.id}
                              onClick={() => handleDelete(doc.id)}
                              className="flex items-center gap-1 py-1.5 px-3 text-xs"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
