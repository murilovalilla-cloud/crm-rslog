// Rotas de cotações: /api/quotes
// Criação/listagem por oportunidade fica em worker/routes/opportunities.ts
// (GET/POST /api/opportunities/:id/quotes), espelhando o padrão de
// histórico/notas. Aqui ficam as operações sobre uma cotação específica.

import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  quoteItemCreateSchema,
  quoteItemUpdateSchema,
  quoteStatusChangeSchema,
  quoteUpdateSchema,
} from "../validation/schemas";
import { diffFields, emptyToNull, genId, nowIso, requireOpportunityAccess, writeAudit } from "../utils";

const quotes = new Hono<AppEnv>();

interface QuoteRow {
  id: string;
  opportunity_id: string;
  company_id: string;
  value: number | null;
  estimated_cost: number | null;
  status: string;
}

export function recalcMargin(value: number | null | undefined, cost: number | null | undefined): number | null {
  if (value === null || value === undefined || cost === null || cost === undefined) return null;
  return Math.round((value - cost) * 100) / 100;
}

async function loadQuoteWithItems(db: D1Database, id: string) {
  const quote = await db.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first();
  if (!quote) return null;
  const { results: items } = await db.prepare("SELECT * FROM quote_items WHERE quote_id = ? ORDER BY created_at ASC").bind(id).all();
  return { ...quote, items };
}

quotes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const quoteRef = await c.env.DB.prepare("SELECT opportunity_id FROM quotes WHERE id = ?").bind(id).first<{ opportunity_id: string }>();
  if (!quoteRef) return c.json({ error: "Cotação não encontrada." }, 404);
  const access = await requireOpportunityAccess(c.env.DB, quoteRef.opportunity_id, c.get("user"));
  if (!access.ok) return c.json({ error: access.error }, access.status);

  const data = await loadQuoteWithItems(c.env.DB, id);
  if (!data) return c.json({ error: "Cotação não encontrada." }, 404);
  return c.json({ data });
});

quotes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Cotação não encontrada." }, 404);

  const user = c.get("user");
  const access = await requireOpportunityAccess(c.env.DB, existing.opportunity_id as string, user);
  if (!access.ok) return c.json({ error: access.error }, access.status);

  const body = await c.req.json().catch(() => null);
  const parsed = quoteUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    normalized[key] = typeof value === "string" ? emptyToNull(value) : value;
  }

  const nextValue = "value" in normalized ? (normalized.value as number | null) : (existing.value as number | null);
  const nextCost =
    "estimated_cost" in normalized ? (normalized.estimated_cost as number | null) : (existing.estimated_cost as number | null);
  normalized.estimated_margin = recalcMargin(nextValue, nextCost);

  const now = nowIso();
  const setClauses = Object.keys(normalized)
    .map((key) => `${key} = ?`)
    .concat(["updated_at = ?", "updated_by = ?"]);
  const values = [...Object.values(normalized), now, user.id, id];

  await c.env.DB.prepare(`UPDATE quotes SET ${setClauses.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const changes = diffFields(existing, normalized);
  for (const change of changes) {
    await writeAudit(c.env.DB, {
      entityType: "quote",
      entityId: id,
      action: "update",
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      user,
    });
  }

  const updated = await loadQuoteWithItems(c.env.DB, id);
  return c.json({ data: updated });
});

// PATCH /api/quotes/:id/status — muda a situação da cotação (registra no histórico da oportunidade)
quotes.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const quote = await c.env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first<QuoteRow & { number: string }>();
  if (!quote) return c.json({ error: "Cotação não encontrada." }, 404);

  const user = c.get("user");
  const access = await requireOpportunityAccess(c.env.DB, quote.opportunity_id, user);
  if (!access.ok) return c.json({ error: access.error }, access.status);

  const body = await c.req.json().catch(() => null);
  const parsed = quoteStatusChangeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  if (input.status === "recusada" && !input.loss_reason_id) {
    return c.json({ error: "Informe o motivo ao marcar a cotação como recusada." }, 400);
  }

  const now = nowIso();

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE quotes SET status = ?, loss_reason_id = ?, updated_at = ?, updated_by = ? WHERE id = ?").bind(
      input.status,
      input.loss_reason_id || null,
      now,
      user.id,
      id
    ),
    c.env.DB.prepare(
      `INSERT INTO activity_history (id, opportunity_id, type, description, occurred_at, created_at, created_by)
       VALUES (?, ?, 'cotacao', ?, ?, ?, ?)`
    ).bind(genId("hist"), quote.opportunity_id, `Cotação ${quote.number} marcada como "${input.status}".`, now, now, user.id),
    c.env.DB.prepare(
      `INSERT INTO audit_log (id, entity_type, entity_id, action, field_name, old_value, new_value, user_id, user_email, occurred_at, created_at)
       VALUES (?, 'quote', ?, 'status_change', 'status', ?, ?, ?, ?, ?, ?)`
    ).bind(genId("aud"), id, quote.status, input.status, user.id, user.email, now, now),
  ]);

  const updated = await loadQuoteWithItems(c.env.DB, id);
  return c.json({ data: updated });
});

quotes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, number, opportunity_id FROM quotes WHERE id = ?")
    .bind(id)
    .first<{ id: string; number: string; opportunity_id: string }>();
  if (!existing) return c.json({ error: "Cotação não encontrada." }, 404);

  const user = c.get("user");
  const access = await requireOpportunityAccess(c.env.DB, existing.opportunity_id, user);
  if (!access.ok) return c.json({ error: access.error }, access.status);

  await c.env.DB.prepare("DELETE FROM quotes WHERE id = ?").bind(id).run();
  await writeAudit(c.env.DB, { entityType: "quote", entityId: id, action: "delete", oldValue: existing.number, user });

  return c.json({ data: { id } });
});

// -----------------------------------------------------------------------
// Itens da cotação — /api/quotes/:id/items
// -----------------------------------------------------------------------
quotes.post("/:id/items", async (c) => {
  const quoteId = c.req.param("id");
  const quote = await c.env.DB.prepare("SELECT id, opportunity_id FROM quotes WHERE id = ?").bind(quoteId).first<{ id: string; opportunity_id: string }>();
  if (!quote) return c.json({ error: "Cotação não encontrada." }, 404);

  const user = c.get("user");
  const access = await requireOpportunityAccess(c.env.DB, quote.opportunity_id, user);
  if (!access.ok) return c.json({ error: access.error }, access.status);

  const body = await c.req.json().catch(() => null);
  const parsed = quoteItemCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const now = nowIso();
  const id = genId("qit");
  const total = Math.round(input.quantity * input.unit_value * 100) / 100;

  await c.env.DB.prepare(
    `INSERT INTO quote_items (id, quote_id, description, quantity, unit_value, total_value, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, quoteId, input.description.trim(), input.quantity, input.unit_value, total, now, now, user.id, user.id)
    .run();

  const created = await c.env.DB.prepare("SELECT * FROM quote_items WHERE id = ?").bind(id).first();
  return c.json({ data: created }, 201);
});

