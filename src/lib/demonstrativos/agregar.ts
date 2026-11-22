import type { Indicadores, LinhasBalanco, LinhasDFC, LinhasDRE, Periodo, Regime, ResultadoDoLocal } from "./tipos";
import { anoDe } from "./datas";

/** Soma campo a campo (números e mapas de números). */
function somarObjetos<T extends Record<string, any>>(a: T, b: T): T {
  const r: any = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number") r[k] = (r[k] || 0) + v;
    else if (v && typeof v === "object") r[k] = somarObjetos(r[k] || {}, v);
  }
  return r;
}

export type FiltroRegime = "todos" | Regime;

/** Junta vários Locais num só (consolidado, só Holding, só PF...). */
export function consolidar(locais: ResultadoDoLocal[]): Periodo[] {
  if (locais.length === 0) return [];
  return locais[0].meses.map((_, i) => {
    let p: Periodo | null = null;
    for (const l of locais) {
      const m = l.meses[i];
      p = p
        ? {
            ...p,
            dre: somarObjetos(p.dre, m.dre),
            balanco: somarObjetos(p.balanco, m.balanco),
            dfc: somarObjetos(p.dfc, m.dfc),
            indicadores: somarObjetos(p.indicadores, m.indicadores),
          }
        : { ...m };
    }
    return p!;
  });
}

export function filtrarLocais(locais: ResultadoDoLocal[], localId: string | "todos", regime: FiltroRegime) {
  return locais.filter((l) => (localId === "todos" || l.localId === localId) && (regime === "todos" || l.regime === regime));
}

/**
 * Junta vários meses num período só: fluxos (DRE e DFC) somados; saldos
 * (Balanço) do último mês; caixa inicial do primeiro mês.
 */
export function juntarPeriodos(lista: Periodo[], chave: string): Periodo {
  const ultimo = lista[lista.length - 1];
  const dre = lista.slice(1).reduce((s, m) => somarObjetos(s, m.dre), { ...lista[0].dre }) as LinhasDRE;
  const dfc = lista.slice(1).reduce((s, m) => somarObjetos(s, m.dfc), { ...lista[0].dfc }) as LinhasDFC;
  dfc.caixaInicial = lista[0].dfc.caixaInicial;
  dfc.caixaFinal = ultimo.dfc.caixaFinal;
  const tipos = new Set(lista.map((m) => m.tipo));
  const somaInd = lista.slice(1).reduce((s, m) => somarObjetos(s, m.indicadores), { ...lista[0].indicadores }) as Indicadores;
  const indicadores: Indicadores = {
    ...somaInd,
    // Unidades e ocupação: média do período; investimento e inadimplência: fim do período.
    unidades: ultimo.indicadores.unidades,
    unidadesOcupadas: somaInd.unidadesOcupadas / lista.length,
    investimentoTotal: ultimo.indicadores.investimentoTotal,
    inadimplenciaValor: ultimo.indicadores.inadimplenciaValor,
  };
  return {
    chave,
    tipo: tipos.size > 1 ? "A+P" : (lista[0].tipo as Periodo["tipo"]),
    dre,
    balanco: { ...ultimo.balanco } as LinhasBalanco,
    dfc,
    indicadores,
    meses: lista.length,
  } as Periodo;
}

/** Visão anual: um período por ano. */
export function anualizar(meses: Periodo[]): Periodo[] {
  const porAno = new Map<number, Periodo[]>();
  for (const m of meses) {
    const a = anoDe(m.chave);
    if (!porAno.has(a)) porAno.set(a, []);
    porAno.get(a)!.push(m);
  }
  return [...porAno.entries()].map(([ano, lista]) => juntarPeriodos(lista, String(ano)));
}

/** Indicadores do Resumo para um período (mês ou ano). */
export function indicadoresDoResumo(p: Periodo) {
  const d = p.dre;
  const ocupacao = p.indicadores.unidades > 0 ? p.indicadores.unidadesOcupadas / p.indicadores.unidades : 0;
  const meses = p.meses ?? (p.chave.length === 4 ? 12 : 1);
  const noiAnual = d.noi * (12 / meses);
  return {
    receita: d.receitaBruta,
    noi: d.noi,
    margemNoi: d.receitaLiquida !== 0 ? d.noi / d.receitaLiquida : 0,
    lucroLiquido: d.lucroLiquido,
    caixaGerado: p.dfc.variacaoCaixa,
    ocupacao,
    inadimplencia: d.receitaBruta > 0 ? p.indicadores.inadimplenciaValor / (d.receitaBruta * (12 / meses)) : 0,
    yieldSobreCusto: p.indicadores.investimentoTotal > 0 ? noiAnual / p.indicadores.investimentoTotal : 0,
    balancoFechado: Math.abs(p.balanco.diferenca) < 0.01,
  };
}
