import { describe, expect, test } from "vitest";
import { calcularDemonstrativos } from "../motor";
import { anualizar, consolidar, filtrarLocais } from "../agregar";
import { irpfMensal, irpjCsllMensal, aliquotaIbsCbs } from "../impostos";
import { cronograma } from "../financiamento";
import type { DadosDoMotor, ParametrosImpostos, Periodo } from "../tipos";

const tax: ParametrosImpostos = {
  pf: {
    irpf_faixas: [
      { ate: 2428.8, aliquota: 0, deducao: 0 },
      { ate: 2826.65, aliquota: 7.5, deducao: 182.16 },
      { ate: 3751.05, aliquota: 15, deducao: 394.16 },
      { ate: 4664.68, aliquota: 22.5, deducao: 675.49 },
      { ate: null, aliquota: 27.5, deducao: 908.73 },
    ],
    redutor_ate: 5000, redutor_max: 312.89, redutor_faixa_ate: 7350, redutor_a: 978.62, redutor_b: 0.133145,
    deduz_taxas: true, desconto_simplificado_mensal: 607.2, ibs_cbs_limite_receita_anual: 240000, ibs_cbs_limite_imoveis: 3,
  },
  holding: {
    presuncao_pct: 32, irpj_pct: 15, irpj_adicional_pct: 10, irpj_adicional_limite_mensal: 20000,
    csll_pct: 9, pis_pct: 0.65, cofins_pct: 3,
  },
  ibs_cbs: {
    reducao_locacao_pct: 70, redutor_social_mensal_por_unidade: 600, cbs_referencia_pct: 8.8, ibs_referencia_pct: 17.7,
    cbs_fator_por_ano: { 2026: 0, 2027: 1 }, ibs_fator_por_ano: { 2026: 0, 2029: 0.1, 2033: 1 }, pis_cofins_ate_ano: 2026,
  },
};

/** Um Local com 2 apartamentos alugados a R$ 2.000 + R$ 1.500, recebidos em dia de jan a mar/2026. */
function cenario(extra: Partial<DadosDoMotor> = {}): DadosDoMotor {
  const recebimentos = [];
  for (const mes of ["01", "02", "03"]) {
    recebimentos.push(
      { id: `a${mes}`, rental_id: "R1", location_id: "L1", payment_kind: "rent", status: "paid", expected_amount: 2000,
        paid_amount: 2000, reference_month: mes, reference_year: "2026", payment_date: `2026-${mes}-10`,
        breakdown: [{ type: "addition", amount: 1800, description: "Aluguel" }, { type: "addition", amount: 200, description: "Garagem" }] },
      { id: `b${mes}`, rental_id: "R2", location_id: "L1", payment_kind: "rent", status: mes === "03" ? "pending" : "paid",
        expected_amount: 1500, paid_amount: mes === "03" ? 0 : 1500, reference_month: mes, reference_year: "2026",
        payment_date: mes === "03" ? null : `2026-${mes}-12` },
    );
  }
  return {
    locais: [{ id: "L1", name: "Prédio A", unidades: 2 }, { id: "L2", name: "Holding B", unidades: 1 }],
    recebimentos,
    caucoes: [],
    despesas: [
      { location_id: "L1", amount: 300, expense_type: "water", reference_month: 1, reference_year: 2026 },
      { location_id: "L1", amount: 100, expense_type: "electricity", reference_month: 2, reference_year: 2026 },
    ],
    acordos: [],
    locacoes: [
      { id: "R1", property_id: "P1", location_id: "L1", status: "active", start_date: "2025-06-01", end_date: "2027-05-31", rent_value: 1800, garage_value: 200, has_garage: true },
      { id: "R2", property_id: "P2", location_id: "L1", status: "active", start_date: "2025-01-01", end_date: "2026-12-31", rent_value: 1500 },
      { id: "R3", property_id: "P3", location_id: "L2", status: "active", start_date: "2026-01-01", end_date: "2028-12-31", rent_value: 5000 },
    ],
    patrimonios: [
      { location_id: "L1", owner_regime: "pf", acquisition_date: "2010-01-01", land_value: 200000, building_value: 300000, building_useful_life_years: 25 },
      { location_id: "L2", owner_regime: "holding", acquisition_date: "2020-01-01", land_value: 100000, building_value: 400000, building_useful_life_years: 25 },
    ],
    financiamentos: [],
    premissas: {
      base_date: "2026-01-01", opening_cash: 10000, owner_distribution_pct: 0, projected_vacancy_pct: 5,
      projected_default_pct: 2, projection_years: 5,
      rent_index_by_year: { 2026: 4, 2027: 4, 2028: 4, 2029: 4, 2030: 4, 2031: 4 },
      expense_index_by_year: { 2026: 4, 2027: 4, 2028: 4, 2029: 4, 2030: 4, 2031: 4 },
      tax_params: tax,
    },
    config: { percentualTaxaAdm: 5, percentualTaxaGer: 3, locaisIsentosAdm: [], locaisIsentosGer: [] },
    mesAtual: "2026-03",
    ...extra,
  };
}

