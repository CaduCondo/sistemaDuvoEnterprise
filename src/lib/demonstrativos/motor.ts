/**
 * Motor dos Demonstrativos (#128): DRE, Balanço e Fluxo de Caixa mês a mês,
 * por Local, realizados (A) até o mês atual e projetados (P) depois.
 *
 * Como os três se amarram (por construção, e conferido nos testes):
 *   caixa do mês      = entradas − saídas de dinheiro (método direto)
 *   a receber         = anterior + aluguel devido (líquido) − aluguel recebido
 *   cauções (passivo) = anterior + caução recebida − caução baixada
 *   lucros acumulados = anterior + lucro líquido − repasses
 *   DFC (indireto)    = lucro + depreciação − Δa receber + Δcauções ... e o
 *                       caixa final do DFC tem que ser o caixa do Balanço.
 *   Ativo − Passivo − PL = 0 em todos os meses.
 *
 * Regras de origem dos números: ver docs/REGRAS_DE_NEGOCIO.md, seção
 * "Demonstrativos".
 */
import { calcularCardsDoFinanceiro, expandirParciais } from "@/lib/financeiro/calculos";
import type {
  DadosDoMotor, DespesaBruta, Indicadores, LinhasBalanco, LinhasDFC, LinhasDRE, Mes, Periodo,
  RecebimentoBruto, Regime, ResultadoDoLocal,
} from "./tipos";
import { anoDe, diferencaEmMeses, listaDeMeses, mesDe, mesDeReferencia, somarMeses } from "./datas";
import { cronograma, saldoNoFimDe } from "./financiamento";
import { ibsCbsMensal, irpfMensal, irpjCsllMensal, pisCofinsMensal, repartir } from "./impostos";

export const TIPOS_DE_DESPESA: Record<string, string> = {
  water: "Água",
  electricity: "Luz",
  gas: "Gás",
  internet: "Internet",
  maintenance: "Manutenção",
  condo: "Condomínio",
  iptu: "IPTU",
  cleaning: "Limpeza",
  security: "Segurança",
  other: "Outros",
};

/** Fluxos de um Local num mês, antes dos impostos. */
interface Fluxo {
  aluguel: number;
  garagem: number;
  descontos: number;          // positivo aqui; vira negativo na DRE
  aluguelRecebido: number;    // dinheiro de aluguel que entrou
  compensadoComCaucao: number;// acordo: caução abatido da dívida (sem caixa)
  multas: number;             // dinheiro de multa/juros
  extrasRescisao: number;     // despesas adicionais − desconto da rescisão (dinheiro)
  caucaoRecebida: number;
  caucaoDevolvida: number;    // dinheiro devolvido (corrigido)
  caucaoBaixada: number;      // valor histórico tirado do passivo
  caucaoCompensada: number;   // devolvida via acordo (sem caixa)
  taxaAdm: number;
  taxaGer: number;
  despesas: Record<string, number>;
  capex: number;
  recebidoFinanceiro: number;
  contasFinanceiro: number;
  unidadesOcupadas: number;
}

const zeroFluxo = (): Fluxo => ({
  aluguel: 0, garagem: 0, descontos: 0, aluguelRecebido: 0, compensadoComCaucao: 0, multas: 0,
  extrasRescisao: 0, caucaoRecebida: 0, caucaoDevolvida: 0, caucaoBaixada: 0, caucaoCompensada: 0,
  taxaAdm: 0, taxaGer: 0, despesas: {}, capex: 0, recebidoFinanceiro: 0, contasFinanceiro: 0, unidadesOcupadas: 0,
});

const num = (v: unknown) => Number(v) || 0;

/** Parte de garagem de um recebimento, lida dos itens (breakdown). */
export function valorGaragem(r: RecebimentoBruto): number {
  const itens = Array.isArray(r.breakdown) ? (r.breakdown as any[]) : [];
  const garagem = itens
    .filter((i) => i?.type === "garage" || /garagem/i.test(String(i?.label ?? i?.description ?? "")))
    .reduce((s, i) => s + num(i.value ?? i.amount), 0);
  return Math.max(0, Math.min(garagem, num(r.expected_amount)));
}

