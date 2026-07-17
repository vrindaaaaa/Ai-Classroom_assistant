import React from "react";
import Button from "./Button";

export default function EmptyState({
  title = "No data available",
  description = "Get started by adding something to this workspace.",
  icon: Icon,
  actionText,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction} className="mt-4">
          {actionText}
        </Button>
      )}
    </div>
  );
}
