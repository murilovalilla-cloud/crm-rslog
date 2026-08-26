// Rotas de etapas do funil: /api/pipeline-stages
// Permite criar, renomear, reordenar e personalizar as etapas do Kanban.

import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  pipelineStageCreateSchema,
  pipelineStageReorderSchema,
  pipelineStageUpdateSchema,
} from "../validation/schemas";
import { diffFields, genId, nowIso, writeAudit } from "../utils";

const pipelineStages = new Hono<AppEnv>();

pipelineStages.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY position ASC"
  ).all();
  return c.json({ data: results });
});

pipelineStages.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = pipelineStageCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  const user = c.get("user");

  let position = input.position;
  if (!position) {
    const maxRow = await c.env.DB.prepare("SELECT MAX(position) as maxPos FROM pipeline_stages").first<{ maxPos: number | null }>();
    position = (maxRow?.maxPos ?? 0) + 1;
  } else {
    // Abre espaço na posição desejada, empurrando as etapas seguintes.
    await c.env.DB.prepare("UPDATE pipeline_stages SET position = position + 1 WHERE position >= ?").bind(position).run();
  }

  const id = genId("stage");
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO pipeline_stages (id, name, position, color, is_won, is_lost, is_nutrition, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.name.trim(),
      position,
      input.color || "#1f3566",
      input.is_won ? 1 : 0,
      input.is_lost ? 1 : 0,
      input.is_nutrition ? 1 : 0,
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await writeAudit(c.env.DB, { entityType: "pipeline_stage", entityId: id, action: "create", user });

  const created = await c.env.DB.prepare("SELECT * FROM pipeline_stages WHERE id = ?").bind(id).first();
  return c.json({ data: created }, 201);
});

// PUT /api/pipeline-stages/reorder — body: { stages: [{id, position}, ...] }
// Precisa vir antes de "/:id" para não ser interpretado como um ID.
pipelineStages.put("/reorder", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = pipelineStageReorderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const user = c.get("user");
  const now = nowIso();
  const stmts = parsed.data.stages.map((s) =>
    c.env.DB.prepare("UPDATE pipeline_stages SET position = ?, updated_at = ?, updated_by = ? WHERE id = ?").bind(
      s.position,
      now,
      user.id,
      s.id
    )
  );

  await c.env.DB.batch(stmts);
  await writeAudit(c.env.DB, { entityType: "pipeline_stage", entityId: "bulk", action: "reorder", user });

  const { results } = await c.env.DB.prepare("SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY position ASC").all();
  return c.json({ data: results });
});

pipelineStages.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM pipeline_stages WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Etapa não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = pipelineStageUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (["is_won", "is_lost", "is_nutrition"].includes(key)) {
      normalized[key] = value ? 1 : 0;
    } else {
      normalized[key] = value;
    }
  }

  const user = c.get("user");
  if (Object.keys(normalized).length > 0) {
    const now = nowIso();
    const setClauses = Object.keys(normalized)
      .map((key) => `${key} = ?`)
      .concat(["updated_at = ?", "updated_by = ?"]);
    const values = [...Object.values(normalized), now, user.id, id];

    await c.env.DB.prepare(`UPDATE pipeline_stages SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const changes = diffFields(existing, normalized);
    for (const change of changes) {
      await writeAudit(c.env.DB, {
        entityType: "pipeline_stage",
        entityId: id,
        action: "update",
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        user,
      });
    }
  }

  const updated = await c.env.DB.prepare("SELECT * FROM pipeline_stages WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

pipelineStages.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, name FROM pipeline_stages WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!existing) return c.json({ error: "Etapa não encontrada." }, 404);

  const oppCount = await c.env.DB.prepare("SELECT COUNT(*) as total FROM opportunities WHERE stage_id = ?")
    .bind(id)
    .first<{ total: number }>();
  if ((oppCount?.total ?? 0) > 0) {
    return c.json(
      { error: "Não é possível excluir uma etapa que possui oportunidades. Mova as oportunidades para outra etapa primeiro." },
      409
    );
  }

  const user = c.get("user");
  // Soft delete: mantém a etapa no histórico, mas ela some do Kanban.
  await c.env.DB.prepare("UPDATE pipeline_stages SET active = 0, updated_at = ?, updated_by = ? WHERE id = ?")
    .bind(nowIso(), user.id, id)
    .run();
  await writeAudit(c.env.DB, { entityType: "pipeline_stage", entityId: id, action: "delete", oldValue: existing.name, user });

  return c.json({ data: { id } });
});

export default pipelineStages;
