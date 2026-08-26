// Rotas de empresas: /api/companies

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { companyCreateSchema, companyUpdateSchema } from "../validation/schemas";
import { diffFields, emptyToNull, genId, nowIso, parsePagination, writeAudit } from "../utils";

const companies = new Hono<AppEnv>();

// GET /api/companies?search=&owner_id=&source=&page=&limit=
companies.get("/", async (c) => {
  const url = new URL(c.req.url);
  const { page, limit, offset } = parsePagination(url);
  const search = url.searchParams.get("search")?.trim();
  const ownerId = url.searchParams.get("owner_id")?.trim();
  const source = url.searchParams.get("source")?.trim();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push("(c.name LIKE ? OR c.cnpj LIKE ? OR c.city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (ownerId) {
    conditions.push("c.owner_id = ?");
    params.push(ownerId);
  }
  if (source) {
    conditions.push("c.source = ?");
    params.push(source);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM companies c ${where}`)
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT c.*, u.name as owner_name,
       (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) as contacts_count,
       (SELECT COUNT(*) FROM opportunities o WHERE o.company_id = c.id) as opportunities_count
     FROM companies c
     LEFT JOIN users u ON u.id = c.owner_id
     ${where}
     ORDER BY c.name ASC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all();

  return c.json({ data: results, page, limit, total: totalRow?.total ?? 0 });
});

// GET /api/companies/:id — detalhe com contatos
companies.get("/:id", async (c) => {
  const id = c.req.param("id");
  const company = await c.env.DB.prepare(
    `SELECT c.*, u.name as owner_name FROM companies c LEFT JOIN users u ON u.id = c.owner_id WHERE c.id = ?`
  )
    .bind(id)
    .first();

  if (!company) return c.json({ error: "Empresa não encontrada." }, 404);

  const { results: contacts } = await c.env.DB.prepare(
    "SELECT * FROM contacts WHERE company_id = ? ORDER BY is_decision_maker DESC, name ASC"
  )
    .bind(id)
    .all();

  const { results: opportunities } = await c.env.DB.prepare(
    `SELECT o.id, o.title, o.value, o.status, s.name as stage_name, s.id as stage_id
     FROM opportunities o JOIN pipeline_stages s ON s.id = o.stage_id
     WHERE o.company_id = ? ORDER BY o.created_at DESC`
  )
    .bind(id)
    .all();

  return c.json({ data: { ...company, contacts, opportunities } });
});

// POST /api/companies
companies.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = companyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  const user = c.get("user");

  if (input.owner_id) {
    const owner = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND active = 1").bind(input.owner_id).first();
    if (!owner) return c.json({ error: "Responsável comercial informado não existe ou está inativo." }, 400);
  }

  const id = genId("cmp");
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO companies (id, name, cnpj, segment, website, phone, city, state, source, notes, owner_id, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.name.trim(),
      emptyToNull(input.cnpj),
      emptyToNull(input.segment),
      emptyToNull(input.website),
      emptyToNull(input.phone),
      emptyToNull(input.city),
      emptyToNull(input.state),
      emptyToNull(input.source),
      emptyToNull(input.notes),
      input.owner_id || null,
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await writeAudit(c.env.DB, { entityType: "company", entityId: id, action: "create", user });

  const created = await c.env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(id).first();
  return c.json({ data: created }, 201);
});

// PUT /api/companies/:id
companies.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Empresa não encontrada." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = companyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  const user = c.get("user");

  if (input.owner_id) {
    const owner = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND active = 1").bind(input.owner_id).first();
    if (!owner) return c.json({ error: "Responsável comercial informado não existe ou está inativo." }, 400);
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    normalized[key] = typeof value === "string" ? emptyToNull(value) : value;
  }

  if (Object.keys(normalized).length === 0) {
    return c.json({ data: existing });
  }

  const now = nowIso();
  const setClauses = Object.keys(normalized)
    .map((key) => `${key} = ?`)
    .concat(["updated_at = ?", "updated_by = ?"]);
  const values = [...Object.values(normalized), now, user.id, id];

  await c.env.DB.prepare(`UPDATE companies SET ${setClauses.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const changes = diffFields(existing, normalized);
  for (const change of changes) {
    await writeAudit(c.env.DB, {
      entityType: "company",
      entityId: id,
      action: "update",
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      user,
    });
  }

  const updated = await c.env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(id).first();
  return c.json({ data: updated });
});

// DELETE /api/companies/:id
companies.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, name FROM companies WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!existing) return c.json({ error: "Empresa não encontrada." }, 404);

  const oppCount = await c.env.DB.prepare("SELECT COUNT(*) as total FROM opportunities WHERE company_id = ?")
    .bind(id)
    .first<{ total: number }>();

  if ((oppCount?.total ?? 0) > 0) {
    return c.json(
      {
        error:
          "Não é possível excluir esta empresa porque existem oportunidades vinculadas a ela. Exclua ou reatribua as oportunidades primeiro.",
      },
      409
    );
  }

  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM companies WHERE id = ?").bind(id).run();
  await writeAudit(c.env.DB, { entityType: "company", entityId: id, action: "delete", oldValue: existing.name, user });

  return c.json({ data: { id } });
});

export default companies;
