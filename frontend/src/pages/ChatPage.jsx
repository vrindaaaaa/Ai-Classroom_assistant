import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, FileText, AlertCircle, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import chatService from "../services/chatService";
import uploadService from "../services/uploadService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";

export default function ChatPage() {
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await uploadService.getDocuments();
        setDocuments(data || []);
        if (data && data.length > 0 && !selectedDocId) {
          setSelectedDocId(String(data[0].id));
        }
      } catch (err) {
        console.error("Failed to fetch documents for chat", err);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchDocuments();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { text: input, isUser: true, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    const questionText = input;
    setInput("");
    setLoading(true);

    try {
      const conversationHistory = messages
        .filter((msg) => !msg.isError)
        .slice(-6)
        .map((msg) => ({
          role: msg.isUser ? "user" : "assistant",
          content: msg.text,
        }));
      const data = await chatService.askQuestion(questionText, selectedDocId ? parseInt(selectedDocId) : undefined, conversationHistory);
      const botMessage = {
        text: data.answer,
        isUser: false,
        sources: data.sources || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat request failed", error);
      let errorMsg = "Unable to get an answer right now.";
      if (error.response?.status === 404) {
        errorMsg = error.response?.data?.detail || "No relevant document details found in your workspace database. Please upload documents in the Documents panel first.";
      } else if (error.response?.status === 422) {
        errorMsg = error.response?.data?.detail || "The selected document has no extractable text.";
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      addToast(errorMsg, "error");

      const botErrorMessage = {
        text: errorMsg,
        isUser: false,
        isError: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botErrorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleDocChange = (e) => {
    setSelectedDocId(e.target.value);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      
      {/* Page Header */}
      <PageHeader
        title="Document AI Chat"
        description="Chat directly with your uploaded notes and textbooks. Pull references automatically."
      />

      {/* Document Selector */}
      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <label htmlFor="chat-doc-select" className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            <FileText size={16} className="inline mr-1" />
            Select Document:
          </label>
          <div className="relative flex-1">
            <select
              id="chat-doc-select"
              value={selectedDocId}
              onChange={handleDocChange}
              disabled={loadingDocs || documents.length === 0}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none transition-all duration-200 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none"
            >
              <option value="">— Select a document —</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title || doc.filename} ({doc.file_type?.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        {documents.length === 0 && !loadingDocs && (
          <p className="text-xs text-slate-500 mt-2">No documents uploaded yet. Upload a document first.</p>
        )}
      </Card>

      {/* Chat Messages Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 border border-slate-100 rounded-2xl bg-white dark:bg-slate-900 mt-4 shadow-sm">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full max-w-md mx-auto p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ask your materials</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Type a question below to analyze and query details across your selected document.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-4 p-4 rounded-2xl border ${
                  msg.isUser
                    ? "bg-indigo-50/10 border-slate-100/50 justify-end flex-row-reverse"
                    : msg.isError
                    ? "bg-red-50/30 border-red-100"
                    : "bg-slate-50/50 border-slate-100"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 font-bold ${
                    msg.isUser
                      ? "bg-slate-100 text-slate-600"
                      : msg.isError
                      ? "bg-red-100 text-red-600"
                      : "bg-indigo-600 text-white"
                  }`}
                >
                  {msg.isUser ? <User size={16} /> : <Sparkles size={16} />}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {msg.isUser ? "You" : "AI Assistant"}
                  </div>
                  {msg.isError ? (
                    <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  ) : (
                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Citations / Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <FileText size={12} /> Sources:
                      </span>
                      {msg.sources.map((source, sIdx) => (
                        <span key={sIdx} className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* AI thinking state */}
            {loading && (
              <div className="flex gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white flex-shrink-0 animate-pulse">
                  <Sparkles size={16} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI Assistant</div>
                  <div className="flex items-center gap-1.5 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Message Form */}
      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          type="text"
          placeholder="Ask a question about chemistry slides, notes, or schedules..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 outline-none text-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 dark:text-white"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!input.trim() || loading}
          className="flex items-center justify-center"
        >
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}