const todosOsPeriodos = (d: DadosDoMotor): Periodo[] => {
  const r = calcularDemonstrativos(d);
  const cons = consolidar(r.locais);
  return [...r.locais.flatMap((l) => [...l.meses, ...anualizar(l.meses)]), ...cons, ...anualizar(cons)];
};

describe("Ligações obrigatórias entre os 3 demonstrativos", () => {
  test("Balanço fecha (Ativo − Passivo − PL = 0) em todos os meses e anos, A e P", () => {
    for (const p of todosOsPeriodos(cenario())) expect(Math.abs(p.balanco.diferenca)).toBeLessThan(0.01);
  });

  test("Caixa final do Fluxo de Caixa = caixa do Balanço, sem ajuste", () => {
    for (const p of todosOsPeriodos(cenario())) expect(p.dfc.caixaFinal).toBeCloseTo(p.balanco.caixa, 6);
  });

  test("Lucros acumulados = anterior + lucro líquido − repasses", () => {
    const d = cenario({ premissas: { ...cenario().premissas, owner_distribution_pct: 50 } });
    const meses = calcularDemonstrativos(d).locais[0].meses;
    for (let i = 1; i < meses.length; i++) {
      const esperado = meses[i - 1].balanco.lucrosAcumulados + meses[i].dre.lucroLiquido + meses[i].dfc.repasses;
      expect(meses[i].balanco.lucrosAcumulados).toBeCloseTo(esperado, 6);
    }
    for (const p of meses) expect(Math.abs(p.balanco.diferenca)).toBeLessThan(0.01);
  });
});

describe("Receita, a receber e as mesmas contas do Financeiro", () => {
  test("Receita por competência separa aluguel e garagem; pendente vira a receber", () => {
    const [jan, , mar] = calcularDemonstrativos(cenario()).locais[0].meses;
    expect(jan.dre.receitaGaragem).toBe(200);
    expect(jan.dre.receitaAluguel).toBe(3300);
    expect(jan.balanco.alugueisAReceber).toBe(0);
    expect(mar.balanco.alugueisAReceber).toBe(1500);
    expect(mar.tipo).toBe("A");
  });

  test("Recebido, taxas e Contas do Mês = Financeiro (5% e 3% sobre o recebido)", () => {
    const [jan, , mar] = calcularDemonstrativos(cenario()).locais[0].meses;
    expect(jan.indicadores.recebidoFinanceiro).toBe(3500);
    expect(jan.dre.taxaAdministracao).toBeCloseTo(-175);
    expect(jan.dre.taxaGerenciamento).toBeCloseTo(-105);
    expect(jan.indicadores.contasDoMesFinanceiro).toBe(300);
    expect(mar.indicadores.recebidoFinanceiro).toBe(2000);
  });

  test("Isenção da taxa de gerenciamento por Local", () => {
    const d = cenario({ config: { percentualTaxaAdm: 5, percentualTaxaGer: 3, locaisIsentosAdm: [], locaisIsentosGer: ["L1"] } });
    const jan = calcularDemonstrativos(d).locais[0].meses[0];
    expect(jan.dre.taxaGerenciamento).toBeCloseTo(0);
    expect(jan.dre.taxaAdministracao).toBeCloseTo(-175);
  });

  test("Multa paga vai para Outras receitas, não para o aluguel", () => {
    const d = cenario();
    d.recebimentos[0] = { ...d.recebimentos[0], paid_amount: 2060, late_fee: 40, interest: 20 };
    const jan = calcularDemonstrativos(d).locais[0].meses[0];
    expect(jan.dre.outrasReceitas).toBe(60);
    expect(jan.dre.receitaBruta).toBe(3500);
    expect(jan.balanco.alugueisAReceber).toBe(0);
  });

  test("Multa perdoada (isentada) não conta", () => {
    const d = cenario();
    d.recebimentos[0] = { ...d.recebimentos[0], paid_amount: 2000, late_fee: 40, late_fee_waived: true };
    expect(calcularDemonstrativos(d).locais[0].meses[0].dre.outrasReceitas).toBe(0);
  });

  test("Recebimento de Rescisão nunca entra na receita", () => {
    const d = cenario();
    d.recebimentos.push({ id: "t1", rental_id: "R2", location_id: "L1", payment_kind: "termination", status: "pending",
      expected_amount: -1500, reference_month: "03", reference_year: "2026" });
    const mar = calcularDemonstrativos(d).locais[0].meses[2];
    expect(mar.dre.receitaBruta).toBe(3500);
  });
});

