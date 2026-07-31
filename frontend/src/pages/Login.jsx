import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import authService from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Login() {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await authService.login(email, password);
      login(data.access_token, data.role);
      addToast("Signed in successfully!", "success");
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Invalid email or password.");
      addToast(err.response?.data?.detail || "Invalid email or password.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      
      {/* Left Column: Form Container */}
      <div className="flex flex-col justify-between w-full lg:w-[45%] p-8 sm:p-12 md:p-20 bg-white">
        
        {/* Header/Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-bold">
            AI
          </div>
          <span className="font-bold text-lg text-slate-900">Educareer AI</span>
        </div>

        {/* Main Form */}
        <div className="my-auto py-10 max-w-md w-full mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back
          </h2>
          <p className="text-slate-500 mt-2">
            Sign in to continue your AI classroom assistant experience.
          </p>

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-3"
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/signup" className="font-bold text-indigo-600 hover:text-indigo-500 transition">
              Create an account
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-400">
          © {new Date().getFullYear()} Educareer AI. All rights reserved.
        </div>
      </div>

      {/* Right Column: AI Showcase/Illustration */}
      <div className="hidden lg:flex flex-col justify-center items-center w-[55%] bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-20 text-white relative overflow-hidden">
        
        {/* Glow Spheres */}
        <div className="absolute top-0 right-0 h-96 w-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-96 w-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-lg text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 mb-8 border border-indigo-500/30">
            <Sparkles size={24} />
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight mb-4 leading-tight">
            Intelligent Learning Redefined
          </h3>
          <p className="text-indigo-200/80 text-lg leading-relaxed mb-8">
            Harness custom study plans, instantaneous quiz generations, and multi-file chat in one clean workspace.
          </p>

          {/* Quick Metrics display */}
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Document Chat</span>
              <p className="mt-1 text-sm text-slate-300 leading-normal">Extract information from slides or text resources.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Quiz Generator</span>
              <p className="mt-1 text-sm text-slate-300 leading-normal">Auto-generate quizzes from your uploaded documents.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}