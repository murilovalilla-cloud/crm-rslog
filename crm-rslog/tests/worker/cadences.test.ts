import { describe, expect, it } from "vitest";
import { hasDuplicateStepOrders } from "../../worker/routes/cadences";

describe("hasDuplicateStepOrders", () => {
  it("retorna falso quando todas as ordens são únicas", () => {
    expect(hasDuplicateStepOrders([1, 2, 3])).toBe(false);
  });

  it("retorna verdadeiro quando há ordens repetidas", () => {
    expect(hasDuplicateStepOrders([1, 2, 2])).toBe(true);
  });

  it("retorna falso para uma lista vazia ou com um único passo", () => {
    expect(hasDuplicateStepOrders([])).toBe(false);
    expect(hasDuplicateStepOrders([1])).toBe(false);
  });
});