/** Entradas de dinheiro de um recebimento: [mês, valor]. */
function entradasDeCaixa(r: RecebimentoBruto): { mes: Mes; valor: number }[] {
  const hist = Array.isArray(r.partial_payments) ? (r.partial_payments as any[]) : [];
  if (hist.length > 0) {
    return hist
      .map((e) => ({ mes: mesDe(e.payment_date) ?? mesDe(r.payment_date) ?? mesDe(r.due_date) ?? "", valor: num(e.amount) }))
      .filter((e) => e.mes);
  }
  const pago = num(r.paid_amount);
  if (pago === 0) return [];
  const mes = mesDe(r.payment_date) ?? mesDe(r.due_date);
  return mes ? [{ mes, valor: pago }] : [];
}

function somar(destino: Record<string, number>, chave: string, valor: number) {
  destino[chave] = (destino[chave] || 0) + valor;
}

interface Contexto {
  meses: Mes[];
  mesBase: Mes;
  mesAtual: Mes;
}

// ---------------------------------------------------------------- realizado

/** Caução no passivo na abertura, por Local (recebida antes da base e ainda não baixada). */
type AberturaCaucao = Map<string, number>;

function fluxosRealizados(dados: DadosDoMotor, ctx: Contexto, aberturaCaucao: AberturaCaucao): Map<string, Map<Mes, Fluxo>> {
  const porLocal = new Map<string, Map<Mes, Fluxo>>();
  const somarAbertura = (local: string, v: number) => aberturaCaucao.set(local, (aberturaCaucao.get(local) || 0) + v);
  const pegar = (local: string, mes: Mes): Fluxo | null => {
    if (mes > ctx.mesAtual) return null;
    const m = mes < ctx.mesBase ? ctx.mesBase : mes;
    if (!porLocal.has(local)) porLocal.set(local, new Map());
    const mapa = porLocal.get(local)!;
    if (!mapa.has(m)) mapa.set(m, zeroFluxo());
    return mapa.get(m)!;
  };

  // Caução recebida por locação, em ordem, para saber quanto baixar do passivo.
  const caucaoPorLocacao = new Map<string, number>();
  for (const c of dados.caucoes) {
    const status = c.status || (c.pix_code ? "paid" : "pending");
    if (status !== "paid" && status !== "partial") continue;
    const valor = num(c.paid_amount) > 0 ? num(c.paid_amount) : num(c.amount);
    const mes = mesDe(c.payment_date) ?? mesDe(c.due_date);
    if (!mes || valor <= 0) continue;
    caucaoPorLocacao.set(c.rental_id, (caucaoPorLocacao.get(c.rental_id) || 0) + valor);
    if (mes < ctx.mesBase) { somarAbertura(c.location_id, valor); continue; }
    const f = pegar(c.location_id, mes);
    if (f) f.caucaoRecebida += valor;
  }
  const baixar = (rentalId: string) => {
    const v = caucaoPorLocacao.get(rentalId) || 0;
    caucaoPorLocacao.set(rentalId, 0);
    return v;
  };

  // Acordos: o caução corrigido abatido da dívida sai do passivo sem dinheiro.
  for (const a of dados.acordos) {
    if (a.status === "undone" || num(a.deposit_returned) <= 0) continue;
    const mesAcordo = mesDe(a.agreement_date) as Mes;
    if (mesAcordo < ctx.mesBase) { somarAbertura(a.location_id, -baixar(a.rental_id)); continue; }
    const f = pegar(a.location_id, mesAcordo);
    if (!f) continue;
    const compensado = num(a.deposit_returned);
    f.caucaoCompensada += compensado;
    f.compensadoComCaucao += compensado;
    f.caucaoBaixada += baixar(a.rental_id);
  }

  // Linhas do Financeiro por Local e mês de referência (mesma conta da tela).
  const linhasFinanceiro = new Map<string, any[]>();

  for (const r of dados.recebimentos) {
    const refMes = mesDeReferencia(r.reference_year, r.reference_month);
    const tipo = r.payment_kind || "rent";

    if (tipo === "termination") {
      // Recebimento de Rescisão / Fim de Contrato: caução, nunca receita.
      if (r.status !== "paid" && r.status !== "partial") continue;
      const entradas = entradasDeCaixa(r);
      const mes = entradas[0]?.mes ?? mesDe(r.due_date);
      if (!mes) continue;
      // Rescisão antes da abertura: já saiu do passivo de abertura.
      if (mes < ctx.mesBase) { somarAbertura(r.location_id, -baixar(r.rental_id)); continue; }
      const f = pegar(r.location_id, mes);
      if (!f) continue;
      const devolvido = Math.abs(num(r.termination_corrected_deposit));
      const caixa = entradas.reduce((s, e) => s + e.valor, 0);
      f.caucaoDevolvida += devolvido;
      f.extrasRescisao += caixa + devolvido;
      f.caucaoBaixada += baixar(r.rental_id);
      continue;
    }

    if (refMes > ctx.mesAtual || refMes < ctx.mesBase) continue;
    const fRef = pegar(r.location_id, refMes);
    if (!fRef) continue;

    const pago = num(r.paid_amount);
    const esperado = num(r.expected_amount);
    const garagemTotal = valorGaragem(r);
    const entradas = entradasDeCaixa(r);

    let bruto: number;
    let desconto = 0;
    let multas = 0;
    if (r.status === "renegotiated") {
      // #119: do original só conta o que foi pago; o resto está nas parcelas.
      bruto = pago;
    } else if (r.status === "paid") {
      // Pago fecha a conta: a diferença vira multa/juros ou desconto.
      const multaNominal = (r.late_fee_waived ? 0 : num(r.late_fee)) + (r.interest_waived ? 0 : num(r.interest));
      if (pago >= esperado) {
        multas = Math.min(multaNominal, pago - esperado);
        bruto = pago - multas;
      } else {
        bruto = esperado;
        desconto = esperado - pago;
      }
    } else {
      bruto = esperado;
      desconto = Math.min(num(r.discount_amount), esperado);
    }
    const garagem = esperado > 0 ? garagemTotal * Math.min(1, bruto / esperado) : 0;
    fRef.garagem += garagem;
    fRef.aluguel += bruto - garagem;
    fRef.descontos += desconto;

    // Dinheiro: cada pagamento no mês em que entrou; a multa sai do último.
    let multaRestante = multas;
    for (let i = entradas.length - 1; i >= 0; i--) {
      const e = entradas[i];
      const f = pegar(r.location_id, e.mes) ?? pegar(r.location_id, ctx.mesAtual)!;
      const multaAqui = Math.min(multaRestante, Math.max(0, e.valor));
      multaRestante -= multaAqui;
      f.multas += multaAqui;
      f.aluguelRecebido += e.valor - multaAqui;
    }

    // Base para a mesma conta do Financeiro.
    const base = {
      id: r.id,
      status: r.status,
      paymentKind: tipo,
      paidAmount: pago,
      expectedAmount: r.status === "renegotiated" ? pago : esperado,
      lateFee: r.status === "renegotiated" ? 0 : num(r.late_fee),
      interest: r.status === "renegotiated" ? 0 : num(r.interest),
      breakdown: r.status === "renegotiated" ? null : r.breakdown,
      property: { locationId: r.location_id },
    };
    const chave = `${r.location_id}|${refMes}`;
    if (!linhasFinanceiro.has(chave)) linhasFinanceiro.set(chave, []);
    linhasFinanceiro.get(chave)!.push(...expandirParciais(r as any, base as any));
  }

  // Despesas (lançada = paga, no mês de referência).
  const despesasPorChave = new Map<string, DespesaBruta[]>();
  for (const d of dados.despesas) {
    const mes = mesDeReferencia(d.reference_year, d.reference_month);
    if (mes < ctx.mesBase) continue;
    const f = pegar(d.location_id, mes);
    if (!f) continue;
    if (d.is_capex) f.capex += num(d.amount);
    else somar(f.despesas, d.expense_type || "other", num(d.amount));
    const chave = `${d.location_id}|${mes}`;
    if (!despesasPorChave.has(chave)) despesasPorChave.set(chave, []);
    despesasPorChave.get(chave)!.push(d);
  }

  // Taxas e "recebido" exatamente como o Financeiro calcula.
  const chaves = new Set([...linhasFinanceiro.keys(), ...despesasPorChave.keys()]);
  for (const chave of chaves) {
    const [local, mes] = chave.split("|");
    const f = pegar(local, mes);
    if (!f) continue;
    const cards = calcularCardsDoFinanceiro({
      linhas: linhasFinanceiro.get(chave) || [],
      despesas: despesasPorChave.get(chave) || [],
      percentualTaxaAdm: dados.config.percentualTaxaAdm,
      percentualTaxaGer: dados.config.percentualTaxaGer,
      locaisIsentosAdm: dados.config.locaisIsentosAdm,
      locaisIsentosGer: dados.config.locaisIsentosGer,
    });
    f.taxaAdm += cards.adminFee;
    f.taxaGer += cards.managementFee;
    f.recebidoFinanceiro += cards.totalReceived;
    f.contasFinanceiro += cards.locationExpenses;
  }

  // Ocupação: unidades com locação vigente no mês.
  for (const local of dados.locais) {
    for (const mes of ctx.meses) {
      if (mes > ctx.mesAtual) break;
      const ocupadas = unidadesOcupadas(dados, local.id, mes);
      if (ocupadas > 0) pegar(local.id, mes)!.unidadesOcupadas = ocupadas;
    }
  }
  return porLocal;
}

