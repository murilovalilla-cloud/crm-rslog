// Lógica de importação (preview e commit) de empresas, contatos e
// oportunidades a partir de linhas já mapeadas pelo frontend (o usuário
// relaciona as colunas da planilha aos campos do CRM antes de enviar).
//
// Cada linha passa por: (1) validação dos campos obrigatórios, (2)
// resolução de referências (empresa/contato/etapa/responsável) e (3)
// detecção de duplicidade — se um registro equivalente já existe, a linha
// vira uma atualização em vez de uma criação nova.

import { emptyToNull, genId, nowIso, writeAudit } from "./utils";
import type { AuthUser } from "./types";

export type ImportEntity = "companies" | "contacts" | "opportunities";
export type ImportRow = Record<string, string | number | boolean | null>;

export interface RowResult {
  index: number;
  action: "create" | "update" | "error";
  errors: string[];
  label: string;
  entityId?: string;
}

export function str(row: ImportRow, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export function num(row: ImportRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function bool(row: ImportRow, key: string): boolean {
  const value = row[key];
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  return ["sim", "yes", "true", "1", "x"].includes(s);
}

async function resolveCompanyId(db: D1Database, row: ImportRow): Promise<{ id: string | null; error?: string }> {
  const cnpj = str(row, "company_cnpj") ?? str(row, "cnpj");
  const name = str(row, "company_name") ?? str(row, "name");

  if (cnpj) {
    const byCnpj = await db.prepare("SELECT id FROM companies WHERE TRIM(cnpj) = TRIM(?)").bind(cnpj).first<{ id: string }>();
    if (byCnpj) return { id: byCnpj.id };
  }
  if (name) {
    const byName = await db.prepare("SELECT id FROM companies WHERE name = ? COLLATE NOCASE").bind(name).first<{ id: string }>();
    if (byName) return { id: byName.id };
  }
  return { id: null, error: "Empresa não encontrada (informe company_name ou company_cnpj de uma empresa já cadastrada)" };
}

async function resolveOwnerId(db: D1Database, email: string | null): Promise<string | null> {
  if (!email) return null;
  const user = await db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND active = 1").bind(email).first<{ id: string }>();
  return user?.id ?? null;
}

async function resolveStageId(db: D1Database, name: string | null): Promise<{ id: string | null; error?: string }> {
  if (!name) {
    const first = await db.prepare("SELECT id FROM pipeline_stages WHERE active = 1 ORDER BY position ASC LIMIT 1").first<{ id: string }>();
    return { id: first?.id ?? null };
  }
  const stage = await db.prepare("SELECT id FROM pipeline_stages WHERE name = ? COLLATE NOCASE AND active = 1").bind(name).first<{ id: string }>();
  if (!stage) return { id: null, error: `Etapa "${name}" não encontrada` };
  return { id: stage.id };
}

async function processCompanyRow(db: D1Database, row: ImportRow, index: number, user: AuthUser, commit: boolean): Promise<RowResult> {
  const name = str(row, "name");
  if (!name || name.length < 2) {
    return { index, action: "error", errors: ["Nome da empresa é obrigatório (mínimo 2 caracteres)"], label: name ?? "(sem nome)" };
  }

  const cnpj = str(row, "cnpj");
  const fields = {
    name,
    cnpj,
    segment: str(row, "segment"),
    website: str(row, "website"),
    phone: str(row, "phone"),
    city: str(row, "city"),
    state: str(row, "state"),
    source: str(row, "source"),
    notes: str(row, "notes"),
    owner_id: await resolveOwnerId(db, str(row, "owner_email")),
  };

  let existingId: string | null = null;
  if (cnpj) {
    const byCnpj = await db.prepare("SELECT id FROM companies WHERE TRIM(cnpj) = TRIM(?)").bind(cnpj).first<{ id: string }>();
    existingId = byCnpj?.id ?? null;
  }
  if (!existingId) {
    const byName = await db.prepare("SELECT id FROM companies WHERE name = ? COLLATE NOCASE").bind(name).first<{ id: string }>();
    existingId = byName?.id ?? null;
  }

  const now = nowIso();
  if (existingId) {
    if (commit) {
      await db
        .prepare(
          `UPDATE companies SET cnpj = COALESCE(?, cnpj), segment = COALESCE(?, segment), website = COALESCE(?, website),
             phone = COALESCE(?, phone), city = COALESCE(?, city), state = COALESCE(?, state), source = COALESCE(?, source),
             notes = COALESCE(?, notes), owner_id = COALESCE(?, owner_id), updated_at = ?, updated_by = ? WHERE id = ?`
        )
        .bind(fields.cnpj, fields.segment, fields.website, fields.phone, fields.city, fields.state, fields.source, fields.notes, fields.owner_id, now, user.id, existingId)
        .run();
      await writeAudit(db, { entityType: "company", entityId: existingId, action: "import_update", user });
    }
    return { index, action: "update", errors: [], label: name, entityId: existingId };
  }

  const id = genId("cmp");
  if (commit) {
    await db
      .prepare(
        `INSERT INTO companies (id, name, cnpj, segment, website, phone, city, state, source, notes, owner_id, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, fields.name, fields.cnpj, fields.segment, fields.website, fields.phone, fields.city, fields.state, fields.source, fields.notes, fields.owner_id, now, now, user.id, user.id)
      .run();
    await writeAudit(db, { entityType: "company", entityId: id, action: "import_create", user });
  }
  return { index, action: "create", errors: [], label: name, entityId: commit ? id : undefined };
}

async function processContactRow(db: D1Database, row: ImportRow, index: number, user: AuthUser, commit: boolean): Promise<RowResult> {
  const name = str(row, "name");
  if (!name || name.length < 2) {
    return { index, action: "error", errors: ["Nome do contato é obrigatório (mínimo 2 caracteres)"], label: name ?? "(sem nome)" };
  }

  const company = await resolveCompanyId(db, row);
  if (!company.id) {
    return { index, action: "error", errors: [company.error ?? "Empresa não encontrada"], label: name };
  }

  const email = str(row, "email");
  const fields = {
    role: str(row, "role"),
    is_decision_maker: bool(row, "is_decision_maker") ? 1 : 0,
    email,
    phone: str(row, "phone"),
    whatsapp: str(row, "whatsapp"),
  };

  let existingId: string | null = null;
  if (email) {
    const byEmail = await db
      .prepare("SELECT id FROM contacts WHERE company_id = ? AND email = ? COLLATE NOCASE")
      .bind(company.id, email)
      .first<{ id: string }>();
    existingId = byEmail?.id ?? null;
  }
  if (!existingId) {
    const byName = await db
      .prepare("SELECT id FROM contacts WHERE company_id = ? AND name = ? COLLATE NOCASE")
      .bind(company.id, name)
      .first<{ id: string }>();
    existingId = byName?.id ?? null;
  }

  const now = nowIso();
  if (existingId) {
    if (commit) {
      await db
        .prepare(
          `UPDATE contacts SET role = COALESCE(?, role), is_decision_maker = ?, email = COALESCE(?, email),
             phone = COALESCE(?, phone), whatsapp = COALESCE(?, whatsapp), updated_at = ?, updated_by = ? WHERE id = ?`
        )
        .bind(fields.role, fields.is_decision_maker, fields.email, fields.phone, fields.whatsapp, now, user.id, existingId)
        .run();
      await writeAudit(db, { entityType: "contact", entityId: existingId, action: "import_update", user });
    }
    return { index, action: "update", errors: [], label: name, entityId: existingId };
  }

  const id = genId("ctc");
  if (commit) {
    await db
      .prepare(
        `INSERT INTO contacts (id, company_id, name, role, is_decision_maker, email, phone, whatsapp, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, company.id, name, fields.role, fields.is_decision_maker, fields.email, fields.phone, fields.whatsapp, now, now, user.id, user.id)
      .run();
    await writeAudit(db, { entityType: "contact", entityId: id, action: "import_create", user });
  }
  return { index, action: "create", errors: [], label: name, entityId: commit ? id : undefined };
}

async function processOpportunityRow(db: D1Database, row: ImportRow, index: number, user: AuthUser, commit: boolean): Promise<RowResult> {
  const title = str(row, "title");
  if (!title || title.length < 2) {
    return { index, action: "error", errors: ["Título da oportunidade é obrigatório (mínimo 2 caracteres)"], label: title ?? "(sem título)" };
  }

  const company = await resolveCompanyId(db, row);
  if (!company.id) {
    return { index, action: "error", errors: [company.error ?? "Empresa não encontrada"], label: title };
  }

  const stage = await resolveStageId(db, str(row, "stage_name"));
  if (!stage.id) {
    return { index, action: "error", errors: [stage.error ?? "Não foi possível determinar a etapa"], label: title };
  }

  const contactName = str(row, "contact_name");
  let contactId: string | null = null;
  if (contactName) {
    const contact = await db
      .prepare("SELECT id FROM contacts WHERE company_id = ? AND name = ? COLLATE NOCASE")
      .bind(company.id, contactName)
      .first<{ id: string }>();
    contactId = contact?.id ?? null;
  }

  const ownerId = await resolveOwnerId(db, str(row, "owner_email"));
  const value = num(row, "value");
  const expectedCloseDate = emptyToNull(str(row, "expected_close_date"));

  const existing = await db
    .prepare("SELECT id FROM opportunities WHERE company_id = ? AND title = ? COLLATE NOCASE")
    .bind(company.id, title)
    .first<{ id: string }>();

  const now = nowIso();
  if (existing) {
    if (commit) {
      await db
        .prepare(
          `UPDATE opportunities SET contact_id = COALESCE(?, contact_id), owner_id = COALESCE(?, owner_id),
             value = COALESCE(?, value), expected_close_date = COALESCE(?, expected_close_date), updated_at = ?, updated_by = ? WHERE id = ?`
        )
        .bind(contactId, ownerId, value, expectedCloseDate, now, user.id, existing.id)
        .run();
      await writeAudit(db, { entityType: "opportunity", entityId: existing.id, action: "import_update", user });
    }
    return { index, action: "update", errors: [], label: title, entityId: existing.id };
  }

  const id = genId("opp");
  if (commit) {
    await db
      .prepare(
        `INSERT INTO opportunities (id, company_id, contact_id, title, stage_id, owner_id, value, status, expected_close_date, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'aberta', ?, ?, ?, ?, ?)`
      )
      .bind(id, company.id, contactId, title, stage.id, ownerId, value, expectedCloseDate, now, now, user.id, user.id)
      .run();
    await db
      .prepare(
        `INSERT INTO activity_history (id, opportunity_id, type, description, occurred_at, created_at, created_by)
         VALUES (?, ?, 'sistema', 'Oportunidade criada via importação.', ?, ?, ?)`
      )
      .bind(genId("hist"), id, now, now, user.id)
      .run();
    await writeAudit(db, { entityType: "opportunity", entityId: id, action: "import_create", user });
  }
  return { index, action: "create", errors: [], label: title, entityId: commit ? id : undefined };
}

export async function processImportRow(
  db: D1Database,
  entity: ImportEntity,
  row: ImportRow,
  index: number,
  user: AuthUser,
  commit: boolean
): Promise<RowResult> {
  if (entity === "companies") return processCompanyRow(db, row, index, user, commit);
  if (entity === "contacts") return processContactRow(db, row, index, user, commit);
  return processOpportunityRow(db, row, index, user, commit);
}

export function summarize(results: RowResult[]) {
  return {
    total: results.length,
    to_create: results.filter((r) => r.action === "create").length,
    to_update: results.filter((r) => r.action === "update").length,
    errors: results.filter((r) => r.action === "error").length,
  };
}
