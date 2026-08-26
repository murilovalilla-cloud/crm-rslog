// Rotas de importação e exportação: /api/import/* e /api/export/*

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../auth";
import { importCommitSchema, importPreviewSchema } from "../validation/schemas";
import { genId, isAdmin, nowIso } from "../utils";
import { processImportRow, summarize, type ImportRow } from "../import";
import { buildExportResponse, type ExportColumn, type ExportFormat } from "../export";

const importExport = new Hono<AppEnv>();

function parseFormat(c: { req: { query: (key: string) => string | undefined } }): ExportFormat {
  const format = c.req.query("format");
  return format === "xlsx" || format === "json" ? format : "csv";
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------
importExport.post("/import/preview", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = importPreviewSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const { entity_type, rows } = parsed.data;
  const user = c.get("user");

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    results.push(await processImportRow(c.env.DB, entity_type, rows[i] as ImportRow, i, user, false));
  }

  return c.json({ data: { summary: summarize(results), rows: results } });
});

importExport.post("/import/commit", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = importCommitSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
  const { entity_type, rows, file_name } = parsed.data;
  const user = c.get("user");

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    results.push(await processImportRow(c.env.DB, entity_type, rows[i] as ImportRow, i, user, true));
  }
  const summary = summarize(results);

  const historyId = genId("imp");
  const now = nowIso();
  const status = summary.errors === 0 ? "concluido" : summary.errors === summary.total ? "falhou" : "concluido_com_erros";

  await c.env.DB.prepare(
    `INSERT INTO import_history (id, file_name, entity_type, total_rows, created_count, updated_count, skipped_count, error_count, status, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(historyId, file_name, entity_type, summary.total, summary.to_create, summary.to_update, 0, summary.errors, status, now, user.id)
    .run();

  return c.json({ data: { summary, rows: results, import_history_id: historyId, status } });
});

importExport.get("/import/history", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ih.*, u.name as created_by_name FROM import_history ih LEFT JOIN users u ON u.id = ih.created_by
     ORDER BY ih.created_at DESC LIMIT 50`
  ).all();
  return c.json({ data: results });
});

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------
const COMPANY_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Empresa" },
  { key: "cnpj", label: "CNPJ" },
  { key: "segment", label: "Segmento" },
  { key: "website", label: "Site" },
  { key: "phone", label: "Telefone" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "source", label: "Origem" },
  { key: "owner_name", label: "Responsável" },
  { key: "created_at", label: "Criado em" },
];

