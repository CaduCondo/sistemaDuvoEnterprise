// Teste da regra do #130: valor pago = soma dos pagamentos registrados.
// Rodar: npm test
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  calcularValorPagoAposNovoPagamento as calc,
  somarHistoricoPagamentos as soma,
} from "../paymentHistory";

test("soma o histórico em valor absoluto e arredonda centavos", () => {
  assert.equal(soma([{ amount: 500 }, { amount: "300" }, { amount: -0.1 }, { amount: 0.2 }]), 800.3);
  assert.equal(soma(null), 0);
  assert.equal(soma([]), 0);
});

test("BDD: dois pagamentos parciais de 500 e 300 => valor pago 800", () => {
  const apos1 = calc({ historicoAnterior: [], valorPagoAnterior: 0, statusAnterior: "pending", novoPagamento: 500 });
  assert.equal(apos1, 500);
  const apos2 = calc({ historicoAnterior: [{ amount: 500 }], valorPagoAnterior: apos1, statusAnterior: "partial", novoPagamento: 300 });
  assert.equal(apos2, 800);
});

test("#130 (o caso real): 2o pagamento sobre recebimento 'pago' NÃO sobrescreve", () => {
  // 1o pagamento 2.820 deixou o recebimento 'paid' (esperado era 300); depois entrou 954,45.
  const v = calc({ historicoAnterior: [{ amount: 2820 }], valorPagoAnterior: 2820, statusAnterior: "paid", novoPagamento: 954.45 });
  assert.equal(v, 3774.45);
});

test("2o pagamento sobre recebimento 'pendente' com histórico também soma", () => {
  const v = calc({ historicoAnterior: [{ amount: 100 }], valorPagoAnterior: 0, statusAnterior: "pending", novoPagamento: 50 });
  assert.equal(v, 150);
});

test("recebimento antigo sem histórico: soma só se estava parcial", () => {
  assert.equal(calc({ historicoAnterior: [], valorPagoAnterior: 400, statusAnterior: "partial", novoPagamento: 100 }), 500);
  assert.equal(calc({ historicoAnterior: undefined, valorPagoAnterior: 400, statusAnterior: "pending", novoPagamento: 100 }), 100);
});

test("sempre bate com a soma do histórico depois de salvar (invariante)", () => {
  let hist: { amount: number }[] = [];
  let pago = 0;
  let status = "pending";
  for (const v of [10.1, 20.2, 0.3, 999.99, 5]) {
    pago = calc({ historicoAnterior: hist, valorPagoAnterior: pago, statusAnterior: status, novoPagamento: v });
    hist = [...hist, { amount: v }];
    status = status === "pending" ? "partial" : "paid"; // status qualquer: não pode influenciar
    assert.equal(pago, soma(hist));
  }
});
