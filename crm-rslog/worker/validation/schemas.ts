// Schemas de validação (Zod) usados pelas rotas do Worker.
//
// O frontend também valida os formulários antes de enviar, mas TODA
// validação relevante é repetida aqui — o backend nunca confia apenas no
// que o cliente enviou.

import { z } from "zod";

const optionalString = z.string().trim().max(2000).optional().nullable();

const emailField = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .refine((val) => !val || z.string().email().safeParse(val).success, {
    message: "E-mail inválido",
  });

const isoDateField = z
  .string()
  .trim()
  .refine((val) => !Number.isNaN(new Date(val).getTime()), { message: "Data inválida" });

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------
export const companyCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome da empresa é obrigatório (mínimo 2 caracteres)").max(255),
  cnpj: optionalString,
  segment: optionalString,
  website: optionalString,
  phone: optionalString,
  city: optionalString,
  state: z.string().trim().max(2).optional().nullable(),
  source: optionalString,
  notes: z.string().trim().max(5000).optional().nullable(),
  owner_id: z.string().trim().optional().nullable(),
});
export const companyUpdateSchema = companyCreateSchema.partial();
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------
export const contactCreateSchema = z.object({
  company_id: z.string().trim().min(1, "Empresa é obrigatória"),
  name: z.string().trim().min(2, "Nome do contato é obrigatório").max(255),
  role: optionalString,
  is_decision_maker: z.boolean().optional().default(false),
  email: emailField,
  phone: optionalString,
  whatsapp: optionalString,
});
export const contactUpdateSchema = contactCreateSchema.partial();
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------
export const pipelineStageCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome da etapa é obrigatório").max(120),
  position: z.number().int().min(1).optional(),
  color: z.string().trim().max(20).optional(),
  is_won: z.boolean().optional().default(false),
  is_lost: z.boolean().optional().default(false),
  is_nutrition: z.boolean().optional().default(false),
});
export const pipelineStageUpdateSchema = pipelineStageCreateSchema.partial();
export const pipelineStageReorderSchema = z.object({
  stages: z
    .array(z.object({ id: z.string().min(1), position: z.number().int().min(1) }))
    .min(1, "Informe ao menos uma etapa"),
});

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------
export const opportunityCreateSchema = z.object({
  company_id: z.string().trim().min(1, "Empresa é obrigatória"),
  contact_id: z.string().trim().optional().nullable(),
  title: z.string().trim().min(2, "Título da oportunidade é obrigatório").max(255),
  stage_id: z.string().trim().optional(),
  owner_id: z.string().trim().optional().nullable(),
  value: z.number().nonnegative("Valor não pode ser negativo").optional().nullable(),
  expected_close_date: z.string().trim().optional().nullable(),
});
export const opportunityUpdateSchema = opportunityCreateSchema.partial();

