import { describe, expect, it } from "vitest";
import {
  activityFormSchema,
  cadenceTemplateFormSchema,
  companyFormSchema,
  contactFormSchema,
  nutritionUpdateFormSchema,
  opportunityFormSchema,
  quoteFormSchema,
  quoteItemFormSchema,
} from "../../src/lib/formSchemas";

describe("companyFormSchema (frontend)", () => {
  it("rejeita nome vazio", () => {
    expect(companyFormSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("aceita nome válido mesmo sem os demais campos", () => {
    expect(companyFormSchema.safeParse({ name: "Transportadora Exemplo" }).success).toBe(true);
  });
});

describe("contactFormSchema (frontend)", () => {
  it("exige empresa e nome", () => {
    expect(contactFormSchema.safeParse({ name: "Fulano" }).success).toBe(false);
  });

  it("rejeita e-mail malformado", () => {
    const result = contactFormSchema.safeParse({ company_id: "cmp-001", name: "Fulano", email: "invalido" });
    expect(result.success).toBe(false);
  });
});

describe("opportunityFormSchema (frontend)", () => {
  it("rejeita valor não numérico", () => {
    const result = opportunityFormSchema.safeParse({
      company_id: "cmp-001",
      title: "Frete de exemplo",
      value: "não é número",
    });
    expect(result.success).toBe(false);
  });

  it("aceita valor com vírgula decimal (padrão brasileiro)", () => {
    const result = opportunityFormSchema.safeParse({
      company_id: "cmp-001",
      title: "Frete de exemplo",
      value: "18.500,50",
    });
    expect(result.success).toBe(true);
  });
});

describe("activityFormSchema (frontend)", () => {
  it("exige data/hora prevista", () => {
    const result = activityFormSchema.safeParse({ type: "ligacao", title: "Ligar", due_at: "" });
    expect(result.success).toBe(false);
  });

  it("aceita atividade válida", () => {
    const result = activityFormSchema.safeParse({
      type: "ligacao",
      title: "Ligar para o cliente",
      due_at: "2026-09-01T10:00",
    });
    expect(result.success).toBe(true);
  });
});

describe("quoteFormSchema (frontend)", () => {
  it("aceita cotação sem nenhum campo obrigatório preenchido (todos opcionais na criação rápida)", () => {
    expect(quoteFormSchema.safeParse({}).success).toBe(true);
  });

  it("rejeita valor em formato inválido", () => {
    const result = quoteFormSchema.safeParse({ value: "abc" });
    expect(result.success).toBe(false);
  });

  it("aceita valor e custo estimado no padrão brasileiro", () => {
    const result = quoteFormSchema.safeParse({ value: "18.500,50", estimated_cost: "14.000,00" });
    expect(result.success).toBe(true);
  });
});

describe("quoteItemFormSchema (frontend)", () => {
  it("exige descrição, quantidade e valor unitário", () => {
    expect(quoteItemFormSchema.safeParse({ description: "", quantity: "1", unit_value: "10" }).success).toBe(false);
  });

  it("rejeita quantidade zero ou negativa", () => {
    const result = quoteItemFormSchema.safeParse({ description: "Frete", quantity: "0", unit_value: "10" });
    expect(result.success).toBe(false);
  });

  it("aceita item válido com valores no padrão brasileiro", () => {
    const result = quoteItemFormSchema.safeParse({ description: "Frete rodoviário", quantity: "2", unit_value: "1.500,00" });
    expect(result.success).toBe(true);
  });
});

describe("cadenceTemplateFormSchema (frontend)", () => {
  it("exige nome e ao menos um passo", () => {
    expect(cadenceTemplateFormSchema.safeParse({ name: "Cadência padrão", steps: [] }).success).toBe(false);
  });

  it("rejeita passo sem título", () => {
    const result = cadenceTemplateFormSchema.safeParse({
      name: "Cadência padrão",
      steps: [{ step_order: 1, type: "ligacao", day_offset: 0, title: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("aceita um modelo válido com múltiplos passos", () => {
    const result = cadenceTemplateFormSchema.safeParse({
      name: "Cadência padrão",
      steps: [
        { step_order: 1, type: "ligacao", day_offset: 0, title: "Primeira ligação" },
        { step_order: 2, type: "email", day_offset: 2, title: "E-mail de follow-up" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("nutritionUpdateFormSchema (frontend)", () => {
  it("aceita atualização apenas com motivo", () => {
    expect(nutritionUpdateFormSchema.safeParse({ reason: "Sem orçamento no momento" }).success).toBe(true);
  });

  it("aceita objeto vazio (todos os campos são opcionais)", () => {
    expect(nutritionUpdateFormSchema.safeParse({}).success).toBe(true);
  });
});
