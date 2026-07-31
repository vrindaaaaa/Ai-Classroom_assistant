import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  HelpCircle,
  Calendar,
  Sparkles,
  Flame,
  Award,
  ArrowRight,
  Plus,
} from "lucide-react";
import dashboardService from "../services/dashboardService";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import { Skeleton } from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const dashRes = await dashboardService.getMetrics();
        setData(dashRes);
      } catch (error) {
        console.error("Failed to load dashboard metrics", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title={data?.message ? data.message : user?.name ? `Welcome back, ${user.name}` : "Welcome back"}
        description="Your AI Classroom Assistant is fully configured and ready for your next study session."
      >
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl transition shadow-md shadow-indigo-100 dark:shadow-none text-sm cursor-pointer"
        >
          <Plus size={16} />
          Upload Document
        </Link>
      </PageHeader>

      {/* Stats Cards Section */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              title="Uploaded Documents"
              value={data?.total_documents ?? 0}
              icon={FileText}
              color="indigo"
              description="PDFs, note files, worksheets"
            />
            <StatCard
              title="Quizzes Generated"
              value={data?.total_quizzes ?? 0}
              icon={HelpCircle}
              color="violet"
              description="Mock tests and practice reviews"
            />
            <StatCard
              title="Study Plans"
              value={data?.total_study_plans ?? 0}
              icon={Calendar}
              color="emerald"
              description="Active timelines and schedules"
            />
            <StatCard
              title="Learning Streak"
              value={data?.learning_streak ? `${data.learning_streak} Days` : "0 Days"}
              icon={Flame}
              color="amber"
              description="Consecutive practice days"
              trend={data?.learning_streak > 0 ? "Active" : null}
            />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Left Side: Recent Activity & Quick Actions (takes 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Uploads */}
          <Card
            title="Recent Uploads"
            subtitle="Your most recently digitized learning documents"
            headerAction={
              <Link to="/upload" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1">
                View all <ArrowRight size={14} />
              </Link>
            }
          >
            {loading ? (
              <div className="space-y-3">
                <Skeleton variant="text" className="h-10" />
                <Skeleton variant="text" className="h-10" />
              </div>
            ) : !data?.recent_uploads || data.recent_uploads.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No documents uploaded yet. Add files to generate study materials.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recent_uploads.map((doc, idx) => (
                  <div key={idx} className="py-3.5 flex items-start gap-3.5 first:pt-0 last:pb-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100 flex-shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{doc.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        Type: {doc.file_type?.toUpperCase()} • Uploaded: {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Actions / Recommendations */}
          <Card
            title="Recommended Focus Areas"
            subtitle="AI generated insights based on your learning history"
          >
            {loading ? (
              <div className="space-y-3">
                <Skeleton variant="text" className="h-12" />
                <Skeleton variant="text" className="h-12" />
              </div>
            ) : !data?.recommendations || data.recommendations.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No recommendations available. Complete a quiz to receive personalized focus areas.</p>
            ) : (
              <div className="space-y-3" id="recommendations">
                {data.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-indigo-50/50 bg-indigo-50/20 text-indigo-950 flex items-start gap-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-900">{rec.topic}</h5>
                      <p className="text-xs text-slate-600 mt-1">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Side: Performance Summary & Upcoming Milestones (takes 1 col) */}
        <div className="space-y-6">
          
          {/* Performance Card */}
          <Card title="Learning Overview" subtitle="Track your average scores">
            {loading ? (
              <div className="flex flex-col items-center py-6">
                <Skeleton variant="avatar" className="h-24 w-24 mb-4" />
                <Skeleton variant="text" className="h-6 w-32" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="relative flex items-center justify-center h-28 w-28 rounded-full bg-slate-50 border-4 border-indigo-600 text-indigo-600 font-extrabold text-2xl shadow-sm">
                  {data?.average_score ?? 0}%
                </div>
                <h4 className="mt-4 font-bold text-slate-900 text-base">Average Quiz Accuracy</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-[180px]">
                  Based on your saved test results.
                </p>
                <Link
                  to="/quizzes"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Start Practice Quiz
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Card>

          {/* Quick Actions Links Grid */}
          <Card title="Quick Tool Access">
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold">
              <Link to="/chat" className="p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <Sparkles className="mx-auto text-indigo-600 mb-1.5" size={18} />
                AI Chat
              </Link>
              <Link to="/transcription" className="p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <Plus className="mx-auto text-emerald-600 mb-1.5" size={18} />
                Transcribe
              </Link>
              <Link to="/planner" className="p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <Calendar className="mx-auto text-amber-600 mb-1.5" size={18} />
                Planner
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
