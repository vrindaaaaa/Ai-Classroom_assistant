import React, { useEffect, useState } from "react";
import { BarChart3, Award, Flame, AlertTriangle, HelpCircle } from "lucide-react";
import dashboardService from "../services/dashboardService";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import { Skeleton } from "../components/Loader";

export default function AnalyticsPage() {
  const { addToast } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getAnalytics();
        setAnalytics(data);
      } catch (error) {
        console.error("Failed to load analytics details", error);
        addToast("Failed to load analytics metrics", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title="Learning Analytics"
        description="Detailed review of your quiz scores, active study streaks, and AI identified weakness topics."
      />

      {/* Analytics Stats Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        {loading ? (
          <>
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              title="Average Quiz Score"
              value={`${analytics?.average_score ?? 0}%`}
              icon={Award}
              color="indigo"
              description="Overall accuracy across quizzes"
            />
            <StatCard
              title="Learning Streak"
              value={`${analytics?.learning_streak ?? 0} Days`}
              icon={Flame}
              color="amber"
              description="Consecutive days studying notes"
            />
            <StatCard
              title="Total Quizzes Evaluated"
              value={analytics?.quiz_count ?? 0}
              icon={HelpCircle}
              color="violet"
              description="Completed quizzes tracked"
            />
          </>
        )}
      </div>

      {/* Weak topics / Focus list */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          title="Concept Weaknesses"
          subtitle="AI flagged topics requiring further review based on incorrect quiz answers"
        >
          {loading ? (
            <div className="space-y-2">
              <Skeleton variant="text" className="h-10" />
              <Skeleton variant="text" className="h-10" />
            </div>
          ) : !analytics?.weak_topics || analytics.weak_topics.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No weak topics identified yet. Complete quizzes to populate insights.</p>
          ) : (
            <div className="space-y-2.5">
              {analytics.weak_topics.map((topic, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-100 bg-amber-50/20 text-amber-900"
                >
                  <AlertTriangle className="text-amber-500 flex-shrink-0" size={16} />
                  <span className="text-sm font-semibold">{topic}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Charts Mock / Visuals Section */}
        <Card
          title="Performance Chart"
          subtitle="Graphical distribution of topic performance"
        >
          {loading ? (
            <Skeleton variant="card" className="h-44" />
          ) : (
            <div className="flex flex-col justify-end h-44 pt-6">
              <div className="flex items-end justify-between gap-4 h-full px-2 border-b border-slate-100 pb-2">
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div
                    className="w-full bg-indigo-600 rounded-t-lg transition-all duration-500"
                    style={{ height: `${analytics?.average_score ?? 0}%` }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 truncate">Quiz Score</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div
                    className="w-full bg-slate-300 dark:bg-slate-700 rounded-t-lg transition-all duration-500"
                    style={{ height: `${(analytics?.quiz_count ? Math.min(analytics.quiz_count * 10, 100) : 0)}%` }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 truncate">Activity</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
