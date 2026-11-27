import { describe, expect, test } from "vitest";
import { alternarMes, alternarTodos, rotuloDoCombo, todosMarcados, tituloDoPeriodo } from "../mesesFinanceiro";

describe("filtro de meses do Financeiro (#137)", () => {
  test("marcar e desmarcar um mês mantém a lista ordenada e sem repetidos", () => {
    expect(alternarMes([11], 10)).toEqual([10, 11]);
    expect(alternarMes([10, 11], 11)).toEqual([10]);
    expect(alternarMes([], 3)).toEqual([3]);
    expect(alternarMes([1, 2], 13)).toEqual([1, 2]); // mês inválido é ignorado
  });

  test("Marcar todos marca os 12; Desmarcar todos limpa", () => {
    const todos = alternarTodos([11]);
    expect(todos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(todosMarcados(todos)).toBe(true);
    expect(alternarTodos(todos)).toEqual([]);
  });

  test("11 meses marcados ainda NÃO é 'todos' (o item continua 'Marcar todos')", () => {
    expect(todosMarcados([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(false);
  });

  test("texto do combo", () => {
    expect(rotuloDoCombo([])).toBe("Nenhum mês");
    expect(rotuloDoCombo([11])).toBe("Novembro");
    expect(rotuloDoCombo([10, 11])).toBe("Out, Nov");
    expect(rotuloDoCombo([1, 2, 3])).toBe("Jan, Fev, Mar");
    expect(rotuloDoCombo([1, 2, 3, 4])).toBe("4 meses");
    expect(rotuloDoCombo([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe("Todos os meses");
  });

  test("título do período: um mês igual ao de antes; vários meses descritos", () => {
    expect(tituloDoPeriodo([11], 2026)).toBe("novembro 2026");
    expect(tituloDoPeriodo([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2026)).toBe("janeiro a dezembro 2026");
    expect(tituloDoPeriodo([10, 11], 2026)).toBe("outubro a novembro 2026");
    expect(tituloDoPeriodo([1, 3, 6], 2026)).toBe("janeiro, março, junho 2026");
    expect(tituloDoPeriodo([], 2026)).toBe("nenhum mês de 2026");
  });
});
