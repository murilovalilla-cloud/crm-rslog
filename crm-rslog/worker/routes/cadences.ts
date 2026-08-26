// Rotas de modelos de cadência: /api/cadence-templates
// Aplicar uma cadência a uma oportunidade específica fica em
// worker/routes/opportunities.ts (POST /api/opportunities/:id/cadence),
// pois é aí que as atividades da cadência são efetivamente geradas.

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { cadenceTemplateCreateSchema, cadenceTemplateUpdateSchema } from "../validation/schemas";
import { genId, nowIso, writeAudit } from "../utils";

const cadences = new Hono<AppEnv>();

/** Verdadeiro se algum step_order aparece mais de uma vez — a ordem dos passos precisa ser única. */
export function hasDuplicateStepOrders(orders: number[]): boolean {
  return new Set(orders).size !== orders.length;
}

async function loadTemplateWithSteps(db: D1Database, id: string) {
  const template = await db.prepare("SELECT * FROM cadence_templates WHERE id = ?").bind(id).first();
  if (!template) return null;
  const { results: steps } = await db
    .prepare("SELECT * FROM cadence_steps WHERE cadence_template_id = ? ORDER BY step_order ASC")
    .bind(id)
    .all();
  return { ...template, steps };
}

cadences.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM cadence_steps s WHERE s.cadence_template_id = t.id) as steps_count
     FROM cadence_templates t WHERE t.active = 1 ORDER BY t.name ASC`
  ).all();
  return c.json({ data: results });
});

cadences.get("/:id", async (c) => {
  const data = await loadTemplateWithSteps(c.env.DB, c.req.param("id"));
  if (!data) return c.json({ error: "Modelo de cadência não encontrado." }, 404);
  return c.json({ data });
});

cadences.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = cadenceTemplateCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const orders = input.steps.map((s) => s.step_order);
  if (hasDuplicateStepOrders(orders)) {
    return c.json({ error: "Os passos da cadência não podem repetir a mesma ordem." }, 400);
  }

  const user = c.get("user");
  const now = nowIso();
  const templateId = genId("cdt");

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO cadence_templates (id, name, description, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(templateId, input.name.trim(), input.description ?? null, now, now, user.id, user.id),
    ...input.steps.map((step) =>
      c.env.DB.prepare(
        `INSERT INTO cadence_steps (id, cadence_template_id, step_order, type, day_offset, title, description, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(genId("cds"), templateId, step.step_order, step.type, step.day_offset, step.title.trim(), step.description ?? null, now, now, user.id, user.id)
    ),
  ];

  await c.env.DB.batch(statements);
  await writeAudit(c.env.DB, { entityType: "cadence_template", entityId: templateId, action: "create", user });

  const created = await loadTemplateWithSteps(c.env.DB, templateId);
  return c.json({ data: created }, 201);
});

cadences.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM cadence_templates WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Modelo de cadência não encontrado." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = cadenceTemplateUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const user = c.get("user");
  const now = nowIso();
  const statements = [];

  const fields: Record<string, unknown> = {};
  if (input.name !== undefined) fields.name = input.name.trim();
  if (input.description !== undefined) fields.description = input.description;
  if (input.active !== undefined) fields.active = input.active ? 1 : 0;

  if (Object.keys(fields).length > 0) {
    const setClauses = Object.keys(fields)
      .map((key) => `${key} = ?`)
      .concat(["updated_at = ?", "updated_by = ?"]);
    statements.push(
      c.env.DB.prepare(`UPDATE cadence_templates SET ${setClauses.join(", ")} WHERE id = ?`).bind(
        ...Object.values(fields),
        now,
        user.id,
        id
      )
    );
  }

  if (input.steps) {
    const orders = input.steps.map((s) => s.step_order);
    if (hasDuplicateStepOrders(orders)) {
      return c.json({ error: "Os passos da cadência não podem repetir a mesma ordem." }, 400);
    }
    // Substitui todos os passos pela nova lista enviada (forma mais simples e
    // previsível de editar uma sequência curta de passos).
    statements.push(c.env.DB.prepare("DELETE FROM cadence_steps WHERE cadence_template_id = ?").bind(id));
    for (const step of input.steps) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO cadence_steps (id, cadence_template_id, step_order, type, day_offset, title, description, created_at, updated_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          step.id && step.id.startsWith("cds_") ? step.id : genId("cds"),
          id,
          step.step_order,
          step.type,
          step.day_offset,
          step.title.trim(),
          step.description ?? null,
          now,
          now,
          user.id,
          user.id
        )
      );
    }
  }

  if (statements.length > 0) {
    await c.env.DB.batch(statements);
    await writeAudit(c.env.DB, { entityType: "cadence_template", entityId: id, action: "update", user });
  }

  const updated = await loadTemplateWithSteps(c.env.DB, id);
  return c.json({ data: updated });
});

cadences.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, name FROM cadence_templates WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!existing) return c.json({ error: "Modelo de cadência não encontrado." }, 404);

  const activeUse = await c.env.DB.prepare("SELECT COUNT(*) as total FROM lead_cadences WHERE cadence_template_id = ? AND status = 'ativa'")
    .bind(id)
    .first<{ total: number }>();
  if ((activeUse?.total ?? 0) > 0) {
    return c.json({ error: "Não é possível excluir uma cadência em uso ativo por alguma oportunidade." }, 409);
  }

  const user = c.get("user");
  await c.env.DB.prepare("UPDATE cadence_templates SET active = 0, updated_at = ?, updated_by = ? WHERE id = ?")
    .bind(nowIso(), user.id, id)
    .run();
  await writeAudit(c.env.DB, { entityType: "cadence_template", entityId: id, action: "delete", oldValue: existing.name, user });

  return c.json({ data: { id } });
});

export default cadences;
