import { describe, expect, test } from "vitest";
import { formatarPeriodo } from "../periodo";

describe("formatarPeriodo (#112)", () => {
  test("com mês e ano mostra 'Março/2026'", () => {
    expect(formatarPeriodo("Março", 2026)).toBe("Março/2026");
    expect(formatarPeriodo("Março", "2026")).toBe("Março/2026");
  });

  test("sem competência mostra '-' e nunca NaN", () => {
    expect(formatarPeriodo("", NaN)).toBe("-");
    expect(formatarPeriodo("", 2026)).toBe("-"); // mês inválido
    expect(formatarPeriodo("Março", NaN)).toBe("-");
    expect(formatarPeriodo("Março", undefined)).toBe("-");
    expect(formatarPeriodo(undefined, null)).toBe("-");
    expect(formatarPeriodo("Março", "abc")).toBe("-");
  });

  test("resultado nunca contém 'NaN' nem 'undefined'", () => {
    for (const m of ["", "Março", null, undefined]) {
      for (const a of [NaN, 0, null, undefined, "", "x", 2026]) {
        const r = formatarPeriodo(m as any, a as any);
        expect(r).not.toMatch(/NaN|undefined|null/);
      }
    }
  });
});
