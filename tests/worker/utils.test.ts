import { describe, expect, it } from "vitest";
import { computeActivityAlert, diffFields, emptyToNull, parsePagination } from "../../worker/utils";

describe("computeActivityAlert", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("retorna null quando não há atividade", () => {
    expect(computeActivityAlert(null, now)).toEqual({ level: null, overdueDays: 0 });
  });

  it("marca como concluída quando o status é concluida, independente da data", () => {
    const result = computeActivityAlert({ status: "concluida", due_at: "2020-01-01T00:00:00.000Z" }, now);
    expect(result.level).toBe("concluida");
  });

  it("marca como nula (sem alerta) quando a atividade foi cancelada", () => {
    const result = computeActivityAlert({ status: "cancelada", due_at: "2020-01-01T00:00:00.000Z" }, now);
    expect(result.level).toBeNull();
  });

  it("marca como atrasada e calcula os dias corretamente quando due_at é passado", () => {
    const result = computeActivityAlert({ status: "pendente", due_at: "2026-08-23T09:00:00.000Z" }, now);
    expect(result.level).toBe("atrasada");
    expect(result.overdueDays).toBe(3);
  });

  it("marca como 'hoje' quando due_at é no mesmo dia (UTC), mesmo em outro horário", () => {
    const result = computeActivityAlert({ status: "pendente", due_at: "2026-08-26T23:30:00.000Z" }, now);
    expect(result.level).toBe("hoje");
    expect(result.overdueDays).toBe(0);
  });

  it("marca como futura quando due_at é depois de hoje", () => {
    const result = computeActivityAlert({ status: "pendente", due_at: "2026-09-01T09:00:00.000Z" }, now);
    expect(result.level).toBe("futura");
  });

  it("não considera atrasada uma atividade pendente marcada para mais tarde hoje", () => {
    const laterToday = new Date("2026-08-26T08:00:00.000Z");
    const result = computeActivityAlert({ status: "pendente", due_at: "2026-08-26T20:00:00.000Z" }, laterToday);
    expect(result.level).toBe("hoje");
  });
});

describe("diffFields", () => {
  it("detecta apenas os campos que realmente mudaram", () => {
    const before = { name: "Empresa A", city: "Porto Alegre", state: "RS" };
    const after = { name: "Empresa A", city: "Caxias do Sul" };
    const changes = diffFields(before, after);
    expect(changes).toEqual([{ field: "city", oldValue: "Porto Alegre", newValue: "Caxias do Sul" }]);
  });

  it("ignora campos undefined (não enviados na atualização)", () => {
    const before = { name: "Empresa A" };
    const after = { name: undefined };
    expect(diffFields(before, after)).toEqual([]);
  });

  it("registra mudança de valor para null", () => {
    const before = { notes: "Alguma nota" };
    const after: { notes: string | null } = { notes: null };
    expect(diffFields(before, after)).toEqual([{ field: "notes", oldValue: "Alguma nota", newValue: null }]);
  });
});

describe("emptyToNull", () => {
  it("converte string vazia (ou só espaços) para null", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("   ")).toBeNull();
  });

  it("mantém valores não vazios, removendo espaços nas pontas", () => {
    expect(emptyToNull("  Porto Alegre  ")).toBe("Porto Alegre");
  });

  it("mantém null/undefined como null", () => {
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
  });
});

describe("parsePagination", () => {
  it("usa valores padrão quando a URL não informa page/limit", () => {
    const result = parsePagination(new URL("https://crm.rslog.com.br/api/companies"));
    expect(result).toEqual({ page: 1, limit: 25, offset: 0 });
  });

  it("calcula o offset corretamente a partir da página", () => {
    const result = parsePagination(new URL("https://crm.rslog.com.br/api/companies?page=3&limit=10"));
    expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("nunca permite limite acima do máximo configurado", () => {
    const result = parsePagination(new URL("https://crm.rslog.com.br/api/companies?limit=9999"));
    expect(result.limit).toBe(100);
  });

  it("nunca permite página menor que 1", () => {
    const result = parsePagination(new URL("https://crm.rslog.com.br/api/companies?page=-5"));
    expect(result.page).toBe(1);
  });
});
