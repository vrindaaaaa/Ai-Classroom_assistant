import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import authService from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Signup() {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await authService.register(name, email, password, role);
      login(data.access_token, data.role);
      addToast("Account created successfully!", "success");
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Unable to create account.");
      addToast(err.response?.data?.detail || "Unable to create account.", "error");
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
            Create account
          </h2>
          <p className="text-slate-500 mt-2">
            Start building your intelligent classroom workspace.
          </p>

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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

            {/* Role selection dropdown */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Account Type</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none transition-all duration-200 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-3"
              loading={loading}
            >
              Get Started
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-500 transition">
              Sign In
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
            Personalized Study Companion
          </h3>
          <p className="text-indigo-200/80 text-lg leading-relaxed mb-8">
            Create automated schedules, customize difficulty settings, transcribe lectures, and interact with all course content with cutting-edge AI.
          </p>

          {/* Quick info display */}
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Smart Quizzer</span>
              <p className="mt-1 text-sm text-slate-300 leading-normal">Generate practice tests customized to your notes.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Lecture Summaries</span>
              <p className="mt-1 text-sm text-slate-300 leading-normal">Whisper transcriptions summarize audios instantly.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}