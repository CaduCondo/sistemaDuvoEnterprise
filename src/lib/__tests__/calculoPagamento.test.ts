import { describe, expect, test } from "vitest";
import { calcularValoresDoPagamento, EntradaCalculoPagamento } from "../calculoPagamento";

// Issue #141: multa e juros no pagamento atrasado. Todos os valores esperados foram
// calculados à mão (multa = base x % ; juros = base x % ao dia x dias de atraso).
function entrada(sobre: Partial<EntradaCalculoPagamento> = {}): EntradaCalculoPagamento {
  return {
    payment: {
      due_date: "2026-01-10",
      breakdown: [{ description: "Aluguel", amount: 1000, type: "addition" }],
      expected_amount: 1000,
      paid_amount: 0,
      status: "pending",
    },
    paymentDate: "2026-01-20", // 10 dias de atraso
    rentalValue: 1000,
    garageValue: 0,
    isTerminationPayment: false,
    originalBreakdown: [],
    removeLateFee: false,
    removeInterest: false,
    lateFeePercentage: 2,
    interestRatePercentage: 0.1,
    ...sobre,
  };
}

describe("multa e juros no pagamento atrasado (#141)", () => {
  test("10 dias de atraso, nada removido: aluguel 1000 + multa 20 + juros 10 = 1030 (o juros NÃO pode ficar de fora)", () => {
    const r = calcularValoresDoPagamento(entrada());
    expect(r.diasAtraso).toBe(10);
    expect(r.multa).toBe(20);
    expect(r.juros).toBe(10);
    expect(r.valorTotal).toBe(1030);
    expect(r.valorAPagar).toBe(1030);
  });

  test("removendo só a multa: 1000 + juros 10 = 1010", () => {
    expect(calcularValoresDoPagamento(entrada({ removeLateFee: true })).valorAPagar).toBe(1010);
  });

  test("removendo só o juros: 1000 + multa 20 = 1020", () => {
    expect(calcularValoresDoPagamento(entrada({ removeInterest: true })).valorAPagar).toBe(1020);
  });

  test("removendo os dois: só o aluguel, 1000", () => {
    expect(calcularValoresDoPagamento(entrada({ removeLateFee: true, removeInterest: true })).valorAPagar).toBe(1000);
  });

  test("pago no dia do vencimento ou antes: sem multa nem juros", () => {
    for (const dia of ["2026-01-10", "2026-01-05"]) {
      const r = calcularValoresDoPagamento(entrada({ paymentDate: dia }));
      expect(r.diasAtraso).toBe(0);
      expect(r.multa).toBe(0);
      expect(r.juros).toBe(0);
      expect(r.valorAPagar).toBe(1000);
    }
  });

  test("sem data de pagamento ainda: sem multa nem juros", () => {
    const r = calcularValoresDoPagamento(entrada({ paymentDate: "" }));
    expect(r.multa).toBe(0);
    expect(r.valorAPagar).toBe(1000);
  });

  test("com garagem a base é aluguel + garagem: (1000 + 300) x 2% = 26 e x 0,1% x 10 dias = 13 -> 1339", () => {
    const r = calcularValoresDoPagamento(
      entrada({
        payment: {
          due_date: "2026-01-10",
          breakdown: [
            { description: "Aluguel", amount: 1000, type: "addition" },
            { description: "Garagem", amount: 300, type: "addition" },
          ],
          expected_amount: 1300,
          paid_amount: 0,
          status: "pending",
        },
        rentalValue: 1000,
        garageValue: 300,
      })
    );
    expect(r.valorAluguel).toBe(1300);
    expect(r.multa).toBe(26);
    expect(r.juros).toBe(13);
    expect(r.valorAPagar).toBe(1339);
  });

  test("arredonda em centavos: base 333,33 -> multa 6,67 (6,6666) e juros de 3 dias 1,00 (0,99999)", () => {
    const r = calcularValoresDoPagamento(
      entrada({
        payment: { due_date: "2026-01-10", breakdown: [{ description: "Aluguel", amount: 333.33, type: "addition" }], expected_amount: 333.33, paid_amount: 0, status: "pending" },
        paymentDate: "2026-01-13",
        rentalValue: 333.33,
      })
    );
    expect(r.multa).toBe(6.67);
    expect(r.juros).toBe(1);
    expect(r.valorAPagar).toBe(341);
  });

  test("rescisão: a base é o detalhamento SEM multa/juros por atraso e despesas (|800 + 500 - 2000| = 700; multa 2% = 14)", () => {
    const r = calcularValoresDoPagamento(
      entrada({
        isTerminationPayment: true,
        originalBreakdown: [
          { description: "Aluguel Proporcional", amount: 800 },
          { description: "Multa Rescisória", amount: 500 },
          { description: "Devolução de Caução", amount: -2000 },
          { description: "Multa por Atraso", amount: 10 },
          { description: "Juros por Atraso", amount: 5 },
          { description: "Despesas Adicionais*", amount: 100 },
        ],
      })
    );
    expect(r.multa).toBe(14);
    expect(r.juros).toBe(7); // 700 x 0,1% x 10 dias
  });

  test("parcela de acordo: a base é o valor da parcela, não o aluguel da locação", () => {
    const r = calcularValoresDoPagamento(
      entrada({
        payment: { due_date: "2026-01-10", breakdown: [{ description: "Acordo #1 — parcela 1/3", amount: 500, type: "addition" }], payment_kind: "agreement", expected_amount: 500, paid_amount: 0, status: "pending" },
        rentalValue: 1000,
      })
    );
    expect(r.valorAluguel).toBe(500);
    expect(r.multa).toBe(10);
    expect(r.juros).toBe(5);
    expect(r.valorAPagar).toBe(515);
  });
});

describe("valor ainda devido (#141)", () => {
  test("recebimento já pago: nada a pagar", () => {
    const r = calcularValoresDoPagamento(entrada({ payment: { due_date: "2026-01-10", breakdown: [{ description: "Aluguel", amount: 1000, type: "addition" }], expected_amount: 1000, paid_amount: 1000, status: "paid" } }));
    expect(r.valorRestante).toBe(0);
    expect(r.valorJaPago).toBe(1000);
  });

  test("parcial: esperado 1000 e já pago 400 -> faltam 600", () => {
    const r = calcularValoresDoPagamento(entrada({ payment: { due_date: "2026-01-10", breakdown: [{ description: "Aluguel", amount: 1000, type: "addition" }], expected_amount: 1000, paid_amount: 400, status: "partial" } }));
    expect(r.valorRestante).toBe(600);
  });

  test("pagou a mais que o esperado: o que falta nunca fica negativo", () => {
    const r = calcularValoresDoPagamento(entrada({ payment: { due_date: "2026-01-10", breakdown: [{ description: "Aluguel", amount: 1000, type: "addition" }], expected_amount: 1000, paid_amount: 1200, status: "partial" } }));
    expect(r.valorRestante).toBe(0);
  });
});
