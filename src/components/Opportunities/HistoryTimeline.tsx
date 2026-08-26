import type { HistoryEntry } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS, formatDateTime } from "@/lib/utils";

const TYPE_ICON: Record<string, string> = {
  ligacao: "📞",
  email: "✉️",
  whatsapp: "💬",
  reuniao: "🤝",
  visita: "🚚",
  cotacao: "📄",
  observacao: "📝",
  mudanca_etapa: "🔀",
  sistema: "⚙️",
};

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum evento registrado ainda.</p>;
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">
            {TYPE_ICON[entry.type] ?? "•"}
          </div>
          <div className="min-w-0 flex-1 border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {ACTIVITY_TYPE_LABELS[entry.type] ?? entry.type}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{formatDateTime(entry.occurred_at)}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-700">{entry.description}</p>
            {entry.created_by_name && <p className="mt-0.5 text-xs text-slate-400">por {entry.created_by_name}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
