import React, { useEffect, useState } from "react";
import { BarChart3, Award, Flame, AlertTriangle, HelpCircle, FileText, CalendarDays, TrendingUp, Activity, Target, Trophy, Star, BookOpen, Lightbulb, Zap } from "lucide-react";
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

  const renderEmptyState = (message) => (
    <p className="text-sm text-slate-500 py-4">{message}</p>
  );

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title="Learning Analytics"
        description="Detailed review of your quiz scores, active study streaks, and AI identified weakness topics."
      />

      {/* Analytics Stats Cards */}
      <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          <>
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              title="Average Score"
              value={`${analytics?.average_score ?? 0}%`}
              icon={Award}
              color="indigo"
              description="Overall accuracy"
            />
            <StatCard
              title="Learning Streak"
              value={`${analytics?.learning_streak ?? 0} Days`}
              icon={Flame}
              color="amber"
              description="Consecutive days"
            />
            <StatCard
              title="Total Quizzes"
              value={analytics?.total_quizzes ?? 0}
              icon={HelpCircle}
              color="violet"
              description="Completed quizzes"
            />
            <StatCard
              title="Documents"
              value={analytics?.documents_uploaded ?? 0}
              icon={FileText}
              color="emerald"
              description="Files uploaded"
            />
            <StatCard
              title="Study Plans"
              value={analytics?.study_plans ?? 0}
              icon={CalendarDays}
              color="rose"
              description="Plans generated"
            />
            <StatCard
              title="Study Hours"
              value={analytics?.study_hours ?? 0}
              icon={BookOpen}
              color="sky"
              description="Total hours planned"
            />
          </>
        )}
      </div>

      {/* Goal Completion Progress */}
      <Card
        title="Goal Completion"
        subtitle="Track your progress towards learning milestones"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="text" className="h-8" />
            <Skeleton variant="text" className="h-8" />
            <Skeleton variant="text" className="h-8" />
          </div>
        ) : !analytics?.goals || analytics.goals.length === 0 ? (
          renderEmptyState("No goals set yet. Start learning to see your progress!")
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.goals.map((goal) => (
              <div key={goal.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-900">{goal.title}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    goal.completed 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {goal.completed ? "Completed" : `${goal.percentage}%`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      goal.completed ? "bg-emerald-500" : `bg-${goal.color}-600`
                    }`}
                    style={{ width: `${goal.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {goal.current} / {goal.target} {goal.unit}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Performance Chart & Document Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          title="Performance Trend"
          subtitle="Quiz scores over time"
        >
          {loading ? (
            <Skeleton variant="card" className="h-64" />
          ) : !analytics?.performance_chart || analytics.performance_chart.length === 0 ? (
            renderEmptyState("No quiz data available yet. Complete quizzes to see your progress.")
          ) : (
            <div className="flex flex-col justify-end h-64 pt-6">
              <div className="flex items-end justify-between gap-2 h-full px-2 border-b border-slate-100 pb-2 overflow-x-auto">
                {analytics.performance_chart.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5 w-full min-w-[40px]">
                    <div
                      className="w-full bg-indigo-600 rounded-t-lg transition-all duration-500"
                      style={{ height: `${Math.max(4, item.score || 0)}%` }}
                    />
                    <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">
                      {item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Document Performance"
          subtitle="Accuracy per uploaded document"
        >
          {loading ? (
            <div className="space-y-2">
              <Skeleton variant="text" className="h-10" />
              <Skeleton variant="text" className="h-10" />
            </div>
          ) : !analytics?.document_performance || analytics.document_performance.length === 0 ? (
            renderEmptyState("Complete quizzes to see document-wise performance.")
          ) : (
            <div className="space-y-3">
              {analytics.document_performance.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-500">
                      {doc.correct_answers} / {doc.questions_answered} correct
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          doc.accuracy >= 70 ? "bg-emerald-500" : doc.accuracy >= 40 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${doc.accuracy}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold min-w-[40px] text-right ${
                      doc.accuracy >= 70 ? "text-emerald-700" : doc.accuracy >= 40 ? "text-amber-700" : "text-red-700"
                    }`}>
                      {doc.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Weak Topics & Strong Topics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          title="Weak Topics"
          subtitle="Topics needing more practice"
        >
          {loading ? (
            <div className="space-y-2">
              <Skeleton variant="text" className="h-10" />
              <Skeleton variant="text" className="h-10" />
            </div>
          ) : !analytics?.weak_topics || analytics.weak_topics.length === 0 ? (
            renderEmptyState("No weak topics identified yet. Complete quizzes to populate insights.")
          ) : (
            <div className="space-y-3">
              {analytics.weak_topics.map((topic, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-amber-100 bg-amber-50/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="text-amber-500 flex-shrink-0" size={16} />
                      <span className="text-sm font-semibold text-slate-900">{topic.topic}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                      {topic.accuracy}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-2.5 ml-[28px]">
                    <span className="text-xs text-slate-500">
                      {topic.incorrect} incorrect
                    </span>
                    <span className="text-xs text-slate-400">
                      {topic.total} total
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-amber-500"
                      style={{ width: `${topic.accuracy}%` }}
                    />
                  </div>
                  {topic.recommendation && (
                    <p className="text-xs text-slate-600 leading-relaxed bg-white/60 rounded-lg p-2.5 border border-amber-50">
                      <span className="font-semibold text-amber-700">Recommendation:</span> {topic.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Strong Topics"
          subtitle="Concepts you have consistently answered correctly"
        >
          {loading ? (
            <div className="space-y-2">
              <Skeleton variant="text" className="h-10" />
              <Skeleton variant="text" className="h-10" />
            </div>
          ) : !analytics?.strong_topics || analytics.strong_topics.length === 0 ? (
            renderEmptyState("Keep taking quizzes to build your strong topics list.")
          ) : (
            <div className="space-y-3">
              {analytics.strong_topics.map((topic, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="text-emerald-500 flex-shrink-0" size={16} />
                      <span className="text-sm font-semibold text-slate-900">{topic.topic}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      {topic.accuracy}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-2.5 ml-[28px]">
                    <span className="text-xs text-slate-500">
                      {topic.correct} correct
                    </span>
                    <span className="text-xs text-slate-400">
                      {topic.total} total
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                      style={{ width: `${topic.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AI Insights */}
      <Card
        title="AI Insights"
        subtitle="Personalized analysis of your learning patterns"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="text" className="h-12" />
            <Skeleton variant="text" className="h-12" />
            <Skeleton variant="text" className="h-12" />
          </div>
        ) : !analytics?.ai_insights || analytics.ai_insights.length === 0 ? (
          renderEmptyState("Complete more quizzes to receive AI-powered insights.")
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {analytics.ai_insights.map((insight, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${
                  insight.priority === "high"
                    ? "border-red-100 bg-red-50/20"
                    : insight.priority === "medium"
                    ? "border-amber-100 bg-amber-50/20"
                    : "border-emerald-100 bg-emerald-50/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
                    insight.type === "strength" ? "bg-emerald-100 text-emerald-600" :
                    insight.type === "weakness" ? "bg-red-100 text-red-600" :
                    insight.type === "improvement" ? "bg-amber-100 text-amber-600" :
                    "bg-indigo-100 text-indigo-600"
                  }`}>
                    {insight.type === "strength" ? <TrendingUp size={16} /> :
                     insight.type === "weakness" ? <AlertTriangle size={16} /> :
                     insight.type === "improvement" ? <Target size={16} /> :
                     <Lightbulb size={16} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{insight.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Recommendations */}
      <Card
        title="AI Recommendations"
        subtitle="Personalized next steps to boost your learning"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="text" className="h-12" />
            <Skeleton variant="text" className="h-12" />
            <Skeleton variant="text" className="h-12" />
          </div>
        ) : !analytics?.ai_recommendations || analytics.ai_recommendations.length === 0 ? (
          renderEmptyState("Complete more activities to receive personalized recommendations.")
        ) : (
          <div className="space-y-3">
            {analytics.ai_recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 flex-shrink-0">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{rec.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{rec.description}</p>
                    <p className="text-xs font-medium text-indigo-700 mt-1.5">
                      Action: {rec.action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Achievement Badges */}
      <Card
        title="Achievements"
        subtitle="Milestones you've unlocked on your learning journey"
      >
        {loading ? (
          <div className="flex gap-3">
            <Skeleton variant="card" className="h-20 w-20" />
            <Skeleton variant="card" className="h-20 w-20" />
            <Skeleton variant="card" className="h-20 w-20" />
          </div>
        ) : !analytics?.achievements || analytics.achievements.length === 0 ? (
          renderEmptyState("No achievements yet. Keep learning to unlock badges!")
        ) : (
          <div className="flex flex-wrap gap-3">
            {analytics.achievements.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-amber-100 bg-amber-50/30 w-28"
                title={badge.description}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  {badge.icon === "Trophy" ? <Trophy size={20} /> :
                   badge.icon === "Star" ? <Star size={20} /> :
                   badge.icon === "Flame" ? <Flame size={20} /> :
                   badge.icon === "Award" ? <Award size={20} /> :
                   badge.icon === "FileText" ? <FileText size={20} /> :
                   badge.icon === "CalendarDays" ? <CalendarDays size={20} /> :
                   badge.icon === "HelpCircle" ? <HelpCircle size={20} /> :
                   <Award size={20} />}
                </div>
                <span className="text-[10px] font-semibold text-slate-700 text-center leading-tight">{badge.title}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card
        title="Recent Activity"
        subtitle="Your latest actions across the platform"
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="text" className="h-8" />
            <Skeleton variant="text" className="h-8" />
            <Skeleton variant="text" className="h-8" />
          </div>
        ) : !analytics?.recent_activity || analytics.recent_activity.length === 0 ? (
          renderEmptyState("No activity yet. Upload documents, complete quizzes, or generate study plans to see activity here.")
        ) : (
          <div className="space-y-2">
            {analytics.recent_activity.map((activity, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
                  <Activity size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{activity.title}</p>
                  {activity.date && (
                    <p className="text-xs text-slate-500">
                      {new Date(activity.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  {activity.type === "upload" ? "Upload" : activity.type === "quiz" ? "Quiz" : activity.type === "study_plan" ? "Plan" : "Activity"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