function vigente(l: { start_date: string; end_date?: string | null; status?: string | null }, mes: Mes): boolean {
  if (l.status === "deleted") return false;
  const ini = mesDe(l.start_date);
  const fim = mesDe(l.end_date);
  return !!ini && ini <= mes && (!fim || fim >= mes);
}

function unidadesOcupadas(dados: DadosDoMotor, localId: string, mes: Mes): number {
  const imoveis = new Set(
    dados.locacoes.filter((l) => l.location_id === localId && vigente(l, mes)).map((l) => l.property_id),
  );
  return imoveis.size;
}

// ---------------------------------------------------------------- projeção

/** Índice acumulado de `de` até `ate` aplicando a taxa de cada ano. */
function fatorAcumulado(indices: Record<string, number>, anoDe_: number, anoAte: number): number {
  let f = 1;
  for (let a = anoDe_ + 1; a <= anoAte; a++) f *= 1 + num(indices[String(a)] ?? indices[String(a - 1)]) / 100;
  return f;
}

function fluxosProjetados(dados: DadosDoMotor, ctx: Contexto, realizados: Map<string, Map<Mes, Fluxo>>) {
  const p = dados.premissas;
  const vac = num(p.projected_vacancy_pct) / 100;
  const inad = num(p.projected_default_pct) / 100;
  const pctAdm = (dados.config.percentualTaxaAdm ?? 5) / 100;
  const pctGer = (dados.config.percentualTaxaGer ?? 3) / 100;
  const anoAtual = anoDe(ctx.mesAtual);

  for (const local of dados.locais) {
    if (!realizados.has(local.id)) realizados.set(local.id, new Map());
    const mapa = realizados.get(local.id)!;

    // Despesas: média dos últimos 12 meses realizados, por tipo.
    const ultimos = listaDeMeses(somarMeses(ctx.mesAtual, -11), ctx.mesAtual);
    const media: Record<string, number> = {};
    for (const m of ultimos) {
      const f = mapa.get(m);
      if (!f) continue;
      for (const [tipo, v] of Object.entries(f.despesas)) somar(media, tipo, v / 12);
    }

    // Locação mais recente de cada imóvel do Local.
    const porImovel = new Map<string, (typeof dados.locacoes)[number]>();
    for (const l of dados.locacoes) {
      if (l.location_id !== local.id || l.status === "deleted") continue;
      const atual = porImovel.get(l.property_id);
      if (!atual || l.start_date > atual.start_date) porImovel.set(l.property_id, l);
    }

    for (const mes of ctx.meses) {
      if (mes <= ctx.mesAtual) continue;
      const f = zeroFluxo();
      for (const l of porImovel.values()) {
        const ini = mesDe(l.start_date);
        const fim = mesDe(l.end_date);
        if (!ini || ini > mes) continue;
        const encerrada = l.status === "ended" || l.status === "terminated";
        if (encerrada && fim && fim < somarMeses(ctx.mesAtual, 1)) continue; // já saiu: imóvel vago
        // Reajuste no aniversário do contrato, pelo índice de cada ano.
        const aniversarios = Math.max(0, Math.floor(diferencaEmMeses(ini, mes) / 12) - Math.floor(diferencaEmMeses(ini, ctx.mesAtual) / 12));
        const fator = fatorAcumulado(p.rent_index_by_year, anoDe(mes) - aniversarios, anoDe(mes));
        const ocupacao = fim && fim < mes ? 1 - vac : 1; // depois do fim: renova, com vacância
        const aluguel = num(l.rent_value) * fator * ocupacao;
        const garagem = (l.has_garage ? num(l.garage_value) : 0) * fator * ocupacao;
        f.aluguel += aluguel;
        f.garagem += garagem;
        f.unidadesOcupadas += ocupacao;
      }
      const recebido = (f.aluguel + f.garagem) * (1 - inad);
      f.aluguelRecebido = recebido;
      f.recebidoFinanceiro = recebido;
      f.taxaAdm = dados.config.locaisIsentosAdm.includes(local.id) ? 0 : recebido * pctAdm;
      f.taxaGer = dados.config.locaisIsentosGer.includes(local.id) ? 0 : recebido * pctGer;
      const fatorDesp = fatorAcumulado(p.expense_index_by_year, anoAtual, anoDe(mes));
      for (const [tipo, v] of Object.entries(media)) f.despesas[tipo] = v * fatorDesp;
      f.contasFinanceiro = Object.values(f.despesas).reduce((s, v) => s + v, 0);
      mapa.set(mes, f);
    }
  }
}

