-- Migration 0001: schema inicial do CRM RS LOG
-- Banco: Cloudflare D1 (SQLite)
--
-- Convenções:
--   * Identificadores: TEXT (UUID v4 gerado pela aplicação).
--   * Datas/horas: TEXT em formato ISO-8601 UTC (ex.: 2026-08-26T13:00:00.000Z).
--   * Booleanos: INTEGER (0/1).
--   * Dinheiro: REAL (BRL, sem formatação).
--   * created_by / updated_by: referenciam users(id); podem ser NULL em registros
--     criados por processos automáticos (import, sistema).

PRAGMA foreign_keys = ON;

-- ============================================================================
-- users — usuários do CRM (vendedores e administradores), identificados via
-- Cloudflare Access pelo e-mail.
-- ============================================================================
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);

-- ============================================================================
-- loss_reasons — motivos de perda de oportunidade/cotação (catálogo editável)
-- ============================================================================
CREATE TABLE loss_reasons (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- pipeline_stages — etapas do funil Kanban, ordenáveis e personalizáveis
-- ============================================================================
CREATE TABLE pipeline_stages (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  position       INTEGER NOT NULL,
  color          TEXT NOT NULL DEFAULT '#1f3566',
  is_won         INTEGER NOT NULL DEFAULT 0 CHECK (is_won IN (0, 1)),
  is_lost        INTEGER NOT NULL DEFAULT 0 CHECK (is_lost IN (0, 1)),
  is_nutrition   INTEGER NOT NULL DEFAULT 0 CHECK (is_nutrition IN (0, 1)),
  active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by     TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_pipeline_stages_position ON pipeline_stages(position);

-- ============================================================================
-- companies — empresas prospectadas/clientes
-- ============================================================================
CREATE TABLE companies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  cnpj         TEXT,
  segment      TEXT,
  website      TEXT,
  phone        TEXT,
  city         TEXT,
  state        TEXT,
  source       TEXT,              -- origem do lead (indicação, site, evento, cold call, etc.)
  notes        TEXT,
  owner_id     TEXT REFERENCES users(id) ON DELETE SET NULL,  -- responsável comercial
  created_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_owner ON companies(owner_id);
CREATE INDEX idx_companies_cnpj ON companies(cnpj);
CREATE INDEX idx_companies_source ON companies(source);

-- ============================================================================
-- contacts — pessoas de contato dentro de uma empresa
-- ============================================================================
CREATE TABLE contacts (
  id                  TEXT PRIMARY KEY,
  company_id          TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  role                TEXT,             -- cargo
  is_decision_maker   INTEGER NOT NULL DEFAULT 0 CHECK (is_decision_maker IN (0, 1)),
  email               TEXT,
  phone               TEXT,
  whatsapp            TEXT,
  created_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by          TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_name ON contacts(name);

-- ============================================================================
-- opportunities — oportunidades de venda (cards do Kanban)
-- ============================================================================
CREATE TABLE opportunities (
  id                    TEXT PRIMARY KEY,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id            TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  stage_id              TEXT NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  owner_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
  value                 REAL,                     -- valor estimado da oportunidade
  status                TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'ganha', 'perdida', 'nutricao')),
  loss_reason_id        TEXT REFERENCES loss_reasons(id) ON DELETE SET NULL,
  expected_close_date   TEXT,
  closed_at             TEXT,
  created_at            TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by            TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by            TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_opportunities_company ON opportunities(company_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at);

-- ============================================================================
-- activities — atividades agendadas (calendário) ligadas a uma oportunidade
-- ============================================================================
CREATE TABLE activities (
  id               TEXT PRIMARY KEY,
  opportunity_id   TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('ligacao', 'email', 'whatsapp', 'reuniao', 'visita', 'followup', 'outro')),
  title            TEXT NOT NULL,
  description      TEXT,
  due_at           TEXT NOT NULL,     -- data/hora prevista
  completed_at     TEXT,
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'cancelada')),
  owner_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by       TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_activities_opportunity ON activities(opportunity_id);
CREATE INDEX idx_activities_due_at ON activities(due_at);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_owner ON activities(owner_id);

-- ============================================================================
-- activity_history — linha do tempo de uma oportunidade (o que efetivamente
-- aconteceu: ligações feitas, e-mails enviados, reuniões, mudanças de etapa)
-- ============================================================================
CREATE TABLE activity_history (
  id               TEXT PRIMARY KEY,
  opportunity_id   TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('ligacao', 'email', 'whatsapp', 'reuniao', 'visita', 'cotacao', 'observacao', 'mudanca_etapa', 'sistema')),
  description      TEXT NOT NULL,
  activity_id      TEXT REFERENCES activities(id) ON DELETE SET NULL,  -- atividade agendada de origem, se houver
  from_stage_id    TEXT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id      TEXT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  occurred_at      TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_activity_history_opportunity ON activity_history(opportunity_id);
CREATE INDEX idx_activity_history_occurred_at ON activity_history(occurred_at);
CREATE INDEX idx_activity_history_type ON activity_history(type);

