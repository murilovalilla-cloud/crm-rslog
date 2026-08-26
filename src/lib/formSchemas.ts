// Validações de formulário no frontend. Espelham (de forma simplificada) as
// regras aplicadas no backend (worker/validation/schemas.ts) — a validação
// real e definitiva é sempre repetida no servidor.

import { z } from "zod";
import { parseBRLNumber } from "./utils";

export const companyFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  cnpj: z.string().trim().optional(),
  segment: z.string().trim().optional(),
  website: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2, "Use a sigla do estado (ex.: RS).").optional(),
  source: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  owner_id: z.string().trim().optional(),
});
export type CompanyFormValues = z.infer<typeof companyFormSchema>;

export const contactFormSchema = z.object({
  company_id: z.string().min(1, "Selecione a empresa."),
  name: z.string().trim().min(2, "Informe o nome do contato."),
  role: z.string().trim().optional(),
  is_decision_maker: z.boolean().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /.+@.+\..+/.test(v), "E-mail inválido."),
  phone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
});
export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const opportunityFormSchema = z.object({
  company_id: z.string().min(1, "Selecione a empresa."),
  contact_id: z.string().optional(),
  title: z.string().trim().min(2, "Informe um título para a oportunidade."),
  owner_id: z.string().optional(),
  value: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || parseBRLNumber(v) !== null, "Valor inválido."),
  expected_close_date: z.string().trim().optional(),
  decision_maker_name: z.string().trim().optional(),
});
export type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

export const activityFormSchema = z.object({
  type: z.enum(["ligacao", "email", "whatsapp", "reuniao", "visita", "followup", "outro"]),
  title: z.string().trim().min(2, "Informe um título para a atividade."),
  description: z.string().trim().optional(),
  due_at: z.string().trim().min(1, "Informe a data e hora da atividade."),
  owner_id: z.string().optional(),
});
export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export const historyFormSchema = z.object({
  type: z.enum(["ligacao", "email", "whatsapp", "reuniao", "visita", "cotacao", "observacao"]),
  description: z.string().trim().min(1, "Descreva o que aconteceu."),
});
export type HistoryFormValues = z.infer<typeof historyFormSchema>;

export const noteFormSchema = z.object({
  content: z.string().trim().min(1, "Escreva uma anotação."),
});
export type NoteFormValues = z.infer<typeof noteFormSchema>;

// ---------------------------------------------------------------------------
// Cotações
// ---------------------------------------------------------------------------
const optionalMoneyField = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || parseBRLNumber(v) !== null, "Valor inválido.");

export const quoteFormSchema = z.object({
  contact_id: z.string().optional(),
  quote_date: z.string().trim().optional(),
  origin: z.string().trim().optional(),
  destination: z.string().trim().optional(),
  cargo_type: z.string().trim().optional(),
  vehicle_type: z.string().trim().optional(),
  value: optionalMoneyField,
  estimated_cost: optionalMoneyField,
  validity_date: z.string().trim().optional(),
  observations: z.string().trim().optional(),
});
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export const quoteItemFormSchema = z.object({
  description: z.string().trim().min(1, "Descreva o item."),
  quantity: z.string().trim().refine((v) => parseBRLNumber(v) !== null && parseBRLNumber(v)! > 0, "Quantidade inválida."),
  unit_value: z.string().trim().refine((v) => parseBRLNumber(v) !== null && parseBRLNumber(v)! >= 0, "Valor inválido."),
});
export type QuoteItemFormValues = z.infer<typeof quoteItemFormSchema>;

// ---------------------------------------------------------------------------
// Cadências
// ---------------------------------------------------------------------------
export const cadenceStepFormSchema = z.object({
  id: z.string().optional(),
  step_order: z.number().int().min(1),
  type: z.enum(["ligacao", "email", "whatsapp", "reuniao", "followup"]),
  day_offset: z.number().int().min(0, "Não pode ser negativo."),
  title: z.string().trim().min(2, "Informe um título para o passo."),
  description: z.string().trim().optional(),
});
export type CadenceStepFormValues = z.infer<typeof cadenceStepFormSchema>;

export const cadenceTemplateFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da cadência."),
  description: z.string().trim().optional(),
  steps: z.array(cadenceStepFormSchema).min(1, "Adicione ao menos um passo."),
});
export type CadenceTemplateFormValues = z.infer<typeof cadenceTemplateFormSchema>;

// ---------------------------------------------------------------------------
// Nutrição
// ---------------------------------------------------------------------------
export const nutritionUpdateFormSchema = z.object({
  reason: z.string().trim().optional(),
  resume_at: z.string().trim().optional(),
});
export type NutritionUpdateFormValues = z.infer<typeof nutritionUpdateFormSchema>;

// ---------------------------------------------------------------------------
// Usuários (gestão de equipe — Etapa 3)
// ---------------------------------------------------------------------------
export const userFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuário."),
  email: z
    .string()
    .trim()
    .min(3, "Informe o e-mail do usuário.")
    .refine((v) => /.+@.+\..+/.test(v), "E-mail inválido."),
  role: z.enum(["admin", "vendedor"]),
  active: z.boolean(),
});
export type UserFormValues = z.infer<typeof userFormSchema>;
