import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  const areaId = id ?? rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={areaId} className="field-label">
          {label}
        </label>
      )}
      <textarea id={areaId} className={cn("field-input min-h-[80px]", error && "border-red-400", className)} {...rest} />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