describe("Caução", () => {
  test("Caução recebida aumenta caixa e passivo e não aparece na DRE", () => {
    const sem = calcularDemonstrativos(cenario()).locais[0].meses[1];
    const d = cenario({ caucoes: [{ rental_id: "R1", location_id: "L1", status: "paid", amount: 4000, paid_amount: 4000, payment_date: "2026-02-05" }] });
    const com = calcularDemonstrativos(d).locais[0].meses[1];
    expect(com.balanco.caixa - sem.balanco.caixa).toBeCloseTo(4000);
    expect(com.balanco.caucoesInquilinos - sem.balanco.caucoesInquilinos).toBeCloseTo(4000);
    expect(com.dre.lucroLiquido).toBeCloseTo(sem.dre.lucroLiquido);
    expect(com.dre.receitaBruta).toBe(sem.dre.receitaBruta);
  });

  test("Devolução corrigida baixa o passivo e a correção é despesa", () => {
    const d = cenario({ caucoes: [{ rental_id: "R2", location_id: "L1", status: "paid", amount: 3000, payment_date: "2026-01-05" }] });
    d.recebimentos.push({ id: "t2", rental_id: "R2", location_id: "L1", payment_kind: "termination", status: "paid",
      expected_amount: -3100, paid_amount: -3100, termination_corrected_deposit: -3100,
      reference_month: "03", reference_year: "2026", payment_date: "2026-03-20" });
    const meses = calcularDemonstrativos(d).locais[0].meses;
    expect(meses[2].balanco.caucoesInquilinos).toBeCloseTo(0);
    expect(meses[2].dre.correcaoCaucao).toBeCloseTo(-100);
    for (const p of meses) expect(Math.abs(p.balanco.diferenca)).toBeLessThan(0.01);
  });
});

describe("Financiamento", () => {
  test("Sem financiamento, juros zero", () => {
    for (const p of calcularDemonstrativos(cenario()).locais[0].meses) expect(p.dre.jurosFinanciamento).toBeCloseTo(0, 10);
  });

  test("Com financiamento: juros na DRE, dívida no Balanço e balanço fechado", () => {
    const d = cenario({ financiamentos: [{ location_id: "L1", start_date: "2025-06-01", principal: 120000, annual_rate_pct: 12, term_months: 120, amortization_system: "SAC" }] });
    const meses = calcularDemonstrativos(d).locais[0].meses;
    expect(meses[0].dre.jurosFinanciamento).toBeLessThan(0);
    expect(meses[0].balanco.financiamentos).toBeLessThan(120000);
    for (const p of meses) expect(Math.abs(p.balanco.diferenca)).toBeLessThan(0.01);
  });

  test("SAC amortiza igual todo mês; Price zera o saldo no fim", () => {
    const sac = cronograma({ location_id: "L", start_date: "2026-01-01", principal: 12000, annual_rate_pct: 10, term_months: 12, amortization_system: "SAC" });
    expect(sac.parcelas[0].amortizacao).toBeCloseTo(1000);
    const price = cronograma({ location_id: "L", start_date: "2026-01-01", principal: 12000, annual_rate_pct: 10, term_months: 12, amortization_system: "PRICE" });
    expect(price.parcelas[11].saldoFinal).toBeCloseTo(0);
    const p0 = price.parcelas[0].juros + price.parcelas[0].amortizacao;
    const p5 = price.parcelas[5].juros + price.parcelas[5].amortizacao;
    expect(p0).toBeCloseTo(p5, 6);
  });
});

