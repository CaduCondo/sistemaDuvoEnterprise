import { describe, expect, test } from "vitest";
import { calcularCardsDoFinanceiro, expandirParciais, valorEsperadoDaLinha } from "../calculos";

const linha = (o: Partial<any>) => ({
  id: o.id ?? Math.random().toString(36),
  status: "paid",
  paymentKind: "rent",
  paidAmount: 0,
  expectedAmount: 0,
  property: { locationId: "L1" },
  ...o,
});

const parametros = (linhas: any[], extra: Partial<any> = {}) => ({
  linhas,
  despesas: [],
  percentualTaxaAdm: 5,
  percentualTaxaGer: 3,
  locaisIsentosAdm: [],
  locaisIsentosGer: [],
  ...extra,
});

describe("Cards do Financeiro (mesma conta da tela, #128)", () => {
  test("Receita Bruta conta só o pago; taxas 5% e 3% sobre o recebido", () => {
    const r = calcularCardsDoFinanceiro(parametros([
      linha({ paidAmount: 1000, expectedAmount: 1000 }),
      linha({ status: "pending", paidAmount: 0, expectedAmount: 2000 }),
    ]));
    expect(r.totalReceived).toBe(1000);
    expect(r.totalExpected).toBe(3000);
    expect(r.adminFee).toBeCloseTo(50);
    expect(r.managementFee).toBeCloseTo(30);
  });

  test("Recebimento de Rescisão (caução) fica fora de tudo", () => {
    const r = calcularCardsDoFinanceiro(parametros([
      linha({ paidAmount: 1000, expectedAmount: 1000 }),
      linha({ paymentKind: "termination", paidAmount: -3000, expectedAmount: -3000 }),
    ]));
    expect(r.totalReceived).toBe(1000);
    expect(r.totalExpected).toBe(1000);
  });

  test("Isenções de cada taxa são independentes", () => {
    const r = calcularCardsDoFinanceiro(parametros(
      [linha({ paidAmount: 1000, expectedAmount: 1000 })],
      { locaisIsentosGer: ["L1"] },
    ));
    expect(r.adminFee).toBeCloseTo(50);
    expect(r.managementFee).toBe(0);
  });

  test("Valor negativo não gera taxa, mas entra no recebido", () => {
    const r = calcularCardsDoFinanceiro(parametros([
      linha({ paidAmount: 1000, expectedAmount: 1000 }),
      linha({ paidAmount: -200, expectedAmount: -200 }),
    ]));
    expect(r.totalReceived).toBe(800);
    expect(r.adminFee).toBeCloseTo(50);
  });

  test("Renegociado entra no recebido só com o que foi pago", () => {
    const r = calcularCardsDoFinanceiro(parametros([
      linha({ status: "renegotiated", paidAmount: 300, expectedAmount: 300 }),
    ]));
    expect(r.totalReceived).toBe(300);
  });

  test("Receita Líquida = recebido − taxas − contas do mês", () => {
    const r = calcularCardsDoFinanceiro(parametros(
      [linha({ paidAmount: 1000, expectedAmount: 1000 })],
      { despesas: [{ amount: 100 }, { amount: 50 }] },
    ));
    expect(r.locationExpenses).toBe(150);
    expect(r.netRevenue).toBeCloseTo(1000 - 50 - 30 - 150);
  });

  test("Sem configuração, usa 5% e 3%", () => {
    const r = calcularCardsDoFinanceiro(parametros(
      [linha({ paidAmount: 100, expectedAmount: 100 })],
      { percentualTaxaAdm: null, percentualTaxaGer: undefined },
    ));
    expect(r.adminFee).toBeCloseTo(5);
    expect(r.managementFee).toBeCloseTo(3);
  });
});

describe("Valor esperado da linha", () => {
  test("Soma o breakdown + multa + juros", () => {
    expect(valorEsperadoDaLinha(linha({
      expectedAmount: 999,
      breakdown: [{ value: 1500 }, { amount: 200 }],
      lateFee: 30,
      interest: 5,
    }))).toBe(1735);
  });

  test("Sem breakdown usa o valor esperado", () => {
    expect(valorEsperadoDaLinha(linha({ expectedAmount: 1500, lateFee: 10 }))).toBe(1510);
  });
});

describe("Pagamento parcial vira 1 linha por pagamento", () => {
  test("Dois pagamentos + saldo em aberto; esperado do boleto soma 1 vez", () => {
    const base = linha({ id: "B1", status: "partial", paidAmount: 700, expectedAmount: 1000 });
    const linhas = expandirParciais(
      { status: "partial", expected_amount: 1000, partial_payments: [{ amount: 400 }, { amount: 300 }] },
      base,
    );
    expect(linhas.map((l) => l.paidAmount)).toEqual([400, 300, 0]);
    expect(linhas[2].expectedAmount).toBe(300);
    const r = calcularCardsDoFinanceiro(parametros(linhas));
    expect(r.totalExpected).toBe(1000);
    expect(r.totalReceived).toBe(700);
  });

  test("Renegociado: sem linha de saldo e esperado = o que foi pago", () => {
    const base = linha({ id: "B2", status: "renegotiated", paidAmount: 400, expectedAmount: 400 });
    const linhas = expandirParciais(
      { status: "renegotiated", expected_amount: 1000, partial_payments: [{ amount: 400 }] },
      base,
    );
    expect(linhas).toHaveLength(1);
    expect(calcularCardsDoFinanceiro(parametros(linhas)).totalExpected).toBe(400);
  });

  test("Sem histórico devolve a própria linha", () => {
    const base = linha({ id: "B3" });
    expect(expandirParciais({ status: "paid", expected_amount: 0, partial_payments: [] }, base)).toEqual([base]);
  });
});
