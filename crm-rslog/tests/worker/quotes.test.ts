import { describe, expect, it } from "vitest";
import { recalcMargin } from "../../worker/routes/quotes";

describe("recalcMargin", () => {
  it("calcula a margem como valor menos custo", () => {
    expect(recalcMargin(18500, 14000)).toBe(4500);
  });

  it("retorna null quando o valor não foi informado", () => {
    expect(recalcMargin(null, 14000)).toBeNull();
    expect(recalcMargin(undefined, 14000)).toBeNull();
  });

  it("retorna null quando o custo não foi informado", () => {
    expect(recalcMargin(18500, null)).toBeNull();
    expect(recalcMargin(18500, undefined)).toBeNull();
  });

  it("arredonda para duas casas decimais, evitando erro de ponto flutuante", () => {
    expect(recalcMargin(10.1, 3.3)).toBe(6.8);
  });

  it("aceita margem negativa (cotação abaixo do custo)", () => {
    expect(recalcMargin(1000, 1500)).toBe(-500);
  });
});
