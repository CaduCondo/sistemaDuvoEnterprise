import { describe, expect, test } from "vitest";
import { ehRecebimentoDeRescisao, itensDoReciboDeRescisao } from "../reciboRescisao";

// Issue #86: o recibo do Recebimento de Rescisão precisa ter o layout próprio (cada parte do
// valor). A decisão "é rescisão?" vem do TIPO gravado (payment_kind), nunca do texto do
// detalhamento: o texto "Caução Corrigido p/ Devolução" do Fim de Contrato não bate com
// "Devolução de Caução" e o recibo caía no modelo de aluguel.
describe("ehRecebimentoDeRescisao (#86)", () => {
  test("payment_kind 'termination' é rescisão, mesmo com texto que o código antigo não reconhecia", () => {
    const breakdown = [{ description: "Caução Corrigido p/ Devolução", amount: 3000, type: "deduction" }];
    expect(ehRecebimentoDeRescisao("termination", breakdown)).toBe(true);
  });

  test("aluguel comum NÃO é rescisão", () => {
    expect(ehRecebimentoDeRescisao("rent", [{ description: "Aluguel", amount: 1500, type: "addition" }])).toBe(false);
    expect(ehRecebimentoDeRescisao(undefined, [{ description: "Aluguel", amount: 1500, type: "addition" }])).toBe(false);
    expect(ehRecebimentoDeRescisao(null, null)).toBe(false);
  });

  test("recebimento de acordo não é rescisão", () => {
    expect(ehRecebimentoDeRescisao("agreement", [{ description: "Parcela do acordo", amount: 500, type: "addition" }])).toBe(false);
  });

  test("recebimento de ALUGUEL da rescisão (tipo rent, com proporcional e multa) continua reconhecido pelo texto", () => {
    const breakdown = [
      { description: "Aluguel Proporcional", amount: 1000, type: "addition" },
      { description: "Multa Rescisória", amount: 3000, type: "addition" },
    ];
    expect(ehRecebimentoDeRescisao("rent", breakdown)).toBe(true);
  });

  test("registros ANTIGOS sem payment_kind, com os textos de rescisão, continuam reconhecidos", () => {
    expect(ehRecebimentoDeRescisao(undefined, [{ description: "Multa Rescisória", amount: 3000, type: "addition" }])).toBe(true);
    expect(ehRecebimentoDeRescisao(null, [{ description: "Aluguel Proporcional", amount: 1000, type: "addition" }])).toBe(true);
    expect(ehRecebimentoDeRescisao(undefined, { terminationFee: 100 })).toBe(true);
  });
});

describe("itensDoReciboDeRescisao (#86)", () => {
  test("array: mantém só itens com valor, em valor absoluto, preservando descrição e sentido", () => {
    const itens = itensDoReciboDeRescisao([
      { description: "Aluguel Proporcional", amount: 1000, type: "addition" },
      { description: "Caução Corrigido p/ Devolução", amount: -3000, type: "deduction" },
      { description: "Despesas Adicionais", amount: 0, type: "addition" },
      { description: "Desconto", amount: "250", type: "deduction" },
    ]);
    expect(itens).toEqual([
      { description: "Aluguel Proporcional", amount: 1000, type: "addition" },
      { description: "Caução Corrigido p/ Devolução", amount: 3000, type: "deduction" },
      { description: "Desconto", amount: 250, type: "deduction" },
    ]);
  });

  test("texto JSON (string) também é aceito", () => {
    const itens = itensDoReciboDeRescisao(JSON.stringify([{ description: "Multa Rescisória", amount: 3000, type: "addition" }]));
    expect(itens).toEqual([{ description: "Multa Rescisória", amount: 3000, type: "addition" }]);
  });

  test("formato antigo (objeto) vira os itens equivalentes", () => {
    const itens = itensDoReciboDeRescisao({ proportionalRent: 800, terminationFee: 500, depositRefund: -2000, additionalExpenses: 100 });
    expect(itens).toEqual([
      { description: "Aluguel Proporcional", amount: 800, type: "addition" },
      { description: "Multa Rescisória", amount: 500, type: "addition" },
      { description: "Devolução de Caução", amount: 2000, type: "deduction" },
      { description: "Despesas Adicionais", amount: 100, type: "addition" },
    ]);
  });

  test("valor inválido ou JSON quebrado não derruba: devolve lista vazia", () => {
    expect(itensDoReciboDeRescisao("{não é json")).toEqual([]);
    expect(itensDoReciboDeRescisao(null)).toEqual([]);
    expect(itensDoReciboDeRescisao([{ description: "X", amount: "abc", type: "addition" }])).toEqual([]);
  });
});
