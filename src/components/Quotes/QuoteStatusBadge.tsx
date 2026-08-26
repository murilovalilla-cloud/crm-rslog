import type { QuoteStatus } from "@/lib/types";
import { Badge } from "@/components/common/Badge";

const LABELS: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
};

const CLASSES: Record<QuoteStatus, string> = {
  rascunho: "bg-slate-100 text-slate-600 border border-slate-200",
  enviada: "bg-blue-50 text-alert-upcoming border border-blue-200",
  aprovada: "bg-green-50 text-alert-done border border-green-200",
  recusada: "bg-red-50 text-alert-overdue border border-red-200",
  expirada: "bg-amber-50 text-alert-today border border-amber-200",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge className={CLASSES[status]}>{LABELS[status]}</Badge>;
}

export const QUOTE_STATUS_OPTIONS: Array<{ value: QuoteStatus; label: string }> = [
  { value: "rascunho", label: "Rascunho" },
  { value: "enviada", label: "Enviada" },
  { value: "aprovada", label: "Aprovada" },
  { value: "recusada", label: "Recusada" },
  { value: "expirada", label: "Expirada" },
];
