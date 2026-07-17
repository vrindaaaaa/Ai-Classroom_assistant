import React from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Sparkles, FileText, CheckCircle, Brain, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  // If already logged in, skip landing and go straight to workspace
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden">
      
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.15),_transparent_50%)] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_bottom_right,_rgba(139,92,246,0.08),_transparent_50%)] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="relative max-w-7xl mx-auto px-6 h-20 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-bold shadow-lg shadow-indigo-200">
            AI
          </div>
          <span className="font-bold text-xl text-slate-900">Educareer AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-950 transition">
            Sign In
          </Link>
          <Link to="/signup" className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-100">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 flex flex-col lg:flex-row items-center gap-16 z-10">
        
        {/* Left: Text and CTA */}
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200 bg-white text-indigo-700 text-xs font-semibold shadow-sm mb-6">
            <Sparkles size={14} className="animate-pulse" />
            AI Classroom Assistant
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Turn your study materials into <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">intelligent</span> workspaces.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
            Upload notes, converse directly with files, generate quizzes, build custom planners, transcribe audio, and review analytics instantly.
          </p>
          <div className="mt-10 flex flex-wrap justify-center lg:justify-start gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all"
            >
              Start Free Trial
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="px-6 py-3.5 text-base font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl hover:-translate-y-0.5 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Right: Mock UI Showcase */}
        <div className="flex-1 w-full max-w-xl">
          <div className="rounded-3xl border border-white bg-white/70 p-6 shadow-2xl shadow-slate-200/50 backdrop-blur-md relative">
            <div className="absolute -top-3 -right-3 h-10 w-10 bg-violet-500 rounded-2xl flex items-center justify-center text-white shadow-lg animate-bounce">
              <Brain size={20} />
            </div>
            
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="text-indigo-600" size={20} />
              Interactive Workspaces
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Upload Notes", text: "PDFs, PPTX, image summaries", icon: FileText, color: "indigo" },
                { title: "RAG Document Chat", text: "Ask and pull exact context source", icon: Sparkles, color: "violet" },
                { title: "Generate Quizzes", text: "Practice papers on your content", icon: CheckCircle, color: "emerald" },
                { title: "Progress Analytics", text: "Highlight and track average score", icon: Brain, color: "blue" },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icon size={16} />
                      </div>
                      <span className="font-bold text-sm text-slate-900">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
