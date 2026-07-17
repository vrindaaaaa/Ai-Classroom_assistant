import React from "react";

export default function Card({
  title,
  subtitle,
  children,
  hoverable = false,
  className = "",
  headerAction,
  ...props
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${
        hoverable ? "hover:shadow-md hover:border-slate-200 transition-all duration-200 hover:-translate-y-0.5" : ""
      } ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
