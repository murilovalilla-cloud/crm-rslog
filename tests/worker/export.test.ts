import { describe, expect, it } from "vitest";
import { toCSV, type ExportColumn } from "../../worker/export";

describe("toCSV", () => {
  const columns: ExportColumn[] = [
    { key: "name", label: "Empresa" },
    { key: "city", label: "Cidade" },
  ];

  it("gera cabeçalho com os rótulos das colunas e uma linha por registro", () => {
    const csv = toCSV([{ name: "Transportadora A", city: "Porto Alegre" }], columns);
    expect(csv).toBe("Empresa,Cidade\r\nTransportadora A,Porto Alegre");
  });

  it("coloca campos com vírgula entre aspas", () => {
    const csv = toCSV([{ name: "Empresa, Comércio e Logística", city: "Caxias" }], columns);
    expect(csv).toContain('"Empresa, Comércio e Logística"');
  });

  it("escapa aspas duplas duplicando-as", () => {
    const csv = toCSV([{ name: 'Depósito "Central"', city: "Gramado" }], columns);
    expect(csv).toContain('"Depósito ""Central"""');
  });

  it("converte valores nulos/ausentes em célula vazia", () => {
    const csv = toCSV([{ name: "Empresa X", city: null }], columns);
    expect(csv).toBe("Empresa,Cidade\r\nEmpresa X,");
  });

  it("mantém apenas o cabeçalho quando não há linhas", () => {
    expect(toCSV([], columns)).toBe("Empresa,Cidade");
  });
});
