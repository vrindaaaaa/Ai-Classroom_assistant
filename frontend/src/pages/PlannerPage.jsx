import React, { useState } from "react";
import { Calendar, CalendarDays, Sparkles, BookOpen } from "lucide-react";
import plannerService from "../services/plannerService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";

export default function PlannerPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [loading, setLoading] = useState(false);
  const [planSteps, setPlanSteps] = useState([]); // list of { day, focus, hours }
  const [planTitle, setPlanTitle] = useState("");

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    if (!title || !examDate || !hoursPerDay) {
      addToast("Please fill in all plan inputs.", "warning");
      return;
    }

    setLoading(true);
    setPlanSteps([]);
    setPlanTitle("");

    try {
      const data = await plannerService.generatePlan(
        user?.id || 1,
        title,
        examDate,
        hoursPerDay
      );
      if (data && data.steps) {
        setPlanSteps(data.steps);
        setPlanTitle(data.title || title);
        addToast("Study plan generated successfully!", "success");
      } else {
        addToast("Failed to compile study plan steps.", "error");
      }
    } catch (error) {
      console.error("Planner generation failed", error);
      addToast("Could not generate study schedule", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title="Study Planner"
        description="Input your exam target date and daily hours to build a custom day-by-day study syllabus."
      />

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        
        {/* Left Side: Parameters Form (takes 1 col) */}
        <Card title="Plan Parameters">
          <form onSubmit={handleGeneratePlan} className="space-y-4">
            <Input
              label="Plan / Topic Title"
              placeholder="e.g. Midterm Physics Revision"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />

            <Input
              label="Exam Target Date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              disabled={loading}
              required
            />

            <Input
              label="Study Hours Per Day"
              type="number"
              min="1"
              max="12"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              disabled={loading}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              loading={loading}
            >
              Generate Study Plan
            </Button>
          </form>
        </Card>

        {/* Right Side: Study Plan timeline sheet (takes 2 cols) */}
        <div className="lg:col-span-2">
          {loading ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4 animate-pulse">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">Compiling study schedules...</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                Laying out step guides, sizing daily milestones, and structuring revisions.
              </p>
            </Card>
          ) : planSteps.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4">
                <CalendarDays size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">No active planner</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-1">
                Set your exam goals and daily hours on the left to see your study route steps.
              </p>
            </Card>
          ) : (
            <Card title={planTitle} subtitle="Chronological Study Timeline">
              <div className="relative border-l border-slate-100 pl-6 ml-3 space-y-6">
                {planSteps.map((step, idx) => (
                  <div key={step.day || idx} className="relative">
                    
                    {/* Circle Indicator */}
                    <div className="absolute -left-[31px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 text-white shadow ring-4 ring-white" />

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-sm text-indigo-600">{step.day}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {step.hours || `${hoursPerDay} hours`}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-2">
                        {step.focus}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
