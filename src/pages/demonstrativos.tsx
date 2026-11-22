import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { supabase } from "@/integrations/supabase/client";
import { anualizar, consolidar, filtrarLocais, indicadoresDoResumo, juntarPeriodos, type FiltroRegime } from "@/lib/demonstrativos/agregar";
import { anoDe } from "@/lib/demonstrativos/datas";
import { linhasBalanco, linhasDFC, linhasDRE } from "@/lib/demonstrativos/linhas";
import type { DadosDoMotor, Periodo } from "@/lib/demonstrativos/tipos";
import type { ResultadoDosDemonstrativos } from "@/lib/demonstrativos/motor";
import {
  carregarDemonstrativos, carregarFinanciamentos, carregarPatrimonios, carregarPremissas, NOME_DO_REGIME,
  type FinanciamentoDoLocal, type PatrimonioDoLocal,
} from "@/services/demonstrativosService";
import { TabelaDemonstrativo } from "@/components/demonstrativos/TabelaDemonstrativo";
import { AbaPremissas } from "@/components/demonstrativos/AbaPremissas";
import { COR, FONTE_CORPO, FONTE_TITULO, fmtPct, fmtPeriodo, fmtR } from "@/components/demonstrativos/estilo";

/**
 * Demonstrativos (#128): DRE, Balanço e Fluxo de Caixa de cada Local e da
 * carteira, realizados (A) e projetados (P). Contas em src/lib/demonstrativos.
 * Manual: docs/REGRAS_DE_NEGOCIO.md, seção "📑 Demonstrativos".
 */

type Visao = "mensal" | "anual";

const NOMES_DAS_ABAS: Record<string, string> = {
  resumo: "Resumo", dre: "DRE", balanco: "Balanço", dfc: "Fluxo de Caixa", predios: "Por Prédio", premissas: "Premissas",
};

const estiloSelect: CSSProperties = {
  border: `1px dashed ${COR.taupe}`, background: COR.begeClaro, color: COR.texto, padding: "4px 8px",
  fontFamily: FONTE_CORPO, fontSize: 14, minWidth: 150,
};

function FaixaDoBloco({ nome }: { nome: string }) {
  return (
    <div style={{ background: COR.vinhoEscuro, color: "#fff", fontWeight: 700, fontSize: 14, padding: "4px 10px", fontFamily: FONTE_CORPO }}>
      {nome}
    </div>
  );
}

