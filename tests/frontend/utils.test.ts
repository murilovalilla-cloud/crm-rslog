import { describe, expect, it } from "vitest";
import { formatCurrencyBRL, formatDate, initials, parseBRLNumber, toDatetimeLocalValue } from "../../src/lib/utils";

describe("formatCurrencyBRL", () => {
  it("formata valores em Real com duas casas decimais", () => {
    expect(formatCurrencyBRL(18500)).toContain("18.500,00");
  });

  it("retorna travessão para valores nulos ou indefinidos", () => {
    expect(formatCurrencyBRL(null)).toBe("—");
    expect(formatCurrencyBRL(undefined)).toBe("—");
  });

  it("formata zero corretamente (não deve ser tratado como ausente)", () => {
    expect(formatCurrencyBRL(0)).toContain("0,00");
  });
});

describe("formatDate", () => {
  it("formata uma data ISO no padrão brasileiro", () => {
    expect(formatDate("2026-08-26T12:00:00.000Z")).toBe("26/08/2026");
  });

  it("retorna travessão para valores ausentes ou inválidos", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("data-invalida")).toBe("—");
  });
});

describe("initials", () => {
  it("gera iniciais a partir do primeiro e último nome", () => {
    expect(initials("Ana Beatriz Souza")).toBe("AS");
  });

  it("lida com nome único", () => {
    expect(initials("Ana")).toBe("A");
  });

  it("retorna ? quando não há nome", () => {
    expect(initials(null)).toBe("?");
    expect(initials("")).toBe("?");
  });
});

describe("parseBRLNumber", () => {
  it("interpreta corretamente o separador de milhar e a vírgula decimal", () => {
    expect(parseBRLNumber("18.500,50")).toBe(18500.5);
  });

  it("aceita números com ponto decimal simples (ex.: digitados via teclado numérico)", () => {
    expect(parseBRLNumber("18500.5")).toBe(18500.5);
  });

  it("aceita apenas vírgula decimal, sem milhar", () => {
    expect(parseBRLNumber("1500,75")).toBe(1500.75);
  });

  it("retorna null para strings vazias ou não numéricas", () => {
    expect(parseBRLNumber("")).toBeNull();
    expect(parseBRLNumber("abc")).toBeNull();
  });
});

describe("toDatetimeLocalValue", () => {
  it("retorna string vazia para valores ausentes", () => {
    expect(toDatetimeLocalValue(null)).toBe("");
    expect(toDatetimeLocalValue(undefined)).toBe("");
  });

  it("converte um ISO válido para o formato aceito por <input type=datetime-local>", () => {
    const value = toDatetimeLocalValue("2026-08-26T12:30:00.000Z");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
