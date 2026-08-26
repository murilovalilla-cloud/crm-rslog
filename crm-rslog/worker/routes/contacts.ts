// Rotas de contatos: /api/contacts

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { contactCreateSchema, contactUpdateSchema } from "../validation/schemas";
import { diffFields, emptyToNull, genId, nowIso, writeAudit } from "../utils";

const contacts = new Hono<AppEnv>();

// GET /api/contacts?company_id=...
contacts.get("/", async (c) => {
  const companyId = c.req.query("company_id");
  if (!companyId) {
    return c.json({ error: "Parâmetro company_id é obrigatório." }, 400);
  }
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM contacts WHERE company_id = ? ORDER BY is_decision_maker DESC, name ASC"
  )
    .bind(companyId)
    .all();
  return c.json({ data: results });
});

contacts.get("/:id", async (c) => {
  const contact = await c.env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(c.req.param("id")).first();
  if (!contact) return c.json({ error: "Contato não encontrado." }, 404);
  return c.json({ data: contact });
});

contacts.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  const company = await c.env.DB.prepare("SELECT id FROM companies WHERE id = ?").bind(input.company_id).first();
  if (!company) return c.json({ error: "Empresa informada não existe." }, 400);

  const user = c.get("user");
  const id = genId("ctc");
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO contacts (id, company_id, name, role, is_decision_maker, email, phone, whatsapp, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.company_id,
      input.name.trim(),
      emptyToNull(input.role),
      input.is_decision_maker ? 1 : 0,
      emptyToNull(input.email),
      emptyToNull(input.phone),
      emptyToNull(input.whatsapp),
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await writeAudit(c.env.DB, { entityType: "contact", entityId: id, action: "create", user });

  const created = await c.env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(id).first();
  return c.json({ data: created }, 201);
});

contacts.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Contato não encontrado." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = contactUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);

  const input = parsed.data;
  if (input.company_id) {
    const company = await c.env.DB.prepare("SELECT id FROM companies WHERE id = ?").bind(input.company_id).first();
    if (!company) return c.json({ error: "Empresa informada não existe." }, 400);
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === "is_decision_maker") {
      normalized[key] = value ? 1 : 0;
    } else {
      normalized[key] = typeof value === "string" ? emptyToNull(value) : value;
    }
  }

  const user = c.get("user");
  if (Object.keys(normalized).length > 0) {
    const now = nowIso();
    const setClauses = Object.keys(normalized)
      .map((key) => `${key} = ?`)
      .concat(["updated_at = ?", "updated_by = ?"]);
    const values = [...Object.values(normalized), now, user.id, id];

    await c.env.DB.prepare(`UPDATE contacts SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const changes = diffFields(existing, normalized);
    for (const change of changes) {
      await writeAudit(c.env.DB, {
        entityType: "contact",
        entityId: id,
        action: "update",
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        user,
      });
    }
  }

  const updated = await c.env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

contacts.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, name FROM contacts WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!existing) return c.json({ error: "Contato não encontrado." }, 404);

  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();
  await writeAudit(c.env.DB, { entityType: "contact", entityId: id, action: "delete", oldValue: existing.name, user });

  return c.json({ data: { id } });
});

export default contacts;
