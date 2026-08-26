import type { AlertLevel } from "./types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Converte um valor monetário digitado no padrão brasileiro (ex.: "18.500,50"
 * ou apenas "18500.5") para number. Retorna null se a string não representar
 * um número válido — quem chama decide se isso é um erro de validação.
 */
export function parseBRLNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Remove separador de milhar (ponto) e troca a vírgula decimal por ponto.
  const normalized = trimmed.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Dias entre hoje e uma data prevista (due_at), truncados por dia em UTC —
 * mesma lógica de computeActivityAlert() no backend (worker/utils.ts), só
 * que aqui usada apenas para o caso "futura": quantos dias faltam até o
 * vencimento. Retorna null se a data for inválida.
 */
export function daysUntilDue(dueAt: string | null | undefined): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((dueDay - today) / 86_400_000);
}

/** Converte um ISO string para o valor esperado por <input type="datetime-local">. */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export const ALERT_LABELS: Record<NonNullable<AlertLevel>, string> = {
  atrasada: "Atrasada",
  hoje: "Vence hoje",
  futura: "Agendada",
  concluida: "Concluída",
};

export const ALERT_CLASSES: Record<NonNullable<AlertLevel>, string> = {
  atrasada: "bg-red-50 text-alert-overdue border border-red-200",
  hoje: "bg-amber-50 text-alert-today border border-amber-200",
  futura: "bg-blue-50 text-alert-upcoming border border-blue-200",
  concluida: "bg-green-50 text-alert-done border border-green-200",
};

export const ALERT_DOT_CLASSES: Record<NonNullable<AlertLevel>, string> = {
  atrasada: "bg-alert-overdue",
  hoje: "bg-alert-today",
  futura: "bg-alert-upcoming",
  concluida: "bg-alert-done",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  visita: "Visita",
  followup: "Follow-up",
  outro: "Outro",
  cotacao: "Cotação",
  observacao: "Observação",
  mudanca_etapa: "Mudança de etapa",
  sistema: "Sistema",
};

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}