// ---------------------------------------------------------------- impostos

interface Impostos { sobreReceita: number; renda: number }

function calcularImpostos(dados: DadosDoMotor, ctx: Contexto, fluxos: Map<string, Map<Mes, Fluxo>>) {
  const tp = dados.premissas.tax_params;
  const regimeDe = (id: string): Regime => dados.patrimonios.find((x) => x.location_id === id)?.owner_regime || "pf";
  const resultado = new Map<string, Map<Mes, Impostos>>();
  for (const l of dados.locais) resultado.set(l.id, new Map());

  const receitaTributavel = (f: Fluxo) => f.aluguelRecebido + f.multas + f.extrasRescisao;

  // Pessoa física só paga IBS/CBS acima dos dois limites, no ano.
  const pf = dados.locais.filter((l) => regimeDe(l.id) === "pf");
  const pfContribuinte = new Map<number, boolean>();
  for (const ano of new Set(ctx.meses.map(anoDe))) {
    const receita = pf.reduce((s, l) => s + ctx.meses.filter((m) => anoDe(m) === ano)
      .reduce((s2, m) => s2 + receitaTributavel(fluxos.get(l.id)?.get(m) || zeroFluxo()), 0), 0);
    const unidades = pf.reduce((s, l) => s + l.unidades, 0);
    pfContribuinte.set(ano, receita > tp.pf.ibs_cbs_limite_receita_anual && unidades > tp.pf.ibs_cbs_limite_imoveis);
  }

  for (const mes of ctx.meses) {
    const ano = anoDe(mes);
    // Pessoa física: carnê-leão de um proprietário só, repartido pela base.
    const rendimentos = pf.map((l) => receitaTributavel(fluxos.get(l.id)?.get(mes) || zeroFluxo()));
    const deducoes = pf.map((l) => {
      const f = fluxos.get(l.id)?.get(mes) || zeroFluxo();
      return tp.pf.deduz_taxas ? f.taxaAdm + f.taxaGer : 0;
    });
    const bases = rendimentos.map((r, i) => r - deducoes[i]);
    const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);
    const irpf = irpfMensal(soma(rendimentos), tp.pf, soma(deducoes));
    const partes = repartir(irpf, bases);
    pf.forEach((l, i) => {
      const f = fluxos.get(l.id)?.get(mes) || zeroFluxo();
      const ibs = pfContribuinte.get(ano) ? ibsCbsMensal(receitaTributavel(f), f.unidadesOcupadas, ano, tp.ibs_cbs) : 0;
      resultado.get(l.id)!.set(mes, { sobreReceita: ibs, renda: partes[i] });
    });
    // Holding: lucro presumido (por Local; hoje só existe um Local holding).
    for (const l of dados.locais.filter((x) => regimeDe(x.id) === "holding")) {
      const f = fluxos.get(l.id)?.get(mes) || zeroFluxo();
      const receita = receitaTributavel(f);
      const sobreReceita = pisCofinsMensal(receita, ano, tp) +
        (ano > tp.ibs_cbs.pis_cofins_ate_ano ? ibsCbsMensal(receita, f.unidadesOcupadas, ano, tp.ibs_cbs) : 0);
      resultado.get(l.id)!.set(mes, { sobreReceita, renda: irpjCsllMensal(receita, tp.holding) });
    }
  }
  return resultado;
}