quotes.put("/:id/items/:itemId", async (c) => {
  const { id: quoteId, itemId } = c.req.param();
  const quote = await c.env.DB.prepare("SELECT opportunity_id FROM quotes WHERE id = ?").bind(quoteId).first<{ opportunity_id: string }>();
  if (!quote) return c.json({ error: "Cotação não encontrada." }, 404);
  const access = await requireOpportunityAccess(c.env.DB, quote.opportunity_id, c.get("user"));
  if (!access.ok) return c.json({ error: access.error }, access.status);

  const existing = await c.env.DB.prepare("SELECT * FROM quote_items WHERE id = ? AND quote_id = ?")
    .bind(itemId, quoteId)
    .first<{ quantity: number; unit_value: number }>();
  if (!existing) return c.json({ error: "Item não encontrado." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = quoteItemUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const quantity = input.quantity ?? existing.quantity;
  const unitValue = input.unit_value ?? existing.unit_value;
  const total = Math.round(quantity * unitValue * 100) / 100;

  const user = c.get("user");
  const now = nowIso();

  await c.env.DB.prepare(
    `UPDATE quote_items SET description = COALESCE(?, description), quantity = ?, unit_value = ?, total_value = ?, updated_at = ?, updated_by = ? WHERE id = ?`
  )
    .bind(input.description?.trim() ?? null, quantity, unitValue, total, now, user.id, itemId)
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM quote_items WHERE id = ?").bind(itemId).first();
  return c.json({ data: updated });
});

quotes.delete("/:id/items/:itemId", async (c) => {
  const { id: quoteId, itemId } = c.req.param();
  const quote = await c.env.DB.prepare("SELECT opportunity_id FROM quotes WHERE id = ?").bind(quoteId).first<{ opportunity_id: string }>();
  if (!quote) return c.json({ error: "Cotação não encontrada." }, 404);
  const access = await requireOpportunityAccess(c.env.DB, quote.opportunity_id, c.get("user"));
  if (!access.ok) return c.json({ error: access.error }, access.status);

  const existing = await c.env.DB.prepare("SELECT id FROM quote_items WHERE id = ? AND quote_id = ?").bind(itemId, quoteId).first();
  if (!existing) return c.json({ error: "Item não encontrado." }, 404);

  await c.env.DB.prepare("DELETE FROM quote_items WHERE id = ?").bind(itemId).run();
  return c.json({ data: { id: itemId } });
});

export default quotes;
