import { describe, it, expect } from "vitest";
import { prizeFor, MIN_WITHDRAW } from "./arena";

describe("regras Arena X1", () => {
  it("vencedor recebe 90% do pote (taxa de 10%)", () => {
    expect(prizeFor(10)).toBe(18);
    expect(prizeFor(25.5)).toBe(45.9);
  });
  it("saque mínimo é R$ 10,00", () => {
    expect(MIN_WITHDRAW).toBe(10);
  });
});