export default function DemonstrativosPage() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosDoMotor | null>(null);
  const [resultado, setResultado] = useState<ResultadoDosDemonstrativos | null>(null);
  const [premissasId, setPremissasId] = useState<string>("");
  const [patrimonios, setPatrimonios] = useState<PatrimonioDoLocal[]>([]);
  const [financiamentos, setFinanciamentos] = useState<FinanciamentoDoLocal[]>([]);

  const [localId, setLocalId] = useState<string>("todos");
  const [regime, setRegime] = useState<FiltroRegime>("todos");
  const [visao, setVisao] = useState<Visao>("anual");
  const [anoMensal, setAnoMensal] = useState<number>(new Date().getFullYear());
  /** Visão mensal: o Resumo e o "Por Prédio" podem olhar um mês só (0 = ano inteiro). */
  const [mesResumo, setMesResumo] = useState<number>(0);
  const [anoDe_, setAnoDe] = useState<number>(0);
  const [anoAte, setAnoAte] = useState<number>(0);
  const [aba, setAba] = useState("resumo");
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      let locaisPermitidos: string[] | undefined;
      if (user?.role === "financial") {
        const { data } = await supabase.from("user_location_permissions").select("location_id").eq("user_id", user.id);
        locaisPermitidos = (data || []).map((p: any) => p.location_id);
      }
      const [{ dados: d, resultado: r }, premissas, pats, fins] = await Promise.all([
        carregarDemonstrativos({ locaisPermitidos }),
        carregarPremissas(),
        carregarPatrimonios(),
        carregarFinanciamentos(),
      ]);
      setDados(d);
      setResultado(r);
      setPremissasId(premissas.id);
      setPatrimonios(pats);
      setFinanciamentos(fins);
      const anos = r.meses.map(anoDe);
      setAnoDe((v) => v || Math.min(...anos));
      setAnoAte((v) => v || Math.max(...anos));
    } catch (e: any) {
      console.error("Erro ao carregar os Demonstrativos:", e);
      setErro(e?.message || "Não foi possível carregar os Demonstrativos.");
    } finally {
      setCarregando(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user) carregar();
  }, [user, carregar]);

  const anosDisponiveis = useMemo(() => (resultado ? [...new Set(resultado.meses.map(anoDe))] : []), [resultado]);

  /** Locais que entram no filtro (um Local, ou todos do regime escolhido). */
  const locaisFiltrados = useMemo(
    () => (resultado ? filtrarLocais(resultado.locais, localId, regime) : []),
    [resultado, localId, regime],
  );
  const mesesFiltrados = useMemo(() => consolidar(locaisFiltrados), [locaisFiltrados]);

  const periodos: Periodo[] = useMemo(() => {
    if (visao === "mensal") return mesesFiltrados.filter((m) => anoDe(m.chave) === anoMensal);
    return anualizar(mesesFiltrados).filter((a) => Number(a.chave) >= anoDe_ && Number(a.chave) <= anoAte);
  }, [visao, mesesFiltrados, anoMensal, anoDe_, anoAte]);

  /** Período inteiro escolhido, para o Resumo e o "Por Prédio". */
  const mesesDoIntervalo = (lista: Periodo[]) =>
    visao === "mensal"
      ? lista.filter((m) => anoDe(m.chave) === anoMensal && (!mesResumo || Number(m.chave.slice(5)) === mesResumo))
      : lista.filter((m) => anoDe(m.chave) >= anoDe_ && anoDe(m.chave) <= anoAte);
  const aa = String(anoMensal).slice(2);
  const textoPeriodo = visao === "anual"
    ? `${anoDe_} a ${anoAte}`
    : mesResumo ? fmtPeriodo(`${anoMensal}-${String(mesResumo).padStart(2, "0")}`) : `jan-${aa} a dez-${aa}`;
  const total = useMemo(() => {
    const lista = mesesDoIntervalo(mesesFiltrados);
    return lista.length ? juntarPeriodos(lista, textoPeriodo) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesFiltrados, visao, anoMensal, mesResumo, anoDe_, anoAte]);
  const balancoFechadoEmTudo = mesesFiltrados.every((m) => Math.abs(m.balanco.diferenca) < 0.01);

  const nomeDoLocal = localId === "todos"
    ? `Todos – Consolidado${regime !== "todos" ? ` (${NOME_DO_REGIME[regime]})` : ""}`
    : dados?.locais.find((l) => l.id === localId)?.name || "-";

  async function exportar() {
    if (!resultado || !dados) return;
    setExportando(true);
    try {
      const { exportarDemonstrativosExcel } = await import("@/lib/demonstrativos/excel");
      await exportarDemonstrativosExcel({
        dados, locais: locaisFiltrados, visao, periodos, nomeDoLocal, textoPeriodo,
        logoUrl: "/contrato-logo.png",
      });
    } catch (e: any) {
      console.error(e);
      showAlert({ title: "Erro", description: "Não foi possível gerar o Excel.", type: "error" });
    } finally {
      setExportando(false);
    }
  }

  const resumo = total ? indicadoresDoResumo(total) : null;
  const linhasResumo: [string, string, string][] = resumo && total ? [
    ["Receita bruta", fmtR(resumo.receita), "resumo-receita"],
    ["Resultado operacional (NOI)", fmtR(resumo.noi), "resumo-noi"],
    ["Margem NOI (sobre a receita líquida)", fmtPct(resumo.margemNoi), "resumo-margem"],
    ["Lucro líquido", fmtR(resumo.lucroLiquido), "resumo-lucro"],
    ["Caixa gerado no período", fmtR(resumo.caixaGerado), "resumo-caixa-gerado"],
    ["Ocupação média", fmtPct(resumo.ocupacao), "resumo-ocupacao"],
    ["Inadimplência (a receber ÷ receita do ano)", fmtPct(resumo.inadimplencia), "resumo-inadimplencia"],
    ["Yield sobre custo (NOI do ano ÷ investimento)", fmtPct(resumo.yieldSobreCusto), "resumo-yield"],
    ["Receita Bruta (recebido) -- igual ao Financeiro", fmtR(total.indicadores.recebidoFinanceiro), "resumo-recebido-financeiro"],
    ["Taxa de administração -- igual ao Financeiro", fmtR(-total.dre.taxaAdministracao), "resumo-taxa-adm"],
    ["Taxa de gerenciamento -- igual ao Financeiro", fmtR(-total.dre.taxaGerenciamento), "resumo-taxa-ger"],
    ["Contas do Mês -- igual ao Financeiro", fmtR(total.indicadores.contasDoMesFinanceiro), "resumo-contas"],
  ] : [];

  const porPredio = useMemo(() => {
    if (!resultado) return [];
    return filtrarLocais(resultado.locais, "todos", regime)
      .map((l) => {
        const lista = mesesDoIntervalo(l.meses);
        if (!lista.length) return null;
        const p = juntarPeriodos(lista, textoPeriodo);
        return { local: l, p, ind: indicadoresDoResumo(p) };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && (x.p.dre.receitaBruta !== 0 || x.p.balanco.totalAtivo !== 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, regime, visao, anoMensal, mesResumo, anoDe_, anoAte]);

  const thR: CSSProperties = { background: COR.bege, color: COR.vinhoEscuro, fontWeight: 700, padding: "3px 10px", borderTop: `1px solid ${COR.vinhoEscuro}`, borderBottom: `1px solid ${COR.vinhoEscuro}`, textAlign: "center" };
  const tdR: CSSProperties = { padding: "3px 10px", textAlign: "center", fontSize: 13, borderBottom: "1px solid #eee" };

  return (
    <Layout>
      <Head><title>Demonstrativos</title></Head>
      <div style={{ fontFamily: FONTE_CORPO, color: COR.texto, background: "#fff" }} className="p-4 rounded-md space-y-4" data-testid="pagina-demonstrativos">
        {/* Cabeçalho: logo à esquerda, Local e Período à direita */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/contrato-logo.png" alt="Logo" style={{ height: 56 }} />
          <div style={{ fontSize: 13, textAlign: "right" }}>
            <div><b>Local:</b> <span data-testid="cabecalho-local">{nomeDoLocal}</span></div>
            <div><b>Período:</b> <span data-testid="cabecalho-periodo">{textoPeriodo}</span></div>
          </div>
        </div>
        <h1 style={{ fontFamily: FONTE_TITULO, fontSize: 21, fontWeight: 700, color: COR.vinhoEscuro, margin: 0 }}>
          Demonstrativos
        </h1>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3" style={{ fontSize: 13 }}>
          <label className="flex flex-col gap-1"><b>Local</b>
            <select value={localId} onChange={(e) => setLocalId(e.target.value)} style={estiloSelect} data-testid="filtro-local">
              <option value="todos">Todos – Consolidado</option>
              {(dados?.locais || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><b>Proprietário</b>
            <select value={regime} onChange={(e) => setRegime(e.target.value as FiltroRegime)} style={estiloSelect} data-testid="filtro-regime">
              <option value="todos">Todos</option>
              <option value="holding">Holding</option>
              <option value="pf">Pessoa física</option>
            </select>
          </label>
          <label className="flex flex-col gap-1"><b>Visão</b>
            <select value={visao} onChange={(e) => setVisao(e.target.value as Visao)} style={estiloSelect} data-testid="filtro-visao">
              <option value="anual">Anual</option>
              <option value="mensal">Mensal</option>
            </select>
          </label>
          {visao === "mensal" ? (
            <label className="flex flex-col gap-1"><b>Ano</b>
              <select value={anoMensal} onChange={(e) => setAnoMensal(Number(e.target.value))} style={estiloSelect} data-testid="filtro-ano">
                {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          ) : null}
          {visao === "mensal" ? (
            <label className="flex flex-col gap-1"><b>Mês do Resumo</b>
              <select value={mesResumo} onChange={(e) => setMesResumo(Number(e.target.value))} style={estiloSelect} data-testid="filtro-mes-resumo">
                <option value={0}>Ano inteiro</option>
                {["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1"><b>De</b>
                <select value={anoDe_} onChange={(e) => setAnoDe(Number(e.target.value))} style={estiloSelect} data-testid="filtro-ano-de">
                  {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><b>Até</b>
                <select value={anoAte} onChange={(e) => setAnoAte(Number(e.target.value))} style={estiloSelect} data-testid="filtro-ano-ate">
                  {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </>
          )}
          <Button onClick={exportar} disabled={exportando || carregando || !resultado} data-testid="exportar-excel"
            style={{ background: COR.vinhoEscuro, color: "#fff" }}>
            {exportando ? "Gerando..." : "Exportar para Excel"}
          </Button>
        </div>
        <p style={{ fontSize: 12 }}>
          <b>A</b> = realizado (até {resultado ? fmtPeriodo(resultado.mesAtual) : "-"}) · <b>P</b> = projetado · <b>A+P</b> = ano com os dois.
        </p>

        {carregando && <p data-testid="demonstrativos-carregando">Carregando os demonstrativos...</p>}
        {erro && <p style={{ color: "#b00020" }} data-testid="demonstrativos-erro">{erro}</p>}

        {!carregando && !erro && resultado && dados && (
          <Tabs value={aba} onValueChange={setAba}>
            <TabsList className="flex-wrap h-auto">
              {Object.entries(NOMES_DAS_ABAS).map(([k, v]) => (
                <TabsTrigger key={k} value={k} data-testid={`aba-${k}`}>{v}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="resumo">
              <FaixaDoBloco nome="Resumo" />
              <table style={{ borderCollapse: "collapse", marginTop: 8 }} data-testid="tabela-resumo">
                <thead>
                  <tr><th style={{ ...thR, textAlign: "left", minWidth: 340 }}>Indicador</th><th style={{ ...thR, minWidth: 140 }}>Valor</th></tr>
                </thead>
                <tbody>
                  {linhasResumo.map(([rot, val, id]) => (
                    <tr key={id}>
                      <td style={{ ...tdR, textAlign: "left" }}>{rot}</td>
                      <td style={tdR} data-testid={id}>{val}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...tdR, textAlign: "left", fontWeight: 700 }}>Status do balanço</td>
                    <td style={{ ...tdR, fontWeight: 700, color: balancoFechadoEmTudo ? COR.vinculo : "#fff", background: balancoFechadoEmTudo ? undefined : "#c62828" }}
                      data-testid="resumo-status-balanco">
                      {balancoFechadoEmTudo ? "Balanço fechado ✓" : "⚠ Balanço NÃO fecha"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="dre">
              <TabelaDemonstrativo titulo="Demonstração do Resultado (DRE)" linhas={linhasDRE(periodos)} periodos={periodos}
                linhaDoTempo={visao === "mensal"} testId="tabela-dre" />
            </TabsContent>
            <TabsContent value="balanco">
              <TabelaDemonstrativo titulo="Balanço Patrimonial" linhas={linhasBalanco()} periodos={periodos}
                linhaDoTempo={visao === "mensal"} testId="tabela-balanco" />
            </TabsContent>
            <TabsContent value="dfc">
              <TabelaDemonstrativo titulo="Demonstração do Fluxo de Caixa (método indireto)" linhas={linhasDFC()} periodos={periodos}
                linhaDoTempo={visao === "mensal"} testId="tabela-dfc" />
            </TabsContent>

            <TabsContent value="predios">
              <FaixaDoBloco nome="Por Prédio" />
              <div className="overflow-x-auto">
                <table style={{ borderCollapse: "collapse", marginTop: 8 }} data-testid="tabela-por-predio">
                  <thead>
                    <tr>
                      {["Local", "Proprietário", "Receita", "NOI", "Margem NOI", "Ocupação", "Yield s/ custo"].map((c, i) => (
                        <th key={c} style={{ ...thR, textAlign: i === 0 ? "left" : "center", minWidth: i === 0 ? 260 : 110 }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porPredio.map(({ local, p, ind }) => (
                      <tr key={local.localId} data-testid={`predio-${local.nome}`}>
                        <td style={{ ...tdR, textAlign: "left", borderLeft: `1px solid ${COR.vinhoEscuro}` }}>{local.nome}</td>
                        <td style={tdR}>{NOME_DO_REGIME[local.regime]}</td>
                        <td style={tdR}>{fmtR(p.dre.receitaBruta)}</td>
                        <td style={tdR}>{fmtR(p.dre.noi)}</td>
                        <td style={tdR}>{fmtPct(ind.margemNoi)}</td>
                        <td style={tdR}>{fmtPct(ind.ocupacao)}</td>
                        <td style={tdR}>{fmtPct(ind.yieldSobreCusto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="premissas">
              <FaixaDoBloco nome="Premissas" />
              <div className="mt-3">
                <AbaPremissas
                  premissas={{ ...dados.premissas, id: premissasId }}
                  locais={dados.locais}
                  patrimonios={patrimonios}
                  financiamentos={financiamentos}
                  onSalvo={carregar}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
