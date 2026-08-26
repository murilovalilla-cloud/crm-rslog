// Rotas de atividades / calendário: /api/activities

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { activityCompleteSchema, activityCreateSchema, activityUpdateSchema } from "../validation/schemas";
import { computeActivityAlert, emptyToNull, genId, isAdmin, nowIso, requireOpportunityAccess, writeAudit } from "../utils";

const activities = new Hono<AppEnv>();

const TYPE_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  visita: "Visita",
  followup: "Follow-up",
  outro: "Atividade",
};

interface ActivityRow {
  id: string;
  opportunity_id: string;
  type: string;
  title: string;
  description: string | null;
  due_at: string;
  completed_at: string | null;
  status: string;
  owner_id: string | null;
}

// GET /api/activities?from=&to=&owner_id=&status=&opportunity_id=
// Alimenta o calendário. "from"/"to" são datas ISO (inclusive).
activities.get("/", async (c) => {
  const url = new URL(c.req.url);
  const user = c.get("user");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  // Vendedores só veem as próprias atividades no calendário; administradores
  // continuam podendo filtrar por qualquer responsável.
  const ownerId = isAdmin(user) ? url.searchParams.get("owner_id")?.trim() : user.id;
  const status = url.searchParams.get("status")?.trim();
  const opportunityId = url.searchParams.get("opportunity_id")?.trim();

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (from) {
    conditions.push("a.due_at >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("a.due_at <= ?");
    params.push(to);
  }
  if (ownerId) {
    conditions.push("a.owner_id = ?");
    params.push(ownerId);
  }
  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }
  if (opportunityId) {
    conditions.push("a.opportunity_id = ?");
    params.push(opportunityId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, o.title as opportunity_title, c.name as company_name, u.name as owner_name
     FROM activities a
     JOIN opportunities o ON o.id = a.opportunity_id
     JOIN companies c ON c.id = o.company_id
     LEFT JOIN users u ON u.id = a.owner_id
     ${where}
     ORDER BY a.due_at ASC`
  )
    .bind(...params)
    .all<ActivityRow & Record<string, unknown>>();

  const data = results.map((row) => {
    const alert = computeActivityAlert(row);
    return { ...row, alert_level: alert.level, overdue_days: alert.overdueDays };
  });

  return c.json({ data });
});

activities.get("/:id", async (c) => {
  const user = c.get("user");
  const activity = await c.env.DB.prepare(
    `SELECT a.*, o.title as opportunity_title, c.name as company_name, u.name as owner_name
     FROM activities a
     JOIN opportunities o ON o.id = a.opportunity_id
     JOIN companies c ON c.id = o.company_id
     LEFT JOIN users u ON u.id = a.owner_id
     WHERE a.id = ?`
  )
    .bind(c.req.param("id"))
    .first<ActivityRow & Record<string, unknown>>();

  if (!activity) return c.json({ error: "Atividade não encontrada." }, 404);
  if (!isAdmin(user) && activity.owner_id !== user.id) {
    return c.json({ error: "Você não tem permissão para acessar esta atividade." }, 403);
  }
  const alert = computeActivityAlert(activity);
  return c.json({ data: { ...activity, alert_level: alert.level, overdue_days: alert.overdueDays } });
});

activities.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = activityCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  const user = c.get("user");
  const access = await requireOpportunityAccess(c.env.DB, input.opportunity_id, user);
  if (!access.ok) return c.json({ error: access.error }, access.status);
  const id = genId("act");
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO activities (id, opportunity_id, type, title, description, due_at, status, owner_id, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.opportunity_id,
      input.type,
      input.title.trim(),
      emptyToNull(input.description ?? null),
      new Date(input.due_at).toISOString(),
      input.owner_id || user.id,
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await writeAudit(c.env.DB, { entityType: "activity", entityId: id, action: "create", user });

  const created = await c.env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first();
  return c.json({ data: created }, 201);
});

activities.put("/:id", async (c) => {
  const id = c.req.param("id");
  const authUser = c.get("user");
  const existing = await c.env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Atividade não encontrada." }, 404);
  if (!isAdmin(authUser) && existing.owner_id !== authUser.id) {
    return c.json({ error: "Você não tem permissão para editar esta atividade." }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = activityUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === "due_at" && typeof value === "string") {
      normalized[key] = new Date(value).toISOString();
    } else {
      normalized[key] = typeof value === "string" ? emptyToNull(value) : value;
    }
  }

  const user = authUser;
  if (Object.keys(normalized).length > 0) {
    const now = nowIso();
    const setClauses = Object.keys(normalized)
      .map((key) => `${key} = ?`)
      .concat(["updated_at = ?", "updated_by = ?"]);
    const values = [...Object.values(normalized), now, user.id, id];

    await c.env.DB.prepare(`UPDATE activities SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    await writeAudit(c.env.DB, { entityType: "activity", entityId: id, action: "update", user });
  }

  const updated = await c.env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

// PATCH /api/activities/:id/complete — conclui a atividade e registra no
// histórico da oportunidade (aparece na linha do tempo do card).
activities.patch("/:id/complete", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const activity = await c.env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first<ActivityRow>();
  if (!activity) return c.json({ error: "Atividade não encontrada." }, 404);
  if (!isAdmin(user) && activity.owner_id !== user.id) {
    return c.json({ error: "Você não tem permissão para concluir esta atividade." }, 403);
  }
  if (activity.status === "concluida") return c.json({ data: activity });

  const body = await c.req.json().catch(() => ({}));
  const parsed = activityCompleteSchema.safeParse(body ?? {});
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;
  const now = nowIso();
  const completedAt = input.completed_at ? new Date(input.completed_at).toISOString() : now;
  const label = TYPE_LABELS[activity.type] ?? "Atividade";
  const description = input.outcome_note?.trim() || `${label} concluída: ${activity.title}`;

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE activities SET status = 'concluida', completed_at = ?, updated_at = ?, updated_by = ? WHERE id = ?"
    ).bind(completedAt, now, user.id, id),
    c.env.DB.prepare(
      `INSERT INTO activity_history (id, opportunity_id, type, description, activity_id, occurred_at, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      genId("hist"),
      activity.opportunity_id,
      activity.type === "outro" || activity.type === "followup" ? "observacao" : activity.type,
      description,
      id,
      completedAt,
      now,
      user.id
    ),
  ]);

  await writeAudit(c.env.DB, { entityType: "activity", entityId: id, action: "complete", user });

  const updated = await c.env.DB.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

activities.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const existing = await c.env.DB.prepare("SELECT id, title, owner_id FROM activities WHERE id = ?")
    .bind(id)
    .first<{ id: string; title: string; owner_id: string | null }>();
  if (!existing) return c.json({ error: "Atividade não encontrada." }, 404);
  if (!isAdmin(user) && existing.owner_id !== user.id) {
    return c.json({ error: "Você não tem permissão para excluir esta atividade." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM activities WHERE id = ?").bind(id).run();
  await writeAudit(c.env.DB, { entityType: "activity", entityId: id, action: "delete", oldValue: existing.title, user });

  return c.json({ data: { id } });
});

export default activities;