// ------------------------------------------------------------ montar meses

function montarLocal(
  dados: DadosDoMotor, ctx: Contexto, localId: string, fluxos: Map<Mes, Fluxo>, impostos: Map<Mes, Impostos>,
  caixaInicial: number, caucaoAbertura: number,
): Periodo[] {
  const pat = dados.patrimonios.find((x) => x.location_id === localId);
  const terreno = num(pat?.land_value);
  const edificacao = num(pat?.building_value);
  const vida = Math.max(1, num(pat?.building_useful_life_years) || 25) * 12;
  const depMensal = edificacao / vida;
  const mesAquisicao = mesDe(pat?.acquisition_date) ?? ctx.mesBase;
  const mesesDepreciados = Math.min(vida, Math.max(0, diferencaEmMeses(mesAquisicao, ctx.mesBase)));
  const local = dados.locais.find((l) => l.id === localId)!;

  const financiamentos = dados.financiamentos.filter((f) => f.location_id === localId);
  const cronos = financiamentos.map((f) => ({ f, c: cronograma(f) }));
  const mesAntesBase = somarMeses(ctx.mesBase, -1);

  // Saldos de abertura (fim do mês anterior à base).
  let caixa = caixaInicial;
  let aReceber = 0;
  let edifLiquida = edificacao - depMensal * mesesDepreciados;
  let capexAcumulado = 0;
  let depCapexMensal = 0;
  let caucoes = caucaoAbertura;
  let divida = financiamentos.reduce((s, f) => s + saldoNoFimDe(f, mesAntesBase), 0);
  const capital = caixa + aReceber + terreno + edifLiquida - caucoes - divida;
  let lucros = 0;
  let depAcumuladaEdif = depMensal * mesesDepreciados;

  const periodos: Periodo[] = [];
  for (const mes of ctx.meses) {
    const f = fluxos.get(mes) || zeroFluxo();
    const imp = impostos.get(mes) || { sobreReceita: 0, renda: 0 };

    // Financiamento do mês.
    let juros = 0;
    let amortizacao = 0;
    let captacao = 0;
    for (const { f: fin, c } of cronos) {
      if (c.mesInicio === mes && mes >= ctx.mesBase) captacao += fin.principal;
      const parcela = c.parcelas.find((x) => x.mes === mes);
      if (parcela) { juros += parcela.juros; amortizacao += parcela.amortizacao; }
    }

    // Depreciação: edificação até o fim da vida útil + reformas (capex).
    const depEdif = mes < mesAquisicao ? 0 : Math.min(depMensal, Math.max(0, edificacao - depAcumuladaEdif));
    depAcumuladaEdif += depEdif;
    const depreciacao = depEdif + depCapexMensal;

    const despesasPorTipo: Record<string, number> = {};
    for (const [t, v] of Object.entries(f.despesas)) despesasPorTipo[t] = -v;
    const despesasOperacionais = -Object.values(f.despesas).reduce((s, v) => s + v, 0);

    const receitaBruta = f.aluguel + f.garagem + f.compensadoComCaucao;
    const receitaLiquida = receitaBruta - f.descontos - imp.sobreReceita;
    const noi = receitaLiquida - f.taxaAdm - f.taxaGer + despesasOperacionais;
    const correcao = -(f.caucaoDevolvida + f.caucaoCompensada - f.caucaoBaixada);
    const outras = f.multas + f.extrasRescisao;
    const lucroAntesIR = noi - depreciacao + outras + correcao - juros;
    const lucroLiquido = lucroAntesIR - imp.renda;

    const dre: LinhasDRE = {
      receitaAluguel: f.aluguel + f.compensadoComCaucao,
      receitaGaragem: f.garagem,
      receitaBruta,
      descontos: -f.descontos,
      impostosSobreReceita: -imp.sobreReceita,
      receitaLiquida,
      taxaAdministracao: -f.taxaAdm,
      taxaGerenciamento: -f.taxaGer,
      despesasPorTipo,
      despesasOperacionais,
      noi,
      depreciacao: -depreciacao,
      outrasReceitas: outras,
      correcaoCaucao: correcao,
      jurosFinanciamento: -juros,
      lucroAntesIR,
      impostoDeRenda: -imp.renda,
      lucroLiquido,
    };

    // Caixa (método direto).
    const fco = f.aluguelRecebido + f.multas + f.extrasRescisao - f.taxaAdm - f.taxaGer
      + despesasOperacionais - imp.sobreReceita - imp.renda - juros + f.caucaoRecebida - f.caucaoDevolvida;
    const fci = -f.capex;
    const antesRepasse = fco + fci + captacao - amortizacao;
    const repasse = Math.max(0, antesRepasse) * (num(dados.premissas.owner_distribution_pct) / 100);
    const fcf = captacao - amortizacao - repasse;

    const caixaInicialMes = caixa;
    const aReceberAnterior = aReceber;
    const caucoesAnterior = caucoes;

    caixa += fco + fci + fcf;
    aReceber += f.aluguel + f.garagem - f.descontos - f.aluguelRecebido;
    caucoes += f.caucaoRecebida - f.caucaoBaixada;
    divida += captacao - amortizacao;
    capexAcumulado += f.capex;
    edifLiquida += f.capex - depreciacao;
    depCapexMensal += f.capex / vida;
    lucros += lucroLiquido - repasse;

    const totalAtivo = caixa + aReceber + terreno + edifLiquida;
    const totalPassivo = caucoes + divida;
    const totalPL = capital + lucros;
    const balanco: LinhasBalanco = {
      caixa, alugueisAReceber: aReceber, terreno, edificacaoLiquida: edifLiquida, totalAtivo,
      despesasAPagar: 0, caucoesInquilinos: caucoes, financiamentos: divida, totalPassivo,
      capital, lucrosAcumulados: lucros, totalPL, diferenca: totalAtivo - totalPassivo - totalPL,
    };

    // DFC (método indireto) — tem que chegar no mesmo caixa.
    const variacaoAReceber = -(aReceber - aReceberAnterior);
    const variacaoCaucoes = caucoes - caucoesAnterior;
    const fcoIndireto = lucroLiquido + depreciacao + variacaoAReceber + variacaoCaucoes;
    const dfc: LinhasDFC = {
      lucroLiquido, depreciacao, variacaoAReceber, variacaoDespesasAPagar: 0, variacaoCaucoes,
      fco: fcoIndireto, capex: fci, fci, captacoes: captacao, amortizacoes: -amortizacao, repasses: -repasse, fcf,
      variacaoCaixa: fcoIndireto + fci + fcf, caixaInicial: caixaInicialMes, caixaFinal: caixaInicialMes + fcoIndireto + fci + fcf,
    };

    const indicadores: Indicadores = {
      recebidoFinanceiro: f.recebidoFinanceiro,
      contasDoMesFinanceiro: f.contasFinanceiro,
      unidades: local.unidades,
      unidadesOcupadas: f.unidadesOcupadas,
      investimentoTotal: terreno + edificacao + capexAcumulado,
      inadimplenciaValor: Math.max(0, aReceber),
    };
    periodos.push({ chave: mes, tipo: mes <= ctx.mesAtual ? "A" : "P", dre, balanco, dfc, indicadores });
  }
  return periodos;
}