importExport.get("/export/companies", async (c) => {
  const format = parseFormat(c);
  const search = c.req.query("search")?.trim();
  const ownerId = c.req.query("owner_id")?.trim();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (search) {
    conditions.push("(comp.name LIKE ? OR comp.cnpj LIKE ? OR comp.city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (ownerId) {
    conditions.push("comp.owner_id = ?");
    params.push(ownerId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT comp.*, u.name as owner_name FROM companies comp LEFT JOIN users u ON u.id = comp.owner_id ${where} ORDER BY comp.name ASC`
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return buildExportResponse(results, COMPANY_COLUMNS, format, "empresas");
});

const CONTACT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Contato" },
  { key: "company_name", label: "Empresa" },
  { key: "role", label: "Cargo" },
  { key: "is_decision_maker", label: "Decisor" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "whatsapp", label: "WhatsApp" },
];

importExport.get("/export/contacts", async (c) => {
  const format = parseFormat(c);
  const companyId = c.req.query("company_id")?.trim();
  const where = companyId ? "WHERE ct.company_id = ?" : "";
  const stmt = c.env.DB.prepare(
    `SELECT ct.*, comp.name as company_name FROM contacts ct JOIN companies comp ON comp.id = ct.company_id ${where} ORDER BY ct.name ASC`
  );
  const { results } = await (companyId ? stmt.bind(companyId) : stmt).all<Record<string, unknown>>();
  return buildExportResponse(results, CONTACT_COLUMNS, format, "contatos");
});

const OPPORTUNITY_COLUMNS: ExportColumn[] = [
  { key: "title", label: "Oportunidade" },
  { key: "company_name", label: "Empresa" },
  { key: "contact_name", label: "Contato" },
  { key: "stage_name", label: "Etapa" },
  { key: "owner_name", label: "Responsável" },
  { key: "value", label: "Valor" },
  { key: "status", label: "Situação" },
  { key: "expected_close_date", label: "Previsão de fechamento" },
  { key: "closed_at", label: "Fechado em" },
  { key: "created_at", label: "Criado em" },
];

importExport.get("/export/opportunities", async (c) => {
  const format = parseFormat(c);
  const user = c.get("user");
  const stageId = c.req.query("stage_id")?.trim();
  // Mesma regra de visibilidade do Kanban/lista: vendedor só exporta as
  // próprias oportunidades, mesmo que peça outro owner_id na URL.
  const ownerId = isAdmin(user) ? c.req.query("owner_id")?.trim() : user.id;
  const status = c.req.query("status")?.trim();
  const search = c.req.query("search")?.trim();
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
  if (status) {
    conditions.push("o.status = ?");
    params.push(status);
  }
  if (search) {
    conditions.push("(o.title LIKE ? OR comp.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, comp.name as company_name, ct.name as contact_name, s.name as stage_name, u.name as owner_name
     FROM opportunities o
     JOIN companies comp ON comp.id = o.company_id
     LEFT JOIN contacts ct ON ct.id = o.contact_id
     JOIN pipeline_stages s ON s.id = o.stage_id
     LEFT JOIN users u ON u.id = o.owner_id
     ${where} ORDER BY o.created_at DESC`
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return buildExportResponse(results, OPPORTUNITY_COLUMNS, format, "oportunidades");
});

const ACTIVITY_COLUMNS: ExportColumn[] = [
  { key: "title", label: "Atividade" },
  { key: "type", label: "Tipo" },
  { key: "opportunity_title", label: "Oportunidade" },
  { key: "company_name", label: "Empresa" },
  { key: "owner_name", label: "Responsável" },
  { key: "due_at", label: "Data prevista" },
  { key: "status", label: "Situação" },
  { key: "completed_at", label: "Concluída em" },
];

importExport.get("/export/activities", async (c) => {
  const format = parseFormat(c);
  const user = c.get("user");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const status = c.req.query("status")?.trim();
  const ownerId = isAdmin(user) ? c.req.query("owner_id")?.trim() : user.id;
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
  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }
  if (ownerId) {
    conditions.push("a.owner_id = ?");
    params.push(ownerId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, o.title as opportunity_title, comp.name as company_name, u.name as owner_name
     FROM activities a JOIN opportunities o ON o.id = a.opportunity_id JOIN companies comp ON comp.id = o.company_id
     LEFT JOIN users u ON u.id = a.owner_id
     ${where} ORDER BY a.due_at ASC`
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return buildExportResponse(results, ACTIVITY_COLUMNS, format, "atividades");
});

const QUOTE_COLUMNS: ExportColumn[] = [
  { key: "number", label: "Número" },
  { key: "company_name", label: "Empresa" },
  { key: "opportunity_title", label: "Oportunidade" },
  { key: "origin", label: "Origem" },
  { key: "destination", label: "Destino" },
  { key: "cargo_type", label: "Tipo de carga" },
  { key: "vehicle_type", label: "Tipo de veículo" },
  { key: "value", label: "Valor" },
  { key: "estimated_cost", label: "Custo estimado" },
  { key: "estimated_margin", label: "Margem estimada" },
  { key: "status", label: "Situação" },
  { key: "validity_date", label: "Validade" },
  { key: "quote_date", label: "Data" },
];

importExport.get("/export/quotes", async (c) => {
  const format = parseFormat(c);
  const user = c.get("user");
  const status = c.req.query("status")?.trim();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) {
    conditions.push("q.status = ?");
    params.push(status);
  }
  // Cotação não tem dono próprio — a visibilidade segue a da oportunidade a
  // que ela pertence.
  if (!isAdmin(user)) {
    conditions.push("o.owner_id = ?");
    params.push(user.id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT q.*, comp.name as company_name, o.title as opportunity_title
     FROM quotes q JOIN companies comp ON comp.id = q.company_id JOIN opportunities o ON o.id = q.opportunity_id
     ${where} ORDER BY q.created_at DESC`
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return buildExportResponse(results, QUOTE_COLUMNS, format, "cotacoes");
});

const NUTRITION_COLUMNS: ExportColumn[] = [
  { key: "company_name", label: "Empresa" },
  { key: "opportunity_title", label: "Oportunidade" },
  { key: "owner_name", label: "Responsável" },
  { key: "reason", label: "Motivo" },
  { key: "resume_at", label: "Retomar em" },
  { key: "status", label: "Situação" },
  { key: "created_at", label: "Em nutrição desde" },
];

importExport.get("/export/nutrition-leads", async (c) => {
  const format = parseFormat(c);
  const user = c.get("user");
  const status = c.req.query("status")?.trim() ?? "em_nutricao";
  const conditions: string[] = ["nl.status = ?"];
  const params: unknown[] = [status];
  // Lead em nutrição não tem dono próprio — a visibilidade segue a da
  // oportunidade a que ele pertence.
  if (!isAdmin(user)) {
    conditions.push("o.owner_id = ?");
    params.push(user.id);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const { results } = await c.env.DB.prepare(
    `SELECT nl.*, o.title as opportunity_title, comp.name as company_name, u.name as owner_name
     FROM nutrition_leads nl JOIN opportunities o ON o.id = nl.opportunity_id JOIN companies comp ON comp.id = o.company_id
     LEFT JOIN users u ON u.id = o.owner_id
     ${where} ORDER BY nl.resume_at ASC`
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return buildExportResponse(results, NUTRITION_COLUMNS, format, "nutricao");
});

// JSON de backup: dump completo das tabelas de negócio (sem tabelas de
// sistema como audit_log/import_history, que não fazem sentido restaurar).
importExport.get("/export/backup", requireAdmin, async (c) => {
  const tables = [
    "users",
    "companies",
    "contacts",
    "pipeline_stages",
    "opportunities",
    "activities",
    "activity_history",
    "notes",
    "quotes",
    "quote_items",
    "cadence_templates",
    "cadence_steps",
    "lead_cadences",
    "nutrition_leads",
    "loss_reasons",
  ];

  const data: Record<string, unknown> = { generated_at: nowIso() };
  for (const table of tables) {
    const { results } = await c.env.DB.prepare(`SELECT * FROM ${table}`).all();
    data[table] = results;
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-rslog-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

export default importExport;
