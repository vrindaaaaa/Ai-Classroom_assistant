import React from "react";

export default function StatCard({ title, value, icon: Icon, description, trend, color = "indigo" }) {
  const colors = {
    indigo: {
      bg: "bg-indigo-50 text-indigo-600",
      glow: "shadow-indigo-100/50",
    },
    blue: {
      bg: "bg-blue-50 text-blue-600",
      glow: "shadow-blue-100/50",
    },
    violet: {
      bg: "bg-violet-50 text-violet-600",
      glow: "shadow-violet-100/50",
    },
    emerald: {
      bg: "bg-emerald-50 text-emerald-600",
      glow: "shadow-emerald-100/50",
    },
    amber: {
      bg: "bg-amber-50 text-amber-600",
      glow: "shadow-amber-100/50",
    },
  };

  const selectedColor = colors[color] || colors.indigo;

  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">{title}</span>
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedColor.bg} shadow-sm`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
        {trend && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