-- ============================================================================
-- notes — anotações livres associadas a uma oportunidade
-- ============================================================================
CREATE TABLE notes (
  id               TEXT PRIMARY KEY,
  opportunity_id   TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by       TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_notes_opportunity ON notes(opportunity_id);

-- ============================================================================
-- quotes — cotações de frete vinculadas a uma oportunidade (Etapa 2)
-- ============================================================================
CREATE TABLE quotes (
  id                  TEXT PRIMARY KEY,
  number              TEXT NOT NULL UNIQUE,
  opportunity_id      TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  company_id          TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id          TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  quote_date          TEXT NOT NULL,
  origin              TEXT,             -- origem da carga
  destination         TEXT,             -- destino da carga
  cargo_type          TEXT,             -- tipo de carga
  vehicle_type        TEXT,             -- tipo de veículo
  value               REAL,             -- valor cobrado do cliente
  estimated_cost       REAL,             -- custo estimado da operação
  estimated_margin     REAL,             -- margem estimada (value - estimated_cost)
  validity_date       TEXT,
  status              TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'aprovada', 'recusada', 'expirada')),
  loss_reason_id      TEXT REFERENCES loss_reasons(id) ON DELETE SET NULL,
  observations        TEXT,
  created_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by          TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX idx_quotes_company ON quotes(company_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- ============================================================================
-- quote_items — itens/linhas de uma cotação (Etapa 2)
-- ============================================================================
CREATE TABLE quote_items (
  id            TEXT PRIMARY KEY,
  quote_id      TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 1,
  unit_value    REAL NOT NULL DEFAULT 0,
  total_value   REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

-- ============================================================================
-- cadence_templates — modelos de cadência de prospecção (Etapa 2)
-- ============================================================================
CREATE TABLE cadence_templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- cadence_steps — passos de uma cadência (Etapa 2)
-- ============================================================================
CREATE TABLE cadence_steps (
  id                     TEXT PRIMARY KEY,
  cadence_template_id    TEXT NOT NULL REFERENCES cadence_templates(id) ON DELETE CASCADE,
  step_order             INTEGER NOT NULL,
  type                   TEXT NOT NULL CHECK (type IN ('ligacao', 'email', 'whatsapp', 'reuniao', 'followup')),
  day_offset             INTEGER NOT NULL DEFAULT 0,  -- dias após o início da cadência
  title                  TEXT NOT NULL,
  description            TEXT,
  created_at             TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by             TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by             TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_cadence_steps_order ON cadence_steps(cadence_template_id, step_order);

-- ============================================================================
-- lead_cadences — cadência aplicada a uma oportunidade específica (Etapa 2)
-- ============================================================================
CREATE TABLE lead_cadences (
  id                     TEXT PRIMARY KEY,
  opportunity_id         TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  cadence_template_id    TEXT NOT NULL REFERENCES cadence_templates(id) ON DELETE RESTRICT,
  started_at             TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'concluida', 'cancelada')),
  current_step           INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by             TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by             TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_lead_cadences_opportunity ON lead_cadences(opportunity_id);
CREATE INDEX idx_lead_cadences_template ON lead_cadences(cadence_template_id);

-- ============================================================================
-- nutrition_leads — leads em nutrição (sem resposta / sem oportunidade
-- imediata), mantendo o histórico da oportunidade original (Etapa 2)
-- ============================================================================
CREATE TABLE nutrition_leads (
  id               TEXT PRIMARY KEY,
  opportunity_id   TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  reason           TEXT,
  resume_at        TEXT,             -- data programada de retomada
  status           TEXT NOT NULL DEFAULT 'em_nutricao' CHECK (status IN ('em_nutricao', 'retomado')),
  returned_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by       TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_nutrition_leads_opportunity ON nutrition_leads(opportunity_id);
CREATE INDEX idx_nutrition_leads_resume_at ON nutrition_leads(resume_at);
CREATE INDEX idx_nutrition_leads_status ON nutrition_leads(status);

-- ============================================================================
-- import_history — histórico de importações de planilhas (Etapa 2)
-- ============================================================================
CREATE TABLE import_history (
  id               TEXT PRIMARY KEY,
  file_name        TEXT NOT NULL,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('companies', 'contacts', 'opportunities')),
  total_rows       INTEGER NOT NULL DEFAULT 0,
  created_count    INTEGER NOT NULL DEFAULT 0,
  updated_count    INTEGER NOT NULL DEFAULT 0,
  skipped_count    INTEGER NOT NULL DEFAULT 0,
  error_count      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'concluido' CHECK (status IN ('concluido', 'concluido_com_erros', 'falhou')),
  created_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_import_history_entity ON import_history(entity_type);

-- ============================================================================
-- audit_log — trilha de auditoria de alterações importantes no sistema
-- ============================================================================
CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL,     -- ex.: 'opportunity', 'company', 'contact', 'activity'
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,     -- ex.: 'create', 'update', 'delete', 'stage_change'
  field_name    TEXT,
  old_value     TEXT,
  new_value     TEXT,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email    TEXT,
  occurred_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