// ------------------------------------------------------------------- API

export interface ResultadoDosDemonstrativos {
  meses: Mes[];
  mesAtual: Mes;
  locais: ResultadoDoLocal[];
}

export function calcularDemonstrativos(dados: DadosDoMotor): ResultadoDosDemonstrativos {
  const mesBase = mesDe(dados.premissas.base_date) ?? "2026-01";
  const fim = `${anoDe(dados.mesAtual) + Math.max(1, num(dados.premissas.projection_years) || 5)}-12`;
  const ctx: Contexto = { meses: listaDeMeses(mesBase, fim), mesBase, mesAtual: dados.mesAtual };

  const aberturaCaucao: AberturaCaucao = new Map();
  const fluxos = fluxosRealizados(dados, ctx, aberturaCaucao);
  fluxosProjetados(dados, ctx, fluxos);
  const impostos = calcularImpostos(dados, ctx, fluxos);

  // Caixa inicial da carteira repartido pelo número de unidades de cada Local.
  const caixas = repartir(num(dados.premissas.opening_cash), dados.locais.map((l) => Math.max(1, l.unidades)));

  const locais = dados.locais.map((l, i) => ({
    localId: l.id,
    nome: l.name,
    regime: (dados.patrimonios.find((x) => x.location_id === l.id)?.owner_regime || "pf") as Regime,
    meses: montarLocal(dados, ctx, l.id, fluxos.get(l.id) || new Map(), impostos.get(l.id) || new Map(), caixas[i], Math.max(0, aberturaCaucao.get(l.id) || 0)),
  }));
  return { meses: ctx.meses, mesAtual: dados.mesAtual, locais };
}
