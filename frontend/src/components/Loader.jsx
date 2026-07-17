import React from "react";

export default function Loader({ size = "md", className = "" }) {
  const sizes = {
    sm: "h-4 w-4 stroke-[3px]",
    md: "h-8 w-8 stroke-[2.5px]",
    lg: "h-12 w-12 stroke-[2px]",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`animate-spin text-indigo-600 ${sizes[size]}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export function Skeleton({ variant = "text", className = "" }) {
  const base = "animate-pulse bg-slate-200 rounded";

  const variants = {
    text: "h-4 w-full",
    title: "h-6 w-3/4 mb-4",
    avatar: "h-12 w-12 rounded-full",
    card: "h-40 w-full rounded-2xl",
  };

  return <div className={`${base} ${variants[variant]} ${className}`} />;
}
