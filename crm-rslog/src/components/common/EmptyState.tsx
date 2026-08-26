import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "empty" | "error";
}

export function EmptyState({ title, description, action, tone = "empty" }: EmptyStateProps) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center"
          : "rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center"
      }
    >
      <p className={tone === "error" ? "text-sm font-medium text-red-700" : "text-sm font-medium text-slate-600"}>
        {title}
      </p>
      {description && (
        <p className={tone === "error" ? "mt-1 text-sm text-red-600" : "mt-1 text-sm text-slate-500"}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
