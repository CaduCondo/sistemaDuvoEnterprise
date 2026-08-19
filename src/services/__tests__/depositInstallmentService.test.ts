import { planDepositInstallmentsSync } from "../depositInstallmentService";

// ⚠️ Assim como paymentService.test.ts, este arquivo ainda não roda
// automaticamente - o projeto não tem jest/vitest configurado (não há
// script "test" nem config no package.json). Ele documenta o
// comportamento esperado e já fica pronto para rodar assim que um runner
// for configurado. Enquanto isso, dá pra conferir manualmente com
// `npx tsx` (ver notas do ticket "Bug: parcelamento do caução...").
describe("planDepositInstallmentsSync", () => {
  test("Cenário 1: aumentar de 1 para 3 parcelas cria as que faltam e atualiza a 1ª", () => {
    const existing = [
      { id: "i1", installment_number: 1, installment_total: 1, amount: 1111.11, due_date: "2026-07-22", pix_code: null, status: "pending" },
    ];
    const desired = {
      1: { amount: 500, due_date: "2026-08-01", pix_code: null },
      2: { amount: 500, due_date: "2026-09-01", pix_code: null },
      3: { amount: 500, due_date: "2026-10-01", pix_code: null },
    };

    const plan = planDepositInstallmentsSync(3, desired, existing);

    expect(plan.blocked).toBe(false);
    expect(plan.toCreate.map((i) => i.installment_number).sort()).toEqual([2, 3]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]).toMatchObject({ installment_number: 1, amount: 500, due_date: "2026-08-01" });
    expect(plan.toDelete).toEqual([]);
  });

  test("Cenário 2: diminuir de 3 para 1 parcela remove as que sobram", () => {
    const existing = [
      { id: "i1", installment_number: 1, installment_total: 3, amount: 400, due_date: "2026-07-01", pix_code: null, status: "pending" },
      { id: "i2", installment_number: 2, installment_total: 3, amount: 400, due_date: "2026-08-01", pix_code: null, status: "pending" },
      { id: "i3", installment_number: 3, installment_total: 3, amount: 400, due_date: "2026-09-01", pix_code: null, status: "pending" },
    ];
    const desired = { 1: { amount: 1200, due_date: "2026-07-01", pix_code: null } };

    const plan = planDepositInstallmentsSync(1, desired, existing);

    expect(plan.blocked).toBe(false);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete.map((i) => i.installment_number).sort()).toEqual([2, 3]);
  });

  test("Regra do Cadu: reduzir não pode ficar abaixo da quantidade de parcelas já pagas (não importa qual número)", () => {
    const existing = [
      { id: "i1", installment_number: 1, installment_total: 3, amount: 2000, due_date: "2026-07-01", pix_code: null, status: "paid" },
      { id: "i2", installment_number: 2, installment_total: 3, amount: 2000, due_date: "2026-08-01", pix_code: null, status: "paid" },
      { id: "i3", installment_number: 3, installment_total: 3, amount: 2000, due_date: "2026-09-01", pix_code: null, status: "pending" },
    ];

    // 2 parcelas pagas -> não pode reduzir para 1
    const blocked = planDepositInstallmentsSync(1, { 1: { amount: 6000, due_date: "2026-07-01", pix_code: null } }, existing);
    expect(blocked.blocked).toBe(true);
    expect(blocked.reason).toMatch(/2 parcela\(s\) já/);

    // mas reduzir para 2 (= quantidade paga) é permitido
    const allowed = planDepositInstallmentsSync(
      2,
      { 1: { amount: 2000, due_date: "2026-07-01", pix_code: null }, 2: { amount: 2000, due_date: "2026-08-01", pix_code: null } },
      existing
    );
    expect(allowed.blocked).toBe(false);
    expect(allowed.toDelete).toEqual([{ id: "i3", installment_number: 3 }]);
  });

  test("Parcela já paga nunca tem valor/vencimento sobrescrito, mesmo que o número pago não seja a 1ª", () => {
    const existing = [
      { id: "i1", installment_number: 1, installment_total: 3, amount: 2000, due_date: "2026-07-01", pix_code: null, status: "pending" },
      { id: "i2", installment_number: 2, installment_total: 3, amount: 2000, due_date: "2026-08-01", pix_code: null, status: "paid" },
      { id: "i3", installment_number: 3, installment_total: 3, amount: 2000, due_date: "2026-09-01", pix_code: null, status: "pending" },
    ];

    // Só 1 parcela paga -> reduzir para 1 é permitido (mesmo a paga não sendo a 1ª)
    const plan = planDepositInstallmentsSync(1, { 1: { amount: 6000, due_date: "2026-07-01", pix_code: null } }, existing);

    expect(plan.blocked).toBe(false);
    // a parcela 2 (paga) nunca é deletada, mesmo estando fora do novo total de 1
    expect(plan.toDelete).toEqual([{ id: "i3", installment_number: 3 }]);
    expect(plan.keptPaid).toEqual([{ id: "i2", installment_number: 2 }]);
  });

  test("Parcela já paga que continua dentro do novo total só tem installment_total atualizado", () => {
    const existing = [{ id: "i1", installment_number: 1, installment_total: 1, amount: 1000, due_date: "2026-07-01", pix_code: null, status: "paid" }];
    const desired = {
      1: { amount: 9999, due_date: "2099-01-01", pix_code: null }, // valores "novos" que NÃO devem ser aplicados
      2: { amount: 500, due_date: "2026-08-01", pix_code: null },
    };

    const plan = planDepositInstallmentsSync(2, desired, existing);

    expect(plan.blocked).toBe(false);
    expect(plan.toCreate.map((i) => i.installment_number)).toEqual([2]);
    const update1 = plan.toUpdate.find((u) => u.installment_number === 1);
    expect(update1?.amount).toBeUndefined();
    expect(update1?.due_date).toBeUndefined();
    expect(update1?.installment_total).toBe(2);
  });
});