describe("Projeção de 5 anos", () => {
  test("Vai até dezembro do 5º ano e é marcada como P", () => {
    const meses = calcularDemonstrativos(cenario()).locais[0].meses;
    expect(meses[meses.length - 1].chave).toBe("2031-12");
    expect(meses.find((m) => m.chave === "2026-04")!.tipo).toBe("P");
  });

  test("+10 p.p. de vacância reduz a receita projetada e mantém o balanço fechado", () => {
    const base = cenario();
    const mais = cenario({ premissas: { ...base.premissas, projected_vacancy_pct: 15 } });
    const receita = (d: DadosDoMotor) =>
      anualizar(consolidar(calcularDemonstrativos(d).locais)).find((a) => a.chave === "2029")!.dre.receitaBruta;
    expect(receita(mais)).toBeLessThan(receita(base));
    for (const p of todosOsPeriodos(mais)) expect(Math.abs(p.balanco.diferenca)).toBeLessThan(0.01);
  });

  test("Reajuste no aniversário do contrato", () => {
    const meses = calcularDemonstrativos(cenario()).locais[1].meses;
    const dez26 = meses.find((m) => m.chave === "2026-12")!.dre.receitaBruta;
    const jan27 = meses.find((m) => m.chave === "2027-01")!.dre.receitaBruta;
    expect(jan27).toBeCloseTo(dez26 * 1.04, 2);
  });
});

describe("Filtro por regime (Holding / Pessoa física)", () => {
  test("Holding mostra só o Local holding", () => {
    const r = calcularDemonstrativos(cenario());
    const holding = filtrarLocais(r.locais, "todos", "holding");
    expect(holding.map((l) => l.localId)).toEqual(["L2"]);
    expect(filtrarLocais(r.locais, "todos", "pf").map((l) => l.localId)).toEqual(["L1"]);
  });
});

describe("Impostos", () => {
  test("IRPF: até R$ 5.000 isento pelo redutor; acima de R$ 7.350 sem redutor", () => {
    // 5.000 − 607,20 = 4.392,80 → 22,5% − 675,49 = 312,89; redutor 312,89 → zero.
    expect(irpfMensal(5000, tax.pf)).toBe(0);
    // 10.000 − 607,20 = 9.392,80 → 27,5% − 908,73 = 1.674,29.
    expect(irpfMensal(10000, tax.pf)).toBeCloseTo(1674.29, 2);
    // Dedução maior que o desconto simplificado: usa a dedução.
    expect(irpfMensal(10000, tax.pf, 1000)).toBeCloseTo(9000 * 0.275 - 908.73, 2);
    expect(irpfMensal(6000, tax.pf)).toBeGreaterThan(0);
  });

  test("Lucro presumido: R$ 10.000 de aluguel = IRPJ 480 + CSLL 288", () => {
    expect(irpjCsllMensal(10000, tax.holding)).toBeCloseTo(768, 2);
  });

  test("IBS/CBS: zero em 2026; em 2027 só a CBS com redução de 70%", () => {
    expect(aliquotaIbsCbs(2026, tax.ibs_cbs)).toBe(0);
    expect(aliquotaIbsCbs(2027, tax.ibs_cbs)).toBeCloseTo(0.088 * 0.3, 6);
  });
});
