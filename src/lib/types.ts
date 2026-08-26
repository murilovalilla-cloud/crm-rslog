// Tipos do frontend, espelhando o formato retornado pela API (snake_case,
// igual ao schema do banco — evita uma camada extra de mapeamento).

export type UserRole = "admin" | "vendedor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Usuário com os campos adicionais usados na tela de gestão de equipe (admin). */
export interface UserAdmin extends User {
  active: 0 | 1;
  created_at: string;
  updated_at: string;
}

/** Linha da trilha de auditoria (audit_log), usada na tela de auditoria (admin). */
export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  occurred_at: string;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  notes: string | null;
  owner_id: string | null;
  owner_name?: string | null;
  contacts_count?: number;
  opportunities_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyDetail extends Company {
  contacts: Contact[];
  opportunities: Array<{ id: string; title: string; value: number | null; status: string; stage_id: string; stage_name: string }>;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  is_decision_maker: 0 | 1;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_won: 0 | 1;
  is_lost: 0 | 1;
  is_nutrition: 0 | 1;
  active: 0 | 1;
}

export type AlertLevel = "atrasada" | "hoje" | "futura" | "concluida" | null;

export interface NextActivitySummary {
  id: string;
  type: ActivityType;
  title: string;
  due_at: string;
  status: string;
}

export interface Opportunity {
  id: string;
  company_id: string;
  contact_id: string | null;
  title: string;
  stage_id: string;
  owner_id: string | null;
  value: number | null;
  status: "aberta" | "ganha" | "perdida" | "nutricao";
  loss_reason_id: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  /** Nome do decisor digitado livremente (usado quando ainda não há contato cadastrado). */
  decision_maker_name?: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  contact_name?: string | null;
  owner_name?: string | null;
  stage_name?: string;
  next_activity?: NextActivitySummary | null;
  alert_level?: AlertLevel;
  overdue_days?: number;
}

export interface HistoryEntry {
  id: string;
  opportunity_id: string;
  type: string;
  description: string;
  activity_id: string | null;
  from_stage_id: string | null;
  to_stage_id: string | null;
  from_stage_name?: string | null;
  to_stage_name?: string | null;
  occurred_at: string;
  created_by_name?: string | null;
}

export interface Note {
  id: string;
  opportunity_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
}

export interface OpportunityDetail extends Opportunity {
  company_phone?: string | null;
  contacts: Contact[];
  activities: Activity[];
  history: HistoryEntry[];
  notes: Note[];
  quotes: Quote[];
}

export type ActivityType = "ligacao" | "email" | "whatsapp" | "reuniao" | "visita" | "followup" | "outro";
export type ActivityStatus = "pendente" | "concluida" | "cancelada";

export interface Activity {
  id: string;
  opportunity_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  due_at: string;
  completed_at: string | null;
  status: ActivityStatus;
  owner_id: string | null;
  owner_name?: string | null;
  opportunity_title?: string;
  company_name?: string;
  alert_level?: AlertLevel;
  overdue_days?: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Cotações
// ---------------------------------------------------------------------------
export type QuoteStatus = "rascunho" | "enviada" | "aprovada" | "recusada" | "expirada";

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_value: number;
  total_value: number;
}

export interface Quote {
  id: string;
  number: string;
  opportunity_id: string;
  company_id: string;
  contact_id: string | null;
  quote_date: string;
  origin: string | null;
  destination: string | null;
  cargo_type: string | null;
  vehicle_type: string | null;
  value: number | null;
  estimated_cost: number | null;
  estimated_margin: number | null;
  validity_date: string | null;
  status: QuoteStatus;
  loss_reason_id: string | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
  company_name?: string;
  opportunity_title?: string;
}

export interface QuoteDetail extends Quote {
  items: QuoteItem[];
}

// ---------------------------------------------------------------------------
// Cadências
// ---------------------------------------------------------------------------
export type CadenceStepType = "ligacao" | "email" | "whatsapp" | "reuniao" | "followup";

export interface CadenceStep {
  id: string;
  cadence_template_id: string;
  step_order: number;
  type: CadenceStepType;
  day_offset: number;
  title: string;
  description: string | null;
}

export interface CadenceTemplate {
  id: string;
  name: string;
  description: string | null;
  active: 0 | 1;
  steps_count?: number;
}

export interface CadenceTemplateDetail extends CadenceTemplate {
  steps: CadenceStep[];
}

export interface LeadCadence {
  id: string;
  opportunity_id: string;
  cadence_template_id: string;
  template_name?: string;
  started_at: string;
  status: "ativa" | "concluida" | "cancelada";
  current_step: number;
}

// ---------------------------------------------------------------------------
// Nutrição
// ---------------------------------------------------------------------------
export interface NutritionLead {
  id: string;
  opportunity_id: string;
  reason: string | null;
  resume_at: string | null;
  status: "em_nutricao" | "retomado";
  returned_at: string | null;
  created_at: string;
  opportunity_title?: string;
  opportunity_value?: number | null;
  owner_id?: string | null;
  owner_name?: string | null;
  company_name?: string;
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------
export type ImportEntity = "companies" | "contacts" | "opportunities";

export interface ImportRowResult {
  index: number;
  action: "create" | "update" | "error";
  errors: string[];
  label: string;
  entityId?: string;
}

export interface ImportSummary {
  total: number;
  to_create: number;
  to_update: number;
  errors: number;
}

export interface ImportPreviewResponse {
  summary: ImportSummary;
  rows: ImportRowResult[];
}

export interface ImportCommitResponse extends ImportPreviewResponse {
  import_history_id: string;
  status: string;
}

export interface ImportHistoryRecord {
  id: string;
  file_name: string;
  entity_type: ImportEntity;
  total_rows: number;
  created_count: number;
  updated_count: number;
  error_count: number;
  status: string;
  created_at: string;
  created_by_name?: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export interface DashboardTotals {
  total_leads: number;
  new_leads_month: number;
  contacts_made_month: number;
  overdue_activities: number;
  today_activities: number;
  qualified_leads: number;
  quotes_requested: number;
  quotes_sent: number;
  total_quoted_value: number;
  won_deals: number;
  won_revenue: number;
  avg_ticket: number;
  avg_days_to_close: number | null;
  open_funnel_value: number;
  revenue_forecast: number;
  stalled_deals: number;
}

export interface DashboardData {
  generated_at: string;
  totals: DashboardTotals;
  stage_distribution: Array<{ stage_id: string; stage_name: string; position: number; count: number; value: number }>;
  sales_by_owner: Array<{ owner_id: string; owner_name: string; count: number; value: number }>;
  activities_by_owner: Array<{ owner_id: string; owner_name: string; count: number }>;
  best_lead_sources: Array<{ source: string; count: number; value: number }>;
  loss_reasons: Array<{ reason: string; count: number }>;
  stalled_deals_list: Array<{
    id: string;
    title: string;
    company_name: string;
    value: number | null;
    owner_name: string | null;
    last_touch_at: string;
  }>;
}