export const opportunityStageChangeSchema = z.object({
  stage_id: z.string().trim().min(1, "Etapa de destino é obrigatória"),
  loss_reason_id: z.string().trim().optional().nullable(),
  note: z.string().trim().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export const activityTypeEnum = z.enum([
  "ligacao",
  "email",
  "whatsapp",
  "reuniao",
  "visita",
  "followup",
  "outro",
]);

export const activityCreateSchema = z.object({
  opportunity_id: z.string().trim().min(1, "Oportunidade é obrigatória"),
  type: activityTypeEnum,
  title: z.string().trim().min(2, "Título da atividade é obrigatório").max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  due_at: isoDateField,
  owner_id: z.string().trim().optional().nullable(),
});
export const activityUpdateSchema = activityCreateSchema.partial().omit({ opportunity_id: true });

export const activityCompleteSchema = z.object({
  completed_at: z.string().trim().optional(),
  outcome_note: z.string().trim().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Activity history (linha do tempo)
// ---------------------------------------------------------------------------
export const historyTypeEnum = z.enum([
  "ligacao",
  "email",
  "whatsapp",
  "reuniao",
  "visita",
  "cotacao",
  "observacao",
]);

export const historyCreateSchema = z.object({
  type: historyTypeEnum,
  description: z.string().trim().min(1, "Descrição é obrigatória").max(4000),
  occurred_at: z.string().trim().optional(),
  activity_id: z.string().trim().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export const noteCreateSchema = z.object({
  content: z.string().trim().min(1, "Conteúdo da nota é obrigatório").max(5000),
});
export const noteUpdateSchema = noteCreateSchema;

// ---------------------------------------------------------------------------
// Quotes (cotações)
// ---------------------------------------------------------------------------
export const quoteStatusEnum = z.enum(["rascunho", "enviada", "aprovada", "recusada", "expirada"]);

export const quoteCreateSchema = z.object({
  contact_id: z.string().trim().optional().nullable(),
  quote_date: z.string().trim().optional(),
  origin: optionalString,
  destination: optionalString,
  cargo_type: optionalString,
  vehicle_type: optionalString,
  value: z.number().nonnegative("Valor não pode ser negativo").optional().nullable(),
  estimated_cost: z.number().nonnegative("Custo não pode ser negativo").optional().nullable(),
  estimated_margin: z.number().optional().nullable(),
  validity_date: z.string().trim().optional().nullable(),
  observations: z.string().trim().max(5000).optional().nullable(),
});
export const quoteUpdateSchema = quoteCreateSchema.partial();

export const quoteStatusChangeSchema = z.object({
  status: quoteStatusEnum,
  loss_reason_id: z.string().trim().optional().nullable(),
});

export const quoteItemCreateSchema = z.object({
  description: z.string().trim().min(1, "Descrição do item é obrigatória").max(500),
  quantity: z.number().positive("Quantidade deve ser maior que zero").default(1),
  unit_value: z.number().nonnegative("Valor unitário não pode ser negativo").default(0),
});
export const quoteItemUpdateSchema = quoteItemCreateSchema.partial();

// ---------------------------------------------------------------------------
// Cadências
// ---------------------------------------------------------------------------
export const cadenceStepTypeEnum = z.enum(["ligacao", "email", "whatsapp", "reuniao", "followup"]);

export const cadenceStepInputSchema = z.object({
  id: z.string().trim().optional(), // presente ao editar um passo já existente
  step_order: z.number().int().min(1),
  type: cadenceStepTypeEnum,
  day_offset: z.number().int().min(0, "Deslocamento em dias não pode ser negativo"),
  title: z.string().trim().min(2, "Título do passo é obrigatório").max(255),
  description: optionalString,
});

export const cadenceTemplateCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome da cadência é obrigatório").max(160),
  description: optionalString,
  steps: z.array(cadenceStepInputSchema).min(1, "Adicione ao menos um passo à cadência"),
});
export const cadenceTemplateUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: optionalString,
  active: z.boolean().optional(),
  steps: z.array(cadenceStepInputSchema).optional(),
});

export const applyCadenceSchema = z.object({
  cadence_template_id: z.string().trim().min(1, "Selecione um modelo de cadência"),
  started_at: z.string().trim().optional(),
});

// ---------------------------------------------------------------------------
// Nutrição
// ---------------------------------------------------------------------------
export const nutritionUpdateSchema = z.object({
  reason: optionalString,
  resume_at: z.string().trim().optional().nullable(),
});

export const nutritionResumeSchema = z.object({
  stage_id: z.string().trim().min(1, "Selecione a etapa de retomada"),
  note: z.string().trim().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------
export const importEntityEnum = z.enum(["companies", "contacts", "opportunities"]);

export const importRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const importPreviewSchema = z.object({
  entity_type: importEntityEnum,
  file_name: z.string().trim().min(1).max(255),
  rows: z.array(importRowSchema).min(1, "A planilha não contém linhas para importar").max(2000, "Limite de 2000 linhas por importação"),
});

export const importCommitSchema = importPreviewSchema;

// ---------------------------------------------------------------------------
// Usuários (gestão de equipe — Etapa 3)
// ---------------------------------------------------------------------------
export const userRoleEnum = z.enum(["admin", "vendedor"]);

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório (mínimo 2 caracteres)").max(255),
  email: z.string().trim().min(3, "E-mail é obrigatório").max(255).email("E-mail inválido"),
  role: userRoleEnum.optional().default("vendedor"),
  active: z.boolean().optional().default(true),
});
export const userUpdateSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório (mínimo 2 caracteres)").max(255).optional(),
  email: z.string().trim().min(3).max(255).email("E-mail inválido").optional(),
  role: userRoleEnum.optional(),
  active: z.boolean().optional(),
});
