import { describe, expect, it } from "vitest";
import { bool, num, str, summarize, type ImportRow, type RowResult } from "../../worker/import";

describe("str", () => {
  it("remove espaços nas pontas e converte string vazia em null", () => {
    expect(str({ name: "  Empresa Exemplo  " }, "name")).toBe("Empresa Exemplo");
    expect(str({ name: "   " }, "name")).toBeNull();
  });

  it("retorna null quando a coluna não existe na linha", () => {
    expect(str({} as ImportRow, "name")).toBeNull();
  });

  it("converte valores numéricos da planilha para string", () => {
    expect(str({ cnpj: 12345 }, "cnpj")).toBe("12345");
  });
});

describe("num", () => {
  it("aceita número já numérico", () => {
    expect(num({ value: 18500.5 }, "value")).toBe(18500.5);
  });

  it("interpreta o padrão brasileiro (ponto de milhar, vírgula decimal)", () => {
    expect(num({ value: "18.500,50" }, "value")).toBe(18500.5);
  });

  it("aceita número simples em texto", () => {
    expect(num({ value: "9800" }, "value")).toBe(9800);
  });

  it("retorna null para célula vazia ou ausente", () => {
    expect(num({ value: "" }, "value")).toBeNull();
    expect(num({} as ImportRow, "value")).toBeNull();
  });

  it("retorna null para texto que não é um número válido", () => {
    expect(num({ value: "não é número" }, "value")).toBeNull();
  });
});

describe("bool", () => {
  it("reconhece variações comuns de 'sim'", () => {
    for (const v of ["sim", "SIM", "Yes", "true", "1", "x"]) {
      expect(bool({ flag: v }, "flag")).toBe(true);
    }
  });

  it("trata qualquer outro valor como falso", () => {
    expect(bool({ flag: "não" }, "flag")).toBe(false);
    expect(bool({ flag: "" }, "flag")).toBe(false);
    expect(bool({} as ImportRow, "flag")).toBe(false);
  });

  it("aceita booleano nativo diretamente", () => {
    expect(bool({ flag: true }, "flag")).toBe(true);
    expect(bool({ flag: false }, "flag")).toBe(false);
  });
});

describe("summarize", () => {
  it("conta corretamente criações, atualizações e erros", () => {
    const results: RowResult[] = [
      { index: 0, action: "create", errors: [], label: "A" },
      { index: 1, action: "create", errors: [], label: "B" },
      { index: 2, action: "update", errors: [], label: "C" },
      { index: 3, action: "error", errors: ["Nome obrigatório"], label: "(sem nome)" },
    ];
    expect(summarize(results)).toEqual({ total: 4, to_create: 2, to_update: 1, errors: 1 });
  });

  it("retorna zeros para uma lista vazia", () => {
    expect(summarize([])).toEqual({ total: 0, to_create: 0, to_update: 0, errors: 0 });
  });
});
