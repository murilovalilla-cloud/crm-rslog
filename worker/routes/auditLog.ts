// Rota de consulta à trilha de auditoria: /api/audit-log
//
// Toda alteração relevante do CRM (criação, edição, exclusão, mudança de
// etapa/status etc.) é gravada em audit_log pela função writeAudit (ver
// worker/utils.ts), chamada a partir de cada rota de escrita. Esta rota
// apenas consulta esses registros — é somente leitura e restrita a
// administradores (requireAdmin), já que expõe o histórico de ações de
// toda a equipe.

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../auth";
import { parsePagination } from "../utils";

const auditLog = new Hono<AppEnv>();

auditLog.use("*", requireAdmin);

// GET /api/audit-log?entity_type=&entity_id=&user_id=&action=&date_from=&date_to=&page=&limit=
auditLog.get("/", async (c) => {
  const url = new URL(c.req.url);
  const { page, limit, offset } = parsePagination(url, { limit: 50, maxLimit: 200 });

  const entityType = url.searchParams.get("entity_type")?.trim();
  const entityId = url.searchParams.get("entity_id")?.trim();
  const userId = url.searchParams.get("user_id")?.trim();
  const action = url.searchParams.get("action")?.trim();
  const dateFrom = url.searchParams.get("date_from")?.trim();
  const dateTo = url.searchParams.get("date_to")?.trim();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (entityType) {
    conditions.push("a.entity_type = ?");
    params.push(entityType);
  }
  if (entityId) {
    conditions.push("a.entity_id = ?");
    params.push(entityId);
  }
  if (userId) {
    conditions.push("a.user_id = ?");
    params.push(userId);
  }
  if (action) {
    conditions.push("a.action = ?");
    params.push(action);
  }
  if (dateFrom) {
    conditions.push("a.occurred_at >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    // Inclui o dia inteiro quando o filtro vem apenas como data (YYYY-MM-DD).
    const upper = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo;
    conditions.push("a.occurred_at <= ?");
    params.push(upper);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM audit_log a ${where}`)
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, u.name as user_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.occurred_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all();

  return c.json({ data: results, page, limit, total: totalRow?.total ?? 0 });
});

// GET /api/audit-log/entity-types — valores distintos de entity_type já
// gravados, para preencher o filtro no frontend sem precisar de uma lista
// fixa que fica desatualizada conforme o sistema evolui.
auditLog.get("/entity-types", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type ASC"
  ).all<{ entity_type: string }>();
  return c.json({ data: results.map((r) => r.entity_type) });
});

export default auditLog;
