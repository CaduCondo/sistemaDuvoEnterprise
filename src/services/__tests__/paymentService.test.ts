import { generateExpectedPayments } from "../paymentService";

// Regras vigentes (docs/REGRAS_DE_NEGOCIO.md, "Fim de Contrato", #108 de 03/out/2026).
// Todos os valores abaixo foram calculados à mão a partir da regra, não copiados
// do que o código devolve:
//  - 1ª parcela: proporcional (aluguel/30 x dias); se início = vencimento, vem cheia no mês seguinte;
//  - demais parcelas: SEMPRE cheias, enquanto o vencimento do mês cair até a data fim;
//  - se o último vencimento for ANTES da data fim, entra 1 proporcional de fim de
//    contrato (dias depois do último vencimento até a data fim), vencendo na data fim;
//  - sempre entra 1 recebimento de "Fim de Contrato" (payment_kind "termination",
//    valor 0, sem número de parcela) vencendo na data fim.
type Linha = ReturnType<typeof generateExpectedPayments>[number];
const aluguel = (r: Linha[]) => r.filter((p) => p.payment_kind === "rent");
const fimDeContrato = (r: Linha[]) => r.filter((p) => p.payment_kind === "termination");

describe("generateExpectedPayments", () => {
  describe("Cenários de Vencimento Antecipado", () => {
    test("Cenário 1: início < vencimento (mesmo mês, proporcional); data fim no dia do vencimento", () => {
      const result = generateExpectedPayments({
        rentalId: "test-rental-1",
        startDate: "2026-07-01",
        endDate: "2026-09-05",
        monthlyRent: 1500,
        paymentDay: 5,
        hasGarage: false,
      });

      // 3 parcelas de aluguel + 1 Fim de Contrato (sem proporcional: fim = vencimento)
      expect(result).toHaveLength(4);
      expect(aluguel(result)).toHaveLength(3);
      expect(fimDeContrato(result)).toHaveLength(1);

      // 1ª: 01/07 até 05/07 (4 dias) -> 1500/30 x 4 = 200
      expect(result[0]).toMatchObject({
        reference_month: "07", reference_year: "2026", due_date: "2026-07-05",
        installment: 1, total_installments: 3,
      });
      expect(result[0].expected_amount).toBeCloseTo(200, 2);

      expect(result[1]).toMatchObject({
        reference_month: "08", due_date: "2026-08-05", expected_amount: 1500,
        installment: 2, total_installments: 3,
      });

      // 3ª: agora CHEIA (antes da #108 era proporcional de 250)
      expect(result[2]).toMatchObject({
        reference_month: "09", due_date: "2026-09-05", expected_amount: 1500,
        installment: 3, total_installments: 3, contract_end: false,
      });
    });

    test("Cenário 2: início > vencimento (1ª parcela no mês seguinte, proporcional)", () => {
      const result = generateExpectedPayments({
        rentalId: "test-rental-2",
        startDate: "2026-07-10",
        endDate: "2026-09-05",
        monthlyRent: 1500,
        paymentDay: 5,
        hasGarage: false,
      });

      expect(aluguel(result)).toHaveLength(2);
      expect(fimDeContrato(result)).toHaveLength(1);

      // 10/07 a 31/07 = 22 dias + 01/08 a 04/08 = 4 dias = 26 dias -> 1500/30 x 26 = 1300
      expect(result[0]).toMatchObject({
        reference_month: "08", reference_year: "2026", due_date: "2026-08-05",
        installment: 1, total_installments: 2,
      });
      expect(result[0].expected_amount).toBeCloseTo(1300, 2);

      expect(result[1]).toMatchObject({
        reference_month: "09", due_date: "2026-09-05", expected_amount: 1500,
        installment: 2, total_installments: 2,
      });
    });

    test("Cenário 3: início = vencimento (1ª parcela cheia no mês seguinte)", () => {
      const result = generateExpectedPayments({
        rentalId: "test-rental-3",
        startDate: "2026-07-05",
        endDate: "2026-09-05",
        monthlyRent: 1500,
        paymentDay: 5,
        hasGarage: false,
      });

      expect(aluguel(result)).toHaveLength(2);
      expect(result[0]).toMatchObject({
        reference_month: "08", due_date: "2026-08-05", expected_amount: 1500,
        installment: 1, total_installments: 2,
      });
      expect(result[1]).toMatchObject({
        reference_month: "09", due_date: "2026-09-05", expected_amount: 1500,
        installment: 2, total_installments: 2,
      });
    });
  });

  describe("Fim de Contrato (regra #108)", () => {
    test("Exemplo do manual: vencimento dia 5, fim 29/09 => proporcional de 24 dias + Fim de Contrato", () => {
      const result = generateExpectedPayments({
        rentalId: "test-fim-1",
        startDate: "2026-06-05",
        endDate: "2026-09-29",
        monthlyRent: 2800,
        paymentDay: 5,
        hasGarage: false,
      });

      // Jul, Ago, Set (todas cheias) + proporcional + Fim de Contrato
      const regulares = result.filter((p) => p.payment_kind === "rent" && !p.contract_end);
      expect(regulares.map((p) => p.due_date)).toEqual(["2026-07-05", "2026-08-05", "2026-09-05"]);
      regulares.forEach((p) => expect(p.expected_amount).toBe(2800));

      // 06/09 a 29/09 = 24 dias (o dia do vencimento não entra) -> 2800/30 x 24 = 2240
      const proporcional = result.find((p) => p.payment_kind === "rent" && p.contract_end);
      expect(proporcional).toBeDefined();
      expect(proporcional!.due_date).toBe("2026-09-29");
      expect(proporcional!.expected_amount).toBeCloseTo(2240, 2);

      const fim = fimDeContrato(result);
      expect(fim).toHaveLength(1);
      expect(fim[0]).toMatchObject({ due_date: "2026-09-29", expected_amount: 0, contract_end: true, installment: null });
    });

    test("Data fim ANTES do vencimento do mês: proporcional conta desde o último vencimento (21 dias)", () => {
      // vencimento dia 20, fim 10/09: último vencimento 20/08; 21/08 a 10/09 = 21 dias
      const result = generateExpectedPayments({
        rentalId: "test-fim-2",
        startDate: "2026-06-20",
        endDate: "2026-09-10",
        monthlyRent: 1500,
        paymentDay: 20,
        hasGarage: false,
      });

      const regulares = result.filter((p) => p.payment_kind === "rent" && !p.contract_end);
      expect(regulares.map((p) => p.due_date)).toEqual(["2026-07-20", "2026-08-20"]); // 20/09 já passa do fim
      const proporcional = result.find((p) => p.payment_kind === "rent" && p.contract_end);
      expect(proporcional!.due_date).toBe("2026-09-10");
      expect(proporcional!.expected_amount).toBeCloseTo(1050, 2); // 1500/30 x 21
    });

    test("Fim de Contrato não tem número de parcela e não conta no total de parcelas", () => {
      const result = generateExpectedPayments({
        rentalId: "test-fim-3",
        startDate: "2026-06-05",
        endDate: "2026-09-29",
        monthlyRent: 2800,
        paymentDay: 5,
        hasGarage: false,
      });
      const rent = aluguel(result);
      expect(rent).toHaveLength(4); // Jul, Ago, Set + proporcional de fim de contrato
      rent.forEach((p, i) => {
        expect(p.installment).toBe(i + 1);
        expect(p.total_installments).toBe(rent.length);
      });
      const fim = fimDeContrato(result)[0];
      expect(fim.installment).toBeNull();
      expect(fim.total_installments).toBeNull();
    });
  });

  describe("Testes com Garagem", () => {
    test("Primeiro recebimento proporcional deve incluir garagem proporcional", () => {
      const result = generateExpectedPayments({
        rentalId: "test-rental-garage",
        startDate: "2026-07-10",
        endDate: "2026-09-05",
        monthlyRent: 1500,
        paymentDay: 5,
        hasGarage: true,
        garageValue: 300,
      });

      // 26 dias: aluguel 1500/30 x 26 = 1300; garagem 300/30 x 26 = 260; total 1560
      expect(result[0].expected_amount).toBeCloseTo(1560, 2);
      expect(result[0].breakdown).toHaveLength(2);
      expect(result[0].breakdown[0].description).toContain("Aluguel");
      expect(result[0].breakdown[0].amount).toBeCloseTo(1300, 2);
      expect(result[0].breakdown[1].description).toContain("Garagem");
      expect(result[0].breakdown[1].amount).toBeCloseTo(260, 2);
    });

    test("Recebimento integral deve incluir garagem integral", () => {
      const result = generateExpectedPayments({
        rentalId: "test-rental-garage-full",
        startDate: "2026-07-01",
        endDate: "2026-09-05",
        monthlyRent: 1500,
        paymentDay: 5,
        hasGarage: true,
        garageValue: 300,
      });

      expect(result[1].expected_amount).toBe(1800);
      expect(result[1].breakdown).toHaveLength(2);
      expect(result[1].breakdown[0].amount).toBe(1500);
      expect(result[1].breakdown[1].amount).toBe(300);
    });

    test("Proporcional de fim de contrato também leva a garagem proporcional", () => {
      // vencimento dia 5, fim 29/09: 24 dias -> aluguel 2240 + garagem 300/30 x 24 = 240
      const result = generateExpectedPayments({
        rentalId: "test-fim-garage",
        startDate: "2026-06-05",
        endDate: "2026-09-29",
        monthlyRent: 2800,
        paymentDay: 5,
        hasGarage: true,
        garageValue: 300,
      });
      const proporcional = result.find((p) => p.payment_kind === "rent" && p.contract_end)!;
      expect(proporcional.expected_amount).toBeCloseTo(2480, 2);
      expect(proporcional.breakdown).toHaveLength(2);
      expect(proporcional.breakdown[0].amount).toBeCloseTo(2240, 2);
      expect(proporcional.breakdown[1].amount).toBeCloseTo(240, 2);
    });
  });

  describe("Cálculo de Dias Proporcionais", () => {
    test("início > vencimento: conta dias do resto do mês + dias até o vencimento", () => {
      // 25/07 a 31/07 = 7 dias (inclui o dia 25) + 01/08 a 04/08 = 4 dias = 11 dias
      const result = generateExpectedPayments({
        rentalId: "test-days",
        startDate: "2026-07-25",
        endDate: "2026-08-05",
        monthlyRent: 3000,
        paymentDay: 5,
        hasGarage: false,
      });

      expect(aluguel(result)).toHaveLength(1);
      expect(result[0].reference_month).toBe("08");
      expect(result[0].expected_amount).toBeCloseTo(1100, 2); // 3000/30 x 11
    });

    test("início < vencimento: 02/07 até 05/07 = 3 dias", () => {
      const result = generateExpectedPayments({
        rentalId: "test-days-2",
        startDate: "2026-07-02",
        endDate: "2026-08-05",
        monthlyRent: 3000,
        paymentDay: 5,
        hasGarage: false,
      });

      expect(result[0].reference_month).toBe("07");
      expect(result[0].expected_amount).toBeCloseTo(300, 2); // 3000/30 x 3
    });
  });

  describe("Ajuste de Datas para Meses Especiais", () => {
    test("Vencimento dia 31 em fevereiro deve ajustar para dia 28", () => {
      const result = generateExpectedPayments({
        rentalId: "test-feb", startDate: "2026-01-15", endDate: "2026-03-31",
        monthlyRent: 1500, paymentDay: 31, hasGarage: false,
      });
      const febPayment = result.find((p) => p.reference_month === "02");
      expect(febPayment?.due_date).toBe("2026-02-28");
    });

    test("Vencimento dia 31 em abril deve ajustar para dia 30", () => {
      const result = generateExpectedPayments({
        rentalId: "test-april", startDate: "2026-03-15", endDate: "2026-05-31",
        monthlyRent: 1500, paymentDay: 31, hasGarage: false,
      });
      const aprPayment = result.find((p) => p.reference_month === "04");
      expect(aprPayment?.due_date).toBe("2026-04-30");
    });

    test("Vencimento dia 15 vale em todos os meses (o proporcional e o Fim de Contrato vencem na data fim)", () => {
      const result = generateExpectedPayments({
        rentalId: "test-15", startDate: "2026-01-01", endDate: "2026-12-31",
        monthlyRent: 1500, paymentDay: 15, hasGarage: false,
      });

      const regulares = result.filter((p) => !p.contract_end);
      expect(regulares).toHaveLength(12); // jan a dez
      regulares.forEach((p) => expect(p.due_date).toMatch(/-15$/));

      // últimos 16 dias (16/12 a 31/12): 1500/30 x 16 = 800, vencendo em 31/12
      const finais = result.filter((p) => p.contract_end);
      expect(finais).toHaveLength(2);
      finais.forEach((p) => expect(p.due_date).toBe("2026-12-31"));
      expect(finais.find((p) => p.payment_kind === "rent")!.expected_amount).toBeCloseTo(800, 2);
    });
  });

  describe("Contratos de Diferentes Durações", () => {
    test("Contrato de 12 meses", () => {
      const result = generateExpectedPayments({
        rentalId: "test-12months", startDate: "2026-01-05", endDate: "2027-01-05",
        monthlyRent: 1500, paymentDay: 5, hasGarage: false,
      });

      // início = vencimento: 1ª parcela cheia em fevereiro; última em jan/2027 (vence na data fim)
      const rent = aluguel(result);
      expect(rent).toHaveLength(12);
      expect(rent[0].reference_month).toBe("02");
      expect(rent[0].reference_year).toBe("2026");
      expect(rent[11].reference_month).toBe("01");
      expect(rent[11].reference_year).toBe("2027");
      rent.forEach((p) => expect(p.expected_amount).toBe(1500));
      expect(fimDeContrato(result)).toHaveLength(1);
    });
  });

  describe("Validação de Estrutura dos Recebimentos", () => {
    test("Todos os recebimentos devem ter campos obrigatórios", () => {
      const result = generateExpectedPayments({
        rentalId: "test-structure", startDate: "2026-07-10", endDate: "2026-09-05",
        monthlyRent: 1500, paymentDay: 5, hasGarage: false,
      });

      expect(result.length).toBeGreaterThan(0);
      result.forEach((payment) => {
        expect(payment.rental_id).toBe("test-structure");
        expect(payment).toHaveProperty("reference_month");
        expect(payment).toHaveProperty("reference_year");
        expect(payment.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof payment.expected_amount).toBe("number");
        expect(payment.breakdown.length).toBeGreaterThan(0);
        expect(payment.status).toBe("pending");
      });
    });

    test("Numeração das parcelas de aluguel é sequencial e o total bate", () => {
      const result = generateExpectedPayments({
        rentalId: "test-sequential", startDate: "2026-07-01", endDate: "2026-12-05",
        monthlyRent: 1500, paymentDay: 5, hasGarage: false,
      });

      const rent = aluguel(result);
      expect(rent).toHaveLength(6); // jul a dez
      rent.forEach((payment, index) => {
        expect(payment.installment).toBe(index + 1);
        expect(payment.total_installments).toBe(6);
      });
    });

    test("Reference month deve ter padding (01-12)", () => {
      const result = generateExpectedPayments({
        rentalId: "test-padding", startDate: "2026-01-15", endDate: "2026-09-05",
        monthlyRent: 1500, paymentDay: 5, hasGarage: false,
      });

      expect(result.length).toBeGreaterThan(0);
      result.forEach((payment) => expect(payment.reference_month).toMatch(/^\d{2}$/));
    });

    test("reference_month/year sempre iguais ao mês/ano do vencimento", () => {
      const result = generateExpectedPayments({
        rentalId: "test-ref", startDate: "2026-11-30", endDate: "2027-03-31",
        monthlyRent: 1000, paymentDay: 1, hasGarage: false,
      });
      result.forEach((p) => {
        expect(`${p.reference_year}-${p.reference_month}`).toBe(p.due_date.slice(0, 7));
      });
    });
  });

  describe("Virada de Ano", () => {
    test("Contrato atravessando virada de ano", () => {
      const result = generateExpectedPayments({
        rentalId: "test-year-change", startDate: "2026-11-15", endDate: "2027-02-05",
        monthlyRent: 1500, paymentDay: 5, hasGarage: false,
      });

      // 1ª em dez/2026 (início 15 > vencimento 5), depois jan e fev/2027
      expect(aluguel(result).map((p) => `${p.reference_year}-${p.reference_month}`)).toEqual([
        "2026-12", "2027-01", "2027-02",
      ]);
      const dez = result.find((p) => p.reference_month === "12" && p.reference_year === "2026")!;
      const jan = result.find((p) => p.reference_month === "01" && p.reference_year === "2027")!;
      expect(dez.installment!).toBeLessThan(jan.installment!);
    });
  });

  describe("Edge Cases", () => {
    test("Contrato começando e terminando no mesmo dia de vencimento", () => {
      const result = generateExpectedPayments({
        rentalId: "test-same-day", startDate: "2026-07-05", endDate: "2026-08-05",
        monthlyRent: 1500, paymentDay: 5, hasGarage: false,
      });

      // 1 parcela cheia em agosto + Fim de Contrato (sem proporcional: fim = vencimento)
      expect(result).toHaveLength(2);
      expect(result[0].reference_month).toBe("08");
      expect(result[0].expected_amount).toBe(1500);
      expect(result[1].payment_kind).toBe("termination");
    });

    test("Valor zerado: todos os recebimentos saem com valor 0", () => {
      const result = generateExpectedPayments({
        rentalId: "test-zero", startDate: "2026-07-01", endDate: "2026-08-05",
        monthlyRent: 0, paymentDay: 5, hasGarage: false,
      });

      expect(aluguel(result)).toHaveLength(2); // jul (proporcional) e ago
      result.forEach((payment) => expect(payment.expected_amount).toBe(0));
    });

    // Contrato mais curto que o 1º ciclo: a 1ª parcela vence DEPOIS da data fim.
    // Comportamento atual (cobra os dias até o vencimento, não só até a data fim) --
    // registrado aqui para o caso não mudar sem querer; ver issue aberta sobre isso.
    test("Contrato curto (fim antes do 1º vencimento): hoje gera 1 parcela vencendo depois do fim", () => {
      const result = generateExpectedPayments({
        rentalId: "test-short", startDate: "2026-07-20", endDate: "2026-08-03",
        monthlyRent: 3000, paymentDay: 5, hasGarage: false,
      });

      expect(aluguel(result)).toHaveLength(1);
      expect(result[0].due_date).toBe("2026-08-05");
      // 20/07 a 31/07 = 12 dias + 01/08 a 04/08 = 4 dias = 16 -> 3000/30 x 16 = 1600
      expect(result[0].expected_amount).toBeCloseTo(1600, 2);
      expect(fimDeContrato(result)).toHaveLength(1);
    });
  });
});
