// Rotas de oportunidades: /api/opportunities
// Inclui o endpoint do Kanban, troca de etapa (com histórico + auditoria),
// e as sub-rotas de histórico e notas de cada oportunidade.

import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  applyCadenceSchema,
  historyCreateSchema,
  noteCreateSchema,
  noteUpdateSchema,
  opportunityCreateSchema,
  opportunityStageChangeSchema,
  opportunityUpdateSchema,
  quoteCreateSchema,
} from "../validation/schemas";

const CADENCE_STEP_TO_ACTIVITY_TYPE: Record<string, string> = {
  ligacao: "ligacao",
  email: "email",
  whatsapp: "whatsapp",
  reuniao: "reuniao",
  followup: "followup",
};
import { computeActivityAlert, diffFields, emptyToNull, genId, nowIso, parsePagination, writeAudit } from "../utils";

const opportunities = new Hono<AppEnv>();

interface OpportunityRow {
  id: string;
  company_id: string;
  contact_id: string | null;
  title: string;
  stage_id: string;
  owner_id: string | null;
  value: number | null;
  status: string;
  loss_reason_id: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  contact_name?: string;
  owner_name?: string;
}

// ---------------------------------------------------------------------------
// GET /api/opportunities/kanban — todas as oportunidades agrupáveis por
// etapa, já com a próxima atividade pendente e o alerta calculado.
// ---------------------------------------------------------------------------
opportunities.get("/kanban", async (c) => {
  const url = new URL(c.req.url);
  const ownerId = url.searchParams.get("owner_id")?.trim();
  const search = url.searchParams.get("search")?.trim();

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (ownerId) {
    conditions.push("o.owner_id = ?");
    params.push(ownerId);
  }
  if (search) {
    conditions.push("(c.name LIKE ? OR o.title LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results: stages } = await c.env.DB.prepare(
    "SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY position ASC"
  ).all();

  const { results: rows } = await c.env.DB.prepare(
    `SELECT o.*, c.name as company_name, ct.name as contact_name, u.name as owner_name
     FROM opportunities o
     JOIN companies c ON c.id = o.company_id
     LEFT JOIN contacts ct ON ct.id = o.contact_id
     LEFT JOIN users u ON u.id = o.owner_id
     ${where}
     ORDER BY o.created_at DESC`
  )
    .bind(...params)
    .all<OpportunityRow>();

  const ids = rows.map((r) => r.id);
  const nextActivityByOpp = new Map<string, { id: string; type: string; title: string; due_at: string; status: string }>();

  if (ids.length > 0) {
    // Uma consulta por oportunidade seria N+1; em vez disso, buscamos todas as
    // atividades pendentes das oportunidades listadas e escolhemos a mais
    // próxima de cada uma em memória.
    const placeholders = ids.map(() => "?").join(",");
    const { results: pendingActivities } = await c.env.DB.prepare(
      `SELECT id, opportunity_id, type, title, due_at, status FROM activities
       WHERE opportunity_id IN (${placeholders}) AND status = 'pendente'
       ORDER BY due_at ASC`
    )
      .bind(...ids)
      .all<{ id: string; opportunity_id: string; type: string; title: string; due_at: string; status: string }>();

    for (const act of pendingActivities) {
      if (!nextActivityByOpp.has(act.opportunity_id)) {
        nextActivityByOpp.set(act.opportunity_id, act);
      }
    }
  }

  const data = rows.map((row) => {
    const nextActivity = nextActivityByOpp.get(row.id) ?? null;
    const alert = computeActivityAlert(nextActivity);
    return {
      ...row,
      next_activity: nextActivity,
      alert_level: alert.level,
      overdue_days: alert.overdueDays,
    };
  });

  return c.json({ data: { stages, opportunities: data } });
});

// ---------------------------------------------------------------------------
// GET /api/opportunities — listagem paginada (para relatórios/exportação)
// ---------------------------------------------------------------------------
opportunities.get("/", async (c) => {
  const url = new URL(c.req.url);
  const { page, limit, offset } = parsePagination(url);
  const stageId = url.searchParams.get("stage_id")?.trim();
  const ownerId = url.searchParams.get("owner_id")?.trim();
  const companyId = url.searchParams.get("company_id")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const search = url.searchParams.get("search")?.trim();

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (stageId) {
    conditions.push("o.stage_id = ?");
    params.push(stageId);
  }
  if (ownerId) {
    conditions.push("o.owner_id = ?");
    params.push(ownerId);
  }
  if (companyId) {
    conditions.push("o.company_id = ?");
    params.push(companyId);
  }
  if (status) {
    conditions.push("o.status = ?");
    params.push(status);
  }
  if (search) {
    conditions.push("(o.title LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM opportunities o JOIN companies c ON c.id = o.company_id ${where}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT o.*, c.name as company_name, s.name as stage_name, u.name as owner_name
     FROM opportunities o
     JOIN companies c ON c.id = o.company_id
     JOIN pipeline_stages s ON s.id = o.stage_id
     LEFT JOIN users u ON u.id = o.owner_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all();

  return c.json({ data: results, page, limit, total: totalRow?.total ?? 0 });
});

// ---------------------------------------------------------------------------
// GET /api/opportunities/:id — detalhe completo (usado no painel do card)
// ---------------------------------------------------------------------------
opportunities.get("/:id", async (c) => {
  const id = c.req.param("id");
  const opp = await c.env.DB.prepare(
    `SELECT o.*, c.name as company_name, c.phone as company_phone, s.name as stage_name, u.name as owner_name
     FROM opportunities o
     JOIN companies c ON c.id = o.company_id
     JOIN pipeline_stages s ON s.id = o.stage_id
     LEFT JOIN users u ON u.id = o.owner_id
     WHERE o.id = ?`
  )
    .bind(id)
    .first();

  if (!opp) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const [{ results: contacts }, { results: activities }, { results: history }, { results: notes }, { results: quotes }] =
    await Promise.all([
      c.env.DB.prepare("SELECT * FROM contacts WHERE company_id = ? ORDER BY is_decision_maker DESC, name ASC")
        .bind((opp as { company_id: string }).company_id)
        .all(),
      c.env.DB.prepare("SELECT * FROM activities WHERE opportunity_id = ? ORDER BY due_at ASC").bind(id).all(),
      c.env.DB.prepare(
        `SELECT h.*, u.name as created_by_name, fs.name as from_stage_name, ts.name as to_stage_name
         FROM activity_history h
         LEFT JOIN users u ON u.id = h.created_by
         LEFT JOIN pipeline_stages fs ON fs.id = h.from_stage_id
         LEFT JOIN pipeline_stages ts ON ts.id = h.to_stage_id
         WHERE h.opportunity_id = ? ORDER BY h.occurred_at DESC`
      )
        .bind(id)
        .all(),
      c.env.DB.prepare(
        `SELECT n.*, u.name as created_by_name FROM notes n LEFT JOIN users u ON u.id = n.created_by
         WHERE n.opportunity_id = ? ORDER BY n.created_at DESC`
      )
        .bind(id)
        .all(),
      c.env.DB.prepare("SELECT * FROM quotes WHERE opportunity_id = ? ORDER BY created_at DESC").bind(id).all(),
    ]);

  const pendingActivities = (activities as Array<{ status: string; due_at: string }>).filter((a) => a.status === "pendente");
  const nextActivity = pendingActivities[0] ?? null;
  const alert = computeActivityAlert(nextActivity);

  return c.json({
    data: {
      ...opp,
      contacts,
      activities,
      history,
      notes,
      quotes,
      next_activity: nextActivity,
      alert_level: alert.level,
      overdue_days: alert.overdueDays,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/opportunities
// ---------------------------------------------------------------------------
opportunities.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = opportunityCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  const company = await c.env.DB.prepare("SELECT id FROM companies WHERE id = ?").bind(input.company_id).first();
  if (!company) return c.json({ error: "Empresa informada não existe." }, 400);

  if (input.contact_id) {
    const contact = await c.env.DB.prepare("SELECT id FROM contacts WHERE id = ? AND company_id = ?")
      .bind(input.contact_id, input.company_id)
      .first();
    if (!contact) return c.json({ error: "Contato informado não pertence à empresa selecionada." }, 400);
  }

  let stageId = input.stage_id;
  if (!stageId) {
    const firstStage = await c.env.DB.prepare("SELECT id FROM pipeline_stages WHERE active = 1 ORDER BY position ASC LIMIT 1").first<{ id: string }>();
    if (!firstStage) return c.json({ error: "Nenhuma etapa de funil configurada." }, 500);
    stageId = firstStage.id;
  } else {
    const stage = await c.env.DB.prepare("SELECT id FROM pipeline_stages WHERE id = ? AND active = 1").bind(stageId).first();
    if (!stage) return c.json({ error: "Etapa informada não existe." }, 400);
  }

  const user = c.get("user");
  const id = genId("opp");
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO opportunities (id, company_id, contact_id, title, stage_id, owner_id, value, status, expected_close_date, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'aberta', ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.company_id,
      input.contact_id || null,
      input.title.trim(),
      stageId,
      input.owner_id || user.id,
      input.value ?? null,
      emptyToNull(input.expected_close_date ?? null),
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO activity_history (id, opportunity_id, type, description, occurred_at, created_at, created_by)
     VALUES (?, ?, 'sistema', 'Oportunidade criada.', ?, ?, ?)`
  )
    .bind(genId("hist"), id, now, now, user.id)
    .run();

  await writeAudit(c.env.DB, { entityType: "opportunity", entityId: id, action: "create", user });

  const created = await c.env.DB.prepare("SELECT * FROM opportunities WHERE id = ?").bind(id).first();
  return c.json({ data: created }, 201);
});

// ---------------------------------------------------------------------------
// PUT /api/opportunities/:id — edita campos que não sejam a etapa
// ---------------------------------------------------------------------------
opportunities.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM opportunities WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = opportunityUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;

  if (input.company_id && input.company_id !== existing.company_id) {
    const company = await c.env.DB.prepare("SELECT id FROM companies WHERE id = ?").bind(input.company_id).first();
    if (!company) return c.json({ error: "Empresa informada não existe." }, 400);
  }
  if (input.contact_id) {
    const companyId = input.company_id ?? (existing.company_id as string);
    const contact = await c.env.DB.prepare("SELECT id FROM contacts WHERE id = ? AND company_id = ?")
      .bind(input.contact_id, companyId)
      .first();
    if (!contact) return c.json({ error: "Contato informado não pertence à empresa da oportunidade." }, 400);
  }

  // stage_id é alterado apenas via PATCH /:id/stage, para garantir que
  // histórico e auditoria sejam sempre registrados na troca de etapa.
  const { stage_id: _ignoredStageId, ...rest } = input as Record<string, unknown>;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    normalized[key] = typeof value === "string" ? emptyToNull(value) : value;
  }

  const user = c.get("user");
  if (Object.keys(normalized).length > 0) {
    const now = nowIso();
    const setClauses = Object.keys(normalized)
      .map((key) => `${key} = ?`)
      .concat(["updated_at = ?", "updated_by = ?"]);
    const values = [...Object.values(normalized), now, user.id, id];

    await c.env.DB.prepare(`UPDATE opportunities SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const changes = diffFields(existing, normalized);
    for (const change of changes) {
      await writeAudit(c.env.DB, {
        entityType: "opportunity",
        entityId: id,
        action: "update",
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        user,
      });
    }
  }

  const updated = await c.env.DB.prepare("SELECT * FROM opportunities WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// PATCH /api/opportunities/:id/stage — move o card no Kanban
// ---------------------------------------------------------------------------
opportunities.patch("/:id/stage", async (c) => {
  const id = c.req.param("id");
  const opp = await c.env.DB.prepare("SELECT * FROM opportunities WHERE id = ?").bind(id).first<OpportunityRow>();
  if (!opp) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = opportunityStageChangeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const targetStage = await c.env.DB.prepare("SELECT * FROM pipeline_stages WHERE id = ? AND active = 1")
    .bind(input.stage_id)
    .first<{ id: string; name: string; is_won: number; is_lost: number; is_nutrition: number }>();
  if (!targetStage) return c.json({ error: "Etapa de destino não existe." }, 400);

  if (targetStage.id === opp.stage_id) {
    return c.json({ data: opp });
  }

  if (targetStage.is_lost && !input.loss_reason_id) {
    return c.json({ error: "Informe o motivo da perda ao mover para uma etapa de perda." }, 400);
  }

  const currentStage = await c.env.DB.prepare("SELECT name FROM pipeline_stages WHERE id = ?")
    .bind(opp.stage_id)
    .first<{ name: string }>();

  const user = c.get("user");
  const now = nowIso();

  let status = "aberta";
  let closedAt: string | null = null;
  if (targetStage.is_won) {
    status = "ganha";
    closedAt = now;
  } else if (targetStage.is_lost) {
    status = "perdida";
    closedAt = now;
  } else if (targetStage.is_nutrition) {
    status = "nutricao";
  }

  const statements = [
    c.env.DB.prepare(
      `UPDATE opportunities SET stage_id = ?, status = ?, closed_at = ?, loss_reason_id = ?, updated_at = ?, updated_by = ? WHERE id = ?`
    ).bind(targetStage.id, status, closedAt, input.loss_reason_id || opp.loss_reason_id || null, now, user.id, id),
    c.env.DB.prepare(
      `INSERT INTO activity_history (id, opportunity_id, type, description, from_stage_id, to_stage_id, occurred_at, created_at, created_by)
       VALUES (?, ?, 'mudanca_etapa', ?, ?, ?, ?, ?, ?)`
    ).bind(
      genId("hist"),
      id,
      `Movida de "${currentStage?.name ?? "?"}" para "${targetStage.name}".${input.note ? ` ${input.note}` : ""}`,
      opp.stage_id,
      targetStage.id,
      now,
      now,
      user.id
    ),
    c.env.DB.prepare(
      `INSERT INTO audit_log (id, entity_type, entity_id, action, field_name, old_value, new_value, user_id, user_email, occurred_at, created_at)
       VALUES (?, 'opportunity', ?, 'stage_change', 'stage_id', ?, ?, ?, ?, ?, ?)`
    ).bind(genId("aud"), id, opp.stage_id, targetStage.id, user.id, user.email, now, now),
  ];

  if (targetStage.is_nutrition) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO nutrition_leads (id, opportunity_id, status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, 'em_nutricao', ?, ?, ?, ?)`
      ).bind(genId("nut"), id, now, now, user.id, user.id)
    );
  }

  await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare("SELECT * FROM opportunities WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /api/opportunities/:id
// ---------------------------------------------------------------------------
opportunities.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, title FROM opportunities WHERE id = ?").bind(id).first<{ id: string; title: string }>();
  if (!existing) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM opportunities WHERE id = ?").bind(id).run();
  await writeAudit(c.env.DB, { entityType: "opportunity", entityId: id, action: "delete", oldValue: existing.title, user });

  return c.json({ data: { id } });
});

// ---------------------------------------------------------------------------
// Histórico (linha do tempo) — /api/opportunities/:id/history
// ---------------------------------------------------------------------------
opportunities.get("/:id/history", async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT h.*, u.name as created_by_name, fs.name as from_stage_name, ts.name as to_stage_name
     FROM activity_history h
     LEFT JOIN users u ON u.id = h.created_by
     LEFT JOIN pipeline_stages fs ON fs.id = h.from_stage_id
     LEFT JOIN pipeline_stages ts ON ts.id = h.to_stage_id
     WHERE h.opportunity_id = ? ORDER BY h.occurred_at DESC`
  )
    .bind(id)
    .all();
  return c.json({ data: results });
});

opportunities.post("/:id/history", async (c) => {
  const id = c.req.param("id");
  const opp = await c.env.DB.prepare("SELECT id FROM opportunities WHERE id = ?").bind(id).first();
  if (!opp) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = historyCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const user = c.get("user");
  const now = nowIso();
  const historyId = genId("hist");

  await c.env.DB.prepare(
    `INSERT INTO activity_history (id, opportunity_id, type, description, activity_id, occurred_at, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(historyId, id, input.type, input.description.trim(), input.activity_id || null, input.occurred_at || now, now, user.id)
    .run();

  const created = await c.env.DB.prepare("SELECT * FROM activity_history WHERE id = ?").bind(historyId).first();
  return c.json({ data: created }, 201);
});

// ---------------------------------------------------------------------------
// Cotações — /api/opportunities/:id/quotes
// (operações sobre uma cotação específica ficam em worker/routes/quotes.ts)
// ---------------------------------------------------------------------------
opportunities.get("/:id/quotes", async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT q.*, (SELECT COUNT(*) FROM quote_items qi WHERE qi.quote_id = q.id) as items_count
     FROM quotes q WHERE q.opportunity_id = ? ORDER BY q.created_at DESC`
  )
    .bind(id)
    .all();
  return c.json({ data: results });
});

opportunities.post("/:id/quotes", async (c) => {
  const id = c.req.param("id");
  const opp = await c.env.DB.prepare("SELECT id, company_id FROM opportunities WHERE id = ?")
    .bind(id)
    .first<{ id: string; company_id: string }>();
  if (!opp) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = quoteCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  if (input.contact_id) {
    const contact = await c.env.DB.prepare("SELECT id FROM contacts WHERE id = ? AND company_id = ?")
      .bind(input.contact_id, opp.company_id)
      .first();
    if (!contact) return c.json({ error: "Contato informado não pertence à empresa da oportunidade." }, 400);
  }

  const user = c.get("user");
  const now = nowIso();
  const year = new Date().getFullYear();

  const countRow = await c.env.DB.prepare("SELECT COUNT(*) as total FROM quotes WHERE number LIKE ?")
    .bind(`${year}-%`)
    .first<{ total: number }>();
  const sequence = (countRow?.total ?? 0) + 1;
  const number = `${year}-${String(sequence).padStart(4, "0")}`;

  const quoteId = genId("qte");
  const margin =
    input.value !== undefined && input.value !== null && input.estimated_cost !== undefined && input.estimated_cost !== null
      ? Math.round((input.value - input.estimated_cost) * 100) / 100
      : input.estimated_margin ?? null;

  await c.env.DB.prepare(
    `INSERT INTO quotes (id, number, opportunity_id, company_id, contact_id, quote_date, origin, destination, cargo_type, vehicle_type, value, estimated_cost, estimated_margin, validity_date, status, observations, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?)`
  )
    .bind(
      quoteId,
      number,
      id,
      opp.company_id,
      input.contact_id || null,
      input.quote_date || now,
      emptyToNull(input.origin ?? null),
      emptyToNull(input.destination ?? null),
      emptyToNull(input.cargo_type ?? null),
      emptyToNull(input.vehicle_type ?? null),
      input.value ?? null,
      input.estimated_cost ?? null,
      margin,
      emptyToNull(input.validity_date ?? null),
      emptyToNull(input.observations ?? null),
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO activity_history (id, opportunity_id, type, description, occurred_at, created_at, created_by)
     VALUES (?, ?, 'cotacao', ?, ?, ?, ?)`
  )
    .bind(genId("hist"), id, `Cotação ${number} criada.`, now, now, user.id)
    .run();

  await writeAudit(c.env.DB, { entityType: "quote", entityId: quoteId, action: "create", newValue: number, user });

  const created = await c.env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(quoteId).first();
  return c.json({ data: created }, 201);
});

// ---------------------------------------------------------------------------
// Cadências aplicadas — /api/opportunities/:id/cadence
// ---------------------------------------------------------------------------
opportunities.get("/:id/cadence", async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT lc.*, t.name as template_name
     FROM lead_cadences lc JOIN cadence_templates t ON t.id = lc.cadence_template_id
     WHERE lc.opportunity_id = ? ORDER BY lc.started_at DESC`
  )
    .bind(id)
    .all();
  return c.json({ data: results });
});

// POST /api/opportunities/:id/cadence — aplica um modelo de cadência,
// gerando automaticamente uma atividade agendada para cada passo.
opportunities.post("/:id/cadence", async (c) => {
  const id = c.req.param("id");
  const opp = await c.env.DB.prepare("SELECT id, owner_id FROM opportunities WHERE id = ?")
    .bind(id)
    .first<{ id: string; owner_id: string | null }>();
  if (!opp) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = applyCadenceSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const template = await c.env.DB.prepare("SELECT id, name FROM cadence_templates WHERE id = ? AND active = 1")
    .bind(input.cadence_template_id)
    .first<{ id: string; name: string }>();
  if (!template) return c.json({ error: "Modelo de cadência não encontrado ou inativo." }, 400);

  const { results: steps } = await c.env.DB.prepare(
    "SELECT * FROM cadence_steps WHERE cadence_template_id = ? ORDER BY step_order ASC"
  )
    .bind(input.cadence_template_id)
    .all<{ id: string; type: string; day_offset: number; title: string; description: string | null }>();

  if (steps.length === 0) {
    return c.json({ error: "Este modelo de cadência não possui passos configurados." }, 400);
  }

  const user = c.get("user");
  const now = nowIso();
  const startedAt = input.started_at ? new Date(input.started_at) : new Date();
  const leadCadenceId = genId("lc");

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO lead_cadences (id, opportunity_id, cadence_template_id, started_at, status, current_step, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, 'ativa', 0, ?, ?, ?, ?)`
    ).bind(leadCadenceId, id, input.cadence_template_id, startedAt.toISOString(), now, now, user.id, user.id),
    c.env.DB.prepare(
      `INSERT INTO activity_history (id, opportunity_id, type, description, occurred_at, created_at, created_by)
       VALUES (?, ?, 'sistema', ?, ?, ?, ?)`
    ).bind(genId("hist"), id, `Cadência "${template.name}" aplicada (${steps.length} passo${steps.length === 1 ? "" : "s"}).`, now, now, user.id),
  ];

  for (const step of steps) {
    const dueDate = new Date(startedAt.getTime() + step.day_offset * 86_400_000);
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO activities (id, opportunity_id, type, title, description, due_at, status, owner_id, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?)`
      ).bind(
        genId("act"),
        id,
        CADENCE_STEP_TO_ACTIVITY_TYPE[step.type] ?? "outro",
        step.title,
        step.description,
        dueDate.toISOString(),
        opp.owner_id || user.id,
        now,
        now,
        user.id,
        user.id
      )
    );
  }

  await c.env.DB.batch(statements);
  await writeAudit(c.env.DB, { entityType: "opportunity", entityId: id, action: "apply_cadence", newValue: template.name, user });

  const { results: created } = await c.env.DB.prepare(
    `SELECT lc.*, t.name as template_name FROM lead_cadences lc JOIN cadence_templates t ON t.id = lc.cadence_template_id WHERE lc.id = ?`
  )
    .bind(leadCadenceId)
    .all();
  return c.json({ data: created[0] }, 201);
});

opportunities.patch("/:id/cadence/:leadCadenceId/cancel", async (c) => {
  const { id, leadCadenceId } = c.req.param();
  const leadCadence = await c.env.DB.prepare("SELECT id FROM lead_cadences WHERE id = ? AND opportunity_id = ?")
    .bind(leadCadenceId, id)
    .first();
  if (!leadCadence) return c.json({ error: "Cadência aplicada não encontrada." }, 404);

  const user = c.get("user");
  await c.env.DB.prepare("UPDATE lead_cadences SET status = 'cancelada', updated_at = ?, updated_by = ? WHERE id = ?")
    .bind(nowIso(), user.id, leadCadenceId)
    .run();

  return c.json({ data: { id: leadCadenceId } });
});

// ---------------------------------------------------------------------------
// Notas — /api/opportunities/:id/notes
// ---------------------------------------------------------------------------
opportunities.get("/:id/notes", async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT n.*, u.name as created_by_name FROM notes n LEFT JOIN users u ON u.id = n.created_by
     WHERE n.opportunity_id = ? ORDER BY n.created_at DESC`
  )
    .bind(id)
    .all();
  return c.json({ data: results });
});

opportunities.post("/:id/notes", async (c) => {
  const id = c.req.param("id");
  const opp = await c.env.DB.prepare("SELECT id FROM opportunities WHERE id = ?").bind(id).first();
  if (!opp) return c.json({ error: "Oportunidade não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = noteCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const user = c.get("user");
  const now = nowIso();
  const noteId = genId("note");

  await c.env.DB.prepare(
    `INSERT INTO notes (id, opportunity_id, content, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(noteId, id, parsed.data.content.trim(), now, now, user.id, user.id)
    .run();

  const created = await c.env.DB.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();
  return c.json({ data: created }, 201);
});

opportunities.put("/:id/notes/:noteId", async (c) => {
  const { noteId } = c.req.param();
  const existing = await c.env.DB.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();
  if (!existing) return c.json({ error: "Nota não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = noteUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const user = c.get("user");
  const now = nowIso();
  await c.env.DB.prepare("UPDATE notes SET content = ?, updated_at = ?, updated_by = ? WHERE id = ?")
    .bind(parsed.data.content.trim(), now, user.id, noteId)
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();
  return c.json({ data: updated });
});

opportunities.delete("/:id/notes/:noteId", async (c) => {
  const { noteId } = c.req.param();
  const existing = await c.env.DB.prepare("SELECT id FROM notes WHERE id = ?").bind(noteId).first();
  if (!existing) return c.json({ error: "Nota não encontrada." }, 404);

  await c.env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(noteId).run();
  return c.json({ data: { id: noteId } });
});

export default opportunities;
