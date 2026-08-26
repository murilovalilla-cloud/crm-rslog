// Rotas de usuários: /api/users e gestão de equipe (Etapa 3)
//
// GET /api/users — lista usuários ativos (nome/e-mail/papel), usada para
// preencher seletores de "responsável comercial" em toda a aplicação.
// Quando o requisitante é administrador e passa ?include_inactive=1,
// retorna todos os usuários (ativos e inativos) com mais detalhes, para a
// tela de gestão de equipe.
//
// As rotas de criação/edição (POST/PUT) são restritas a administradores
// (middleware requireAdmin, ver worker/auth.ts) e registram cada alteração
// no audit_log, seguindo o mesmo padrão das demais entidades do CRM.
//
// Não há rota de exclusão: usuários são desativados (active = 0) em vez de
// removidos, para preservar o histórico (oportunidades, atividades, notas e
// audit_log referenciam o id do usuário).

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { userCreateSchema, userUpdateSchema } from "../validation/schemas";
import { diffFields, genId, nowIso, writeAudit } from "../utils";
import { requireAdmin } from "../auth";

const users = new Hono<AppEnv>();

users.get("/", async (c) => {
  const requester = c.get("user");
  const includeInactive = new URL(c.req.url).searchParams.get("include_inactive") === "1";

  if (requester.role === "admin" && includeInactive) {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, email, role, active, created_at, updated_at FROM users ORDER BY active DESC, name ASC"
    ).all();
    return c.json({ data: results });
  }

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY name ASC"
  ).all();
  return c.json({ data: results });
});

// GET /api/users/:id — detalhe de um usuário (admin)
users.get("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id") as string;
  const user = await c.env.DB.prepare(
    "SELECT id, name, email, role, active, created_at, updated_at FROM users WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!user) return c.json({ error: "Usuário não encontrado." }, 404);
  return c.json({ data: user });
});

// POST /api/users — cadastra um novo usuário na equipe (admin)
users.post("/", requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  const requester = c.get("user");
  const email = input.email.trim().toLowerCase();

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return c.json({ error: "Já existe um usuário cadastrado com este e-mail." }, 409);
  }

  const id = genId("usr");
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, role, active, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, email, input.name.trim(), input.role, input.active ? 1 : 0, now, now, requester.id, requester.id)
    .run();

  await writeAudit(c.env.DB, { entityType: "user", entityId: id, action: "create", user: requester });

  const created = await c.env.DB.prepare(
    "SELECT id, name, email, role, active, created_at, updated_at FROM users WHERE id = ?"
  )
    .bind(id)
    .first();
  return c.json({ data: created }, 201);
});

// PUT /api/users/:id — edita nome/e-mail/papel/status de um usuário (admin)
users.put("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id") as string;
  const requester = c.get("user");
  const existing = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Usuário não encontrado." }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  // Guarda de segurança: um administrador não pode remover o próprio papel
  // de admin nem desativar a si mesmo — evita que a equipe fique sem
  // nenhum administrador ativo por engano (o que travaria a própria tela
  // de gestão de usuários).
  if (id === requester.id) {
    if (input.role && input.role !== "admin") {
      return c.json({ error: "Você não pode remover seu próprio papel de administrador." }, 400);
    }
    if (input.active === false) {
      return c.json({ error: "Você não pode desativar seu próprio usuário." }, 400);
    }
  }

  const normalized: Record<string, unknown> = {};
  if (input.name !== undefined) normalized.name = input.name.trim();
  if (input.email !== undefined) normalized.email = input.email.trim().toLowerCase();
  if (input.role !== undefined) normalized.role = input.role;
  if (input.active !== undefined) normalized.active = input.active ? 1 : 0;

  if (typeof normalized.email === "string" && normalized.email !== existing.email) {
    const emailTaken = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .bind(normalized.email, id)
      .first();
    if (emailTaken) {
      return c.json({ error: "Já existe um usuário cadastrado com este e-mail." }, 409);
    }
  }

  if (Object.keys(normalized).length === 0) {
    return c.json({ data: existing });
  }

  const now = nowIso();
  const setClauses = Object.keys(normalized)
    .map((key) => `${key} = ?`)
    .concat(["updated_at = ?", "updated_by = ?"]);
  const values = [...Object.values(normalized), now, requester.id, id];

  await c.env.DB.prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const changes = diffFields(existing, normalized);
  for (const change of changes) {
    await writeAudit(c.env.DB, {
      entityType: "user",
      entityId: id,
      action: "update",
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      user: requester,
    });
  }

  const updated = await c.env.DB.prepare(
    "SELECT id, name, email, role, active, created_at, updated_at FROM users WHERE id = ?"
  )
    .bind(id)
    .first();
  return c.json({ data: updated });
});

export default users;
