// Rotas de nutrição de leads: /api/nutrition-leads
//
// O registro em nutrition_leads é criado automaticamente quando uma
// oportunidade é movida para uma etapa marcada como "is_nutrition" (ver
// worker/routes/opportunities.ts > PATCH /:id/stage). Aqui ficam as ações
// específicas da área de nutrição: editar motivo/data de retomada e retomar
// o lead (movendo-o de volta para uma etapa ativa do funil, sem apagar nada
// do histórico anterior).

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { nutritionResumeSchema, nutritionUpdateSchema } from "../validation/schemas";
import { emptyToNull, genId, nowIso, writeAudit } from "../utils";

const nutrition = new Hono<AppEnv>();

// GET /api/nutrition-leads?status=em_nutricao
nutrition.get("/", async (c) => {
  const status = c.req.query("status") ?? "em_nutricao";
  const { results } = await c.env.DB.prepare(
    `SELECT nl.*, o.title as opportunity_title, o.value as opportunity_value, o.owner_id,
            c.name as company_name, u.name as owner_name
     FROM nutrition_leads nl
     JOIN opportunities o ON o.id = nl.opportunity_id
     JOIN companies c ON c.id = o.company_id
     LEFT JOIN users u ON u.id = o.owner_id
     WHERE nl.status = ?
     ORDER BY (nl.resume_at IS NULL), nl.resume_at ASC`
  )
    .bind(status)
    .all();
  return c.json({ data: results });
});

nutrition.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM nutrition_leads WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Registro de nutrição não encontrado." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = nutritionUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const user = c.get("user");
  const now = nowIso();

  await c.env.DB.prepare("UPDATE nutrition_leads SET reason = ?, resume_at = ?, updated_at = ?, updated_by = ? WHERE id = ?")
    .bind(
      emptyToNull(input.reason ?? (existing.reason as string | null)),
      emptyToNull(input.resume_at ?? (existing.resume_at as string | null)),
      now,
      user.id,
      id
    )
    .run();

  await writeAudit(c.env.DB, { entityType: "nutrition_lead", entityId: id, action: "update", user });

  const updated = await c.env.DB.prepare("SELECT * FROM nutrition_leads WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

// POST /api/nutrition-leads/:id/resume — retoma o lead: move a oportunidade
// para a etapa escolhida, marca o registro de nutrição como concluído, e
// preserva TODO o histórico já registrado (nada é apagado).
nutrition.post("/:id/resume", async (c) => {
  const id = c.req.param("id");
  const record = await c.env.DB.prepare("SELECT * FROM nutrition_leads WHERE id = ?")
    .bind(id)
    .first<{ id: string; opportunity_id: string; status: string }>();
  if (!record) return c.json({ error: "Registro de nutrição não encontrado." }, 404);
  if (record.status === "retomado") return c.json({ error: "Este lead já foi retomado." }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = nutritionResumeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const opp = await c.env.DB.prepare("SELECT stage_id FROM opportunities WHERE id = ?")
    .bind(record.opportunity_id)
    .first<{ stage_id: string }>();
  if (!opp) return c.json({ error: "Oportunidade vinculada não foi encontrada." }, 404);

  const targetStage = await c.env.DB.prepare("SELECT id, name FROM pipeline_stages WHERE id = ? AND active = 1 AND is_nutrition = 0")
    .bind(input.stage_id)
    .first<{ id: string; name: string }>();
  if (!targetStage) return c.json({ error: "Etapa de retomada inválida." }, 400);

  const currentStage = await c.env.DB.prepare("SELECT name FROM pipeline_stages WHERE id = ?")
    .bind(opp.stage_id)
    .first<{ name: string }>();

  const user = c.get("user");
  const now = nowIso();

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE opportunities SET stage_id = ?, status = 'aberta', updated_at = ?, updated_by = ? WHERE id = ?"
    ).bind(targetStage.id, now, user.id, record.opportunity_id),
    c.env.DB.prepare(
      "UPDATE nutrition_leads SET status = 'retomado', returned_at = ?, updated_at = ?, updated_by = ? WHERE id = ?"
    ).bind(now, now, user.id, id),
    c.env.DB.prepare(
      `INSERT INTO activity_history (id, opportunity_id, type, description, from_stage_id, to_stage_id, occurred_at, created_at, created_by)
       VALUES (?, ?, 'mudanca_etapa', ?, ?, ?, ?, ?, ?)`
    ).bind(
      genId("hist"),
      record.opportunity_id,
      `Lead retomado da nutrição para "${targetStage.name}".${input.note ? ` ${input.note}` : ""}`,
      opp.stage_id,
      targetStage.id,
      now,
      now,
      user.id
    ),
    c.env.DB.prepare(
      `INSERT INTO audit_log (id, entity_type, entity_id, action, field_name, old_value, new_value, user_id, user_email, occurred_at, created_at)
       VALUES (?, 'opportunity', ?, 'resume_from_nutrition', 'stage_id', ?, ?, ?, ?, ?, ?)`
    ).bind(genId("aud"), record.opportunity_id, currentStage?.name ?? opp.stage_id, targetStage.name, user.id, user.email, now, now),
  ]);

  const updated = await c.env.DB.prepare("SELECT * FROM nutrition_leads WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

export default nutrition;
