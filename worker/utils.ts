// Funções utilitárias do backend: geração de IDs, datas, paginação,
// cálculo de alertas de atividade e escrita no audit_log.
//
// São funções puras sempre que possível para facilitar testes automatizados
// (ver tests/worker).

import type { AlertLevel, AuthUser } from "./types";

/** Gera um identificador único (UUID v4), opcionalmente prefixado. */
export function genId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/** Data/hora atual em ISO-8601 UTC, no mesmo formato usado nas colunas do D1. */
export function nowIso(): string {
  return new Date().toISOString();
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

/** Extrai paginação de uma URL, com limites sãos para evitar listas grandes demais. */
export function parsePagination(
  url: URL,
  defaults: { limit: number; maxLimit: number } = { limit: 25, maxLimit: 100 }
): Pagination {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? String(defaults.limit), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaults.limit, 1), defaults.maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export interface AlertResult {
  level: AlertLevel;
  overdueDays: number;
}

/**
 * Calcula o alerta visual de uma atividade a partir do status e da data prevista:
 *   - "atrasada" (vermelho): pendente e due_at no passado
 *   - "hoje" (amarelo): pendente e due_at é hoje
 *   - "futura" (azul): pendente e due_at no futuro
 *   - "concluida" (verde): status concluída
 *   - null: cancelada ou sem atividade
 *
 * A comparação usa apenas a data (UTC), ignorando o horário, para que
 * "vence hoje" funcione de forma previsível independentemente do fuso do
 * cliente que agendou a atividade.
 */
export function computeActivityAlert(
  activity: { status: string; due_at: string } | null | undefined,
  now: Date = new Date()
): AlertResult {
  if (!activity) return { level: null, overdueDays: 0 };
  if (activity.status === "concluida") return { level: "concluida", overdueDays: 0 };
  if (activity.status === "cancelada") return { level: null, overdueDays: 0 };

  const due = new Date(activity.due_at);
  if (Number.isNaN(due.getTime())) return { level: null, overdueDays: 0 };

  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((today - dueDay) / 86_400_000);

  if (diffDays > 0) return { level: "atrasada", overdueDays: diffDays };
  if (diffDays === 0) return { level: "hoje", overdueDays: 0 };
  return { level: "futura", overdueDays: 0 };
}

/** Insere uma linha no audit_log. Nunca lança — falhas de auditoria não devem derrubar a requisição principal. */
export async function writeAudit(
  db: D1Database,
  params: {
    entityType: string;
    entityId: string;
    action: string;
    fieldName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    user: AuthUser | null;
  }
): Promise<void> {
  const now = nowIso();
  try {
    await db
      .prepare(
        `INSERT INTO audit_log (id, entity_type, entity_id, action, field_name, old_value, new_value, user_id, user_email, occurred_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        genId("aud"),
        params.entityType,
        params.entityId,
        params.action,
        params.fieldName ?? null,
        params.oldValue ?? null,
        params.newValue ?? null,
        params.user?.id ?? null,
        params.user?.email ?? null,
        now,
        now
      )
      .run();
  } catch (err) {
    console.error("Falha ao gravar audit_log", err);
  }
}

/**
 * Compara um objeto "antes" e "depois" e retorna apenas os campos que
 * mudaram, no formato usado pelo audit_log (uma linha por campo alterado).
 * Evita gravar um único blob JSON com o registro inteiro.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): Array<{ field: string; oldValue: string | null; newValue: string | null }> {
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  for (const key of Object.keys(after)) {
    if (!(key in after)) continue;
    const newVal = after[key as keyof T];
    if (newVal === undefined) continue;
    const oldVal = before[key as keyof T];
    const oldStr = oldVal === null || oldVal === undefined ? null : String(oldVal);
    const newStr = newVal === null || newVal === undefined ? null : String(newVal);
    if (oldStr !== newStr) {
      changes.push({ field: key, oldValue: oldStr, newValue: newStr });
    }
  }
  return changes;
}

/** Normaliza string vazia para null (útil após validação de formulários). */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
