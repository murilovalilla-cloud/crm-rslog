import { describe, expect, it } from "vitest";
import {
  activityCreateSchema,
  companyCreateSchema,
  contactCreateSchema,
  opportunityStageChangeSchema,
  pipelineStageReorderSchema,
  userCreateSchema,
  userUpdateSchema,
} from "../../worker/validation/schemas";

describe("companyCreateSchema", () => {
  it("rejeita empresa sem nome", () => {
    const result = companyCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejeita nome com menos de 2 caracteres", () => {
    const result = companyCreateSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("aceita uma empresa válida apenas com o nome", () => {
    const result = companyCreateSchema.safeParse({ name: "Transportadora Exemplo" });
    expect(result.success).toBe(true);
  });
});

describe("contactCreateSchema", () => {
  it("exige company_id e nome", () => {
    const result = contactCreateSchema.safeParse({ name: "Fulano" });
    expect(result.success).toBe(false);
  });

  it("rejeita e-mail em formato inválido", () => {
    const result = contactCreateSchema.safeParse({
      company_id: "cmp-001",
      name: "Fulano de Tal",
      email: "não-é-um-email",
    });
    expect(result.success).toBe(false);
  });

  it("aceita contato válido sem e-mail", () => {
    const result = contactCreateSchema.safeParse({ company_id: "cmp-001", name: "Fulano de Tal" });
    expect(result.success).toBe(true);
  });
});

describe("activityCreateSchema", () => {
  it("rejeita tipo de atividade fora do enum permitido", () => {
    const result = activityCreateSchema.safeParse({
      opportunity_id: "opp-001",
      type: "carta-registrada",
      title: "Atividade",
      due_at: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita data prevista inválida", () => {
    const result = activityCreateSchema.safeParse({
      opportunity_id: "opp-001",
      type: "ligacao",
      title: "Ligar para o cliente",
      due_at: "não-é-uma-data",
    });
    expect(result.success).toBe(false);
  });

  it("aceita atividade válida", () => {
    const result = activityCreateSchema.safeParse({
      opportunity_id: "opp-001",
      type: "ligacao",
      title: "Ligar para o cliente",
      due_at: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("opportunityStageChangeSchema", () => {
  it("exige stage_id de destino", () => {
    const result = opportunityStageChangeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("aceita troca de etapa simples", () => {
    const result = opportunityStageChangeSchema.safeParse({ stage_id: "stage-02" });
    expect(result.success).toBe(true);
  });
});

describe("pipelineStageReorderSchema", () => {
  it("rejeita lista vazia de etapas", () => {
    const result = pipelineStageReorderSchema.safeParse({ stages: [] });
    expect(result.success).toBe(false);
  });

  it("aceita uma lista de reordenação válida", () => {
    const result = pipelineStageReorderSchema.safeParse({
      stages: [
        { id: "stage-01", position: 2 },
        { id: "stage-02", position: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("userCreateSchema", () => {
  it("rejeita usuário sem nome nem e-mail", () => {
    const result = userCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejeita e-mail em formato inválido", () => {
    const result = userCreateSchema.safeParse({ name: "Fulano de Tal", email: "não-é-um-email" });
    expect(result.success).toBe(false);
  });

  it("rejeita papel fora do enum permitido", () => {
    const result = userCreateSchema.safeParse({
      name: "Fulano de Tal",
      email: "fulano@rslog.com.br",
      role: "gerente",
    });
    expect(result.success).toBe(false);
  });

  it("aplica papel 'vendedor' e active=true como padrão", () => {
    const result = userCreateSchema.safeParse({ name: "Fulano de Tal", email: "fulano@rslog.com.br" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("vendedor");
      expect(result.data.active).toBe(true);
    }
  });

  it("aceita um usuário admin explícito", () => {
    const result = userCreateSchema.safeParse({
      name: "Fulano de Tal",
      email: "fulano@rslog.com.br",
      role: "admin",
      active: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("userUpdateSchema", () => {
  it("aceita objeto vazio (nenhum campo alterado)", () => {
    const result = userUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail em formato inválido", () => {
    const result = userUpdateSchema.safeParse({ email: "não-é-um-email" });
    expect(result.success).toBe(false);
  });

  it("aceita atualização parcial apenas do papel", () => {
    const result = userUpdateSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("aceita desativar um usuário", () => {
    const result = userUpdateSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
  });
});
