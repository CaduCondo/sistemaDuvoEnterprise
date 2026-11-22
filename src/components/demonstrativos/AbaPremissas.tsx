import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAlert } from "@/contexts/AlertContext";
import type { LocalBruto, ParametrosImpostos, Premissas } from "@/lib/demonstrativos/tipos";
import { taxaMensal } from "@/lib/demonstrativos/datas";
import {
  apagarFinanciamento, salvarFinanciamento, salvarPatrimonio, salvarPremissas,
  type FinanciamentoDoLocal, type PatrimonioDoLocal,
} from "@/services/demonstrativosService";
import { COR, FONTE_CORPO, FONTE_TITULO, fmtPct } from "./estilo";

/**
 * Aba Premissas (#128): tudo que o motor usa e o sistema não tinha.
 * Padrão visual: rótulo em vinho com texto branco + campo com borda
 * tracejada taupe, fundo bege claro e número azul (input digitado).
 */

const estiloRotulo: CSSProperties = {
  background: COR.vinho, color: "#fff", fontWeight: 700, fontSize: 13, padding: "4px 8px",
  fontFamily: '"Aptos", "Segoe UI", sans-serif', minWidth: 230,
};
const estiloCampo: CSSProperties = {
  border: `1px dashed ${COR.taupe}`, background: COR.begeClaro, color: COR.input, textAlign: "center",
  fontSize: 15, fontFamily: FONTE_CORPO, padding: "3px 6px", width: 150,
};

function Barra() {
  return <div style={{ height: 2, background: COR.vinho, margin: "18px 0 6px" }} />;
}
function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 16, fontWeight: 700, color: COR.dourado, margin: "4px 0 10px" }}>{children}</h3>;
}

function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 4 }}>
      <div style={estiloRotulo}>{rotulo}</div>
      {children}
    </div>
  );
}

function CampoNumero({ valor, onChange, testId, passo = "0.01", largura }: {
  valor: number | string; onChange: (v: number) => void; testId?: string; passo?: string; largura?: number;
}) {
  return (
    <input
      type="number"
      step={passo}
      value={valor}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      style={{ ...estiloCampo, width: largura ?? estiloCampo.width }}
    />
  );
}

function TabelaPorAno({ titulo, anos, valores, onChange, testId }: {
  titulo: string; anos: number[]; valores: Record<string, number>; onChange: (ano: number, v: number) => void; testId?: string;
}) {
  const cab: CSSProperties = { background: COR.begeEscuro, color: COR.vinhoEscuro, fontWeight: 700, padding: "3px 8px", border: `1px solid ${COR.taupe}` };
  const cel: CSSProperties = { border: `1px solid ${COR.taupe}`, textAlign: "center", padding: 2 };
  return (
    <table style={{ borderCollapse: "collapse", fontFamily: FONTE_CORPO, fontSize: 13, marginBottom: 10 }} data-testid={testId}>
      <thead>
        <tr>
          <th style={{ ...cab, textAlign: "left", minWidth: 230 }}>{titulo}</th>
          {anos.map((a) => <th key={a} style={cab}>{a}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ ...estiloRotulo, minWidth: 0 }}>% a.a.</td>
          {anos.map((a) => (
            <td key={a} style={cel}>
              <CampoNumero valor={valores[String(a)] ?? 0} onChange={(v) => onChange(a, v)} largura={70} />
            </td>
          ))}
        </tr>
        <tr>
          <td style={{ ...estiloRotulo, minWidth: 0 }}>% a.m.</td>
          {anos.map((a) => (
            <td key={a} style={{ ...cel, color: COR.formula }}>
              {fmtPct(taxaMensal(Number(valores[String(a)] ?? 0)))}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function AbaPremissas({
  premissas, locais, patrimonios, financiamentos, onSalvo,
}: {
  premissas: Premissas & { id: string };
  locais: LocalBruto[];
  patrimonios: PatrimonioDoLocal[];
  financiamentos: FinanciamentoDoLocal[];
  onSalvo: () => void;
}) {
  const { showAlert } = useAlert();
  const [p, setP] = useState(premissas);
  const [pats, setPats] = useState<Record<string, PatrimonioDoLocal>>({});
  const [novoFin, setNovoFin] = useState<FinanciamentoDoLocal | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setP(premissas), [premissas]);
  useEffect(() => {
    const mapa: Record<string, PatrimonioDoLocal> = {};
    for (const l of locais) {
      mapa[l.id] = patrimonios.find((x) => x.location_id === l.id) || {
        location_id: l.id, owner_regime: "pf", acquisition_date: null, land_value: 0, building_value: 0, building_useful_life_years: 25,
      };
    }
    setPats(mapa);
  }, [locais, patrimonios]);

  const anoBase = Number(String(p.base_date).slice(0, 4));
  const anos = Array.from({ length: Math.max(1, p.projection_years) + 1 + Math.max(0, new Date().getFullYear() - anoBase) }, (_, i) => anoBase + i);
  const tp: ParametrosImpostos = p.tax_params;
  const setTax = (grupo: keyof ParametrosImpostos, campo: string, v: unknown) =>
    setP({ ...p, tax_params: { ...tp, [grupo]: { ...(tp as any)[grupo], [campo]: v } } });

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setSalvando(true);
    try {
      await acao();
      showAlert({ title: "Sucesso", description: mensagem, type: "success" });
      onSalvo();
    } catch (e: any) {
      showAlert({ title: "Erro", description: e?.message || "Não foi possível salvar.", type: "error" });
    } finally {
      setSalvando(false);
    }
  }

  const salvarGerais = () =>
    executar(() => salvarPremissas(p.id, {
      base_date: p.base_date, opening_cash: p.opening_cash, owner_distribution_pct: p.owner_distribution_pct,
      projected_vacancy_pct: p.projected_vacancy_pct, projected_default_pct: p.projected_default_pct,
      projection_years: p.projection_years, rent_index_by_year: p.rent_index_by_year,
      expense_index_by_year: p.expense_index_by_year, tax_params: p.tax_params,
    }), "Premissas salvas.");

  const nomeLocal = (id: string) => locais.find((l) => l.id === id)?.name || "-";
  const th: CSSProperties = { background: COR.bege, color: COR.vinhoEscuro, fontWeight: 700, padding: "3px 8px", borderTop: `1px solid ${COR.vinhoEscuro}`, borderBottom: `1px solid ${COR.vinhoEscuro}` };
  const td: CSSProperties = { padding: 3, borderBottom: `1px solid ${COR.taupe}`, textAlign: "center" };

  return (
    <div style={{ fontFamily: FONTE_CORPO, color: COR.texto }} data-testid="aba-premissas">
      <Subtitulo>Premissas gerais</Subtitulo>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", columnGap: 32 }}>
        <div>
          <Par rotulo="Mês de abertura do Balanço">
            <input type="month" value={String(p.base_date).slice(0, 7)} data-testid="premissa-base"
              onChange={(e) => setP({ ...p, base_date: `${e.target.value}-01` })} style={estiloCampo} />
          </Par>
          <Par rotulo="Caixa inicial da carteira (R$)">
            <CampoNumero valor={p.opening_cash} onChange={(v) => setP({ ...p, opening_cash: v })} testId="premissa-caixa" />
          </Par>
          <Par rotulo="Repasse ao proprietário (% do caixa)">
            <CampoNumero valor={p.owner_distribution_pct} onChange={(v) => setP({ ...p, owner_distribution_pct: v })} testId="premissa-repasse" />
          </Par>
        </div>
        <div>
          <Par rotulo="Vacância projetada (%)">
            <CampoNumero valor={p.projected_vacancy_pct} onChange={(v) => setP({ ...p, projected_vacancy_pct: v })} testId="premissa-vacancia" />
          </Par>
          <Par rotulo="Inadimplência projetada (%)">
            <CampoNumero valor={p.projected_default_pct} onChange={(v) => setP({ ...p, projected_default_pct: v })} testId="premissa-inadimplencia" />
          </Par>
          <Par rotulo="Anos de projeção">
            <CampoNumero valor={p.projection_years} passo="1" onChange={(v) => setP({ ...p, projection_years: Math.min(10, Math.max(1, Math.round(v))) })} />
          </Par>
        </div>
      </div>

      <Barra />
      <Subtitulo>Índices por ano</Subtitulo>
      <TabelaPorAno titulo="Reajuste dos aluguéis" anos={anos} valores={p.rent_index_by_year} testId="tabela-indice-aluguel"
        onChange={(a, v) => setP({ ...p, rent_index_by_year: { ...p.rent_index_by_year, [a]: v } })} />
      <TabelaPorAno titulo="Reajuste das despesas" anos={anos} valores={p.expense_index_by_year}
        onChange={(a, v) => setP({ ...p, expense_index_by_year: { ...p.expense_index_by_year, [a]: v } })} />

      <Barra />
      <Subtitulo>Impostos (editáveis -- confirmar com o contador)</Subtitulo>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", columnGap: 32 }}>
        <div>
          <p style={{ fontWeight: 700, color: COR.vinhoEscuro, margin: "4px 0" }}>Holding -- lucro presumido</p>
          <Par rotulo="Presunção do lucro (%)"><CampoNumero valor={tp.holding.presuncao_pct} onChange={(v) => setTax("holding", "presuncao_pct", v)} /></Par>
          <Par rotulo="IRPJ (%)"><CampoNumero valor={tp.holding.irpj_pct} onChange={(v) => setTax("holding", "irpj_pct", v)} /></Par>
          <Par rotulo="Adicional de IRPJ (%)"><CampoNumero valor={tp.holding.irpj_adicional_pct} onChange={(v) => setTax("holding", "irpj_adicional_pct", v)} /></Par>
          <Par rotulo="Limite do adicional (R$/mês)"><CampoNumero valor={tp.holding.irpj_adicional_limite_mensal} onChange={(v) => setTax("holding", "irpj_adicional_limite_mensal", v)} /></Par>
          <Par rotulo="CSLL (%)"><CampoNumero valor={tp.holding.csll_pct} onChange={(v) => setTax("holding", "csll_pct", v)} /></Par>
          <Par rotulo="PIS (%)"><CampoNumero valor={tp.holding.pis_pct} onChange={(v) => setTax("holding", "pis_pct", v)} /></Par>
          <Par rotulo="COFINS (%)"><CampoNumero valor={tp.holding.cofins_pct} onChange={(v) => setTax("holding", "cofins_pct", v)} /></Par>
          <p style={{ fontWeight: 700, color: COR.vinhoEscuro, margin: "12px 0 4px" }}>Pessoa física -- carnê-leão</p>
          <Par rotulo="Desconto simplificado (R$/mês)"><CampoNumero valor={tp.pf.desconto_simplificado_mensal ?? 0} onChange={(v) => setTax("pf", "desconto_simplificado_mensal", v)} /></Par>
          <Par rotulo="Isento até (R$/mês, Lei 15.270)"><CampoNumero valor={tp.pf.redutor_ate} onChange={(v) => setTax("pf", "redutor_ate", v)} /></Par>
          <Par rotulo="Redução parcial até (R$/mês)"><CampoNumero valor={tp.pf.redutor_faixa_ate} onChange={(v) => setTax("pf", "redutor_faixa_ate", v)} /></Par>
        </div>
        <div>
          <p style={{ fontWeight: 700, color: COR.vinhoEscuro, margin: "4px 0" }}>Reforma tributária -- IBS e CBS</p>
          <Par rotulo="CBS de referência (%)"><CampoNumero valor={tp.ibs_cbs.cbs_referencia_pct} onChange={(v) => setTax("ibs_cbs", "cbs_referencia_pct", v)} /></Par>
          <Par rotulo="IBS de referência (%)"><CampoNumero valor={tp.ibs_cbs.ibs_referencia_pct} onChange={(v) => setTax("ibs_cbs", "ibs_referencia_pct", v)} /></Par>
          <Par rotulo="Redução da locação (%)"><CampoNumero valor={tp.ibs_cbs.reducao_locacao_pct} onChange={(v) => setTax("ibs_cbs", "reducao_locacao_pct", v)} /></Par>
          <Par rotulo="Redutor social (R$/unidade/mês)"><CampoNumero valor={tp.ibs_cbs.redutor_social_mensal_por_unidade} onChange={(v) => setTax("ibs_cbs", "redutor_social_mensal_por_unidade", v)} /></Par>
          <Par rotulo="PIS/COFINS até o ano"><CampoNumero valor={tp.ibs_cbs.pis_cofins_ate_ano} passo="1" onChange={(v) => setTax("ibs_cbs", "pis_cofins_ate_ano", v)} /></Par>
          <Par rotulo="PF paga IBS/CBS acima de (R$/ano)"><CampoNumero valor={tp.pf.ibs_cbs_limite_receita_anual} onChange={(v) => setTax("pf", "ibs_cbs_limite_receita_anual", v)} /></Par>
          <Par rotulo="... e mais de (imóveis)"><CampoNumero valor={tp.pf.ibs_cbs_limite_imoveis} passo="1" onChange={(v) => setTax("pf", "ibs_cbs_limite_imoveis", v)} /></Par>
        </div>
      </div>
      <TabelaPorAno titulo="Parcela da CBS cobrada (1 = 100%)" anos={anos} valores={tp.ibs_cbs.cbs_fator_por_ano}
        onChange={(a, v) => setTax("ibs_cbs", "cbs_fator_por_ano", { ...tp.ibs_cbs.cbs_fator_por_ano, [a]: v })} />
      <TabelaPorAno titulo="Parcela do IBS cobrada (1 = 100%)" anos={anos} valores={tp.ibs_cbs.ibs_fator_por_ano}
        onChange={(a, v) => setTax("ibs_cbs", "ibs_fator_por_ano", { ...tp.ibs_cbs.ibs_fator_por_ano, [a]: v })} />
      <Button onClick={salvarGerais} disabled={salvando} data-testid="salvar-premissas"
        style={{ background: COR.vinhoEscuro, color: "#fff" }}>
        {salvando ? "Salvando..." : "Salvar premissas"}
      </Button>

      <Barra />
      <Subtitulo>Patrimônio de cada Local</Subtitulo>
      <div className="overflow-x-auto">
        <table style={{ borderCollapse: "collapse", fontSize: 13 }} data-testid="tabela-patrimonio">
          <thead>
            <tr>
              {["Local", "Proprietário", "Aquisição", "Terreno (R$)", "Edificação (R$)", "Vida útil (anos)", ""].map((c) => (
                <th key={c} style={th}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locais.map((l) => {
              const x = pats[l.id];
              if (!x) return null;
              const mudar = (campo: keyof PatrimonioDoLocal, v: unknown) => setPats({ ...pats, [l.id]: { ...x, [campo]: v } });
              return (
                <tr key={l.id} data-testid={`patrimonio-${l.name}`}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{l.name}</td>
                  <td style={td}>
                    <select value={x.owner_regime} onChange={(e) => mudar("owner_regime", e.target.value)} style={{ ...estiloCampo, width: 130 }}>
                      <option value="pf">Pessoa física</option>
                      <option value="holding">Holding</option>
                    </select>
                  </td>
                  <td style={td}>
                    <input type="date" value={x.acquisition_date || ""} onChange={(e) => mudar("acquisition_date", e.target.value || null)} style={{ ...estiloCampo, width: 140 }} />
                  </td>
                  <td style={td}><CampoNumero valor={x.land_value} onChange={(v) => mudar("land_value", v)} largura={120} /></td>
                  <td style={td}><CampoNumero valor={x.building_value} onChange={(v) => mudar("building_value", v)} largura={120} /></td>
                  <td style={td}><CampoNumero valor={x.building_useful_life_years} onChange={(v) => mudar("building_useful_life_years", v)} largura={70} /></td>
                  <td style={td}>
                    <Button size="sm" variant="outline" disabled={salvando}
                      onClick={() => executar(() => salvarPatrimonio(x), `Patrimônio de ${l.name} salvo.`)}>Salvar</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Barra />
      <Subtitulo>Financiamentos</Subtitulo>
      <div className="overflow-x-auto">
        <table style={{ borderCollapse: "collapse", fontSize: 13 }} data-testid="tabela-financiamentos">
          <thead>
            <tr>
              {["Local", "Descrição", "Início", "Saldo inicial (R$)", "Juros (% a.a.)", "Prazo (meses)", "Sistema", ""].map((c) => (
                <th key={c} style={th}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {financiamentos.map((f) => (
              <tr key={f.id}>
                <td style={td}>{nomeLocal(f.location_id)}</td>
                <td style={td}>{f.description}</td>
                <td style={td}>{f.start_date}</td>
                <td style={{ ...td, color: COR.input }}>{f.principal.toLocaleString("pt-BR")}</td>
                <td style={{ ...td, color: COR.input }}>{f.annual_rate_pct}</td>
                <td style={{ ...td, color: COR.input }}>{f.term_months}</td>
                <td style={td}>{f.amortization_system}</td>
                <td style={td}>
                  <Button size="sm" variant="outline" disabled={salvando}
                    onClick={() => executar(() => apagarFinanciamento(f.id!), "Financiamento apagado.")}>Apagar</Button>
                </td>
              </tr>
            ))}
            {novoFin && (
              <tr>
                <td style={td}>
                  <select value={novoFin.location_id} onChange={(e) => setNovoFin({ ...novoFin, location_id: e.target.value })} style={{ ...estiloCampo, width: 150 }}>
                    {locais.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </td>
                <td style={td}>
                  <input value={novoFin.description || ""} onChange={(e) => setNovoFin({ ...novoFin, description: e.target.value })} style={{ ...estiloCampo, color: COR.texto, width: 160 }} />
                </td>
                <td style={td}>
                  <input type="date" value={novoFin.start_date} onChange={(e) => setNovoFin({ ...novoFin, start_date: e.target.value })} style={{ ...estiloCampo, width: 140 }} />
                </td>
                <td style={td}><CampoNumero valor={novoFin.principal} onChange={(v) => setNovoFin({ ...novoFin, principal: v })} largura={120} /></td>
                <td style={td}><CampoNumero valor={novoFin.annual_rate_pct} onChange={(v) => setNovoFin({ ...novoFin, annual_rate_pct: v })} largura={70} /></td>
                <td style={td}><CampoNumero valor={novoFin.term_months} passo="1" onChange={(v) => setNovoFin({ ...novoFin, term_months: Math.max(1, Math.round(v)) })} largura={70} /></td>
                <td style={td}>
                  <select value={novoFin.amortization_system} onChange={(e) => setNovoFin({ ...novoFin, amortization_system: e.target.value as "SAC" | "PRICE" })} style={{ ...estiloCampo, width: 90 }}>
                    <option value="SAC">SAC</option>
                    <option value="PRICE">Price</option>
                  </select>
                </td>
                <td style={td}>
                  <Button size="sm" disabled={salvando || !novoFin.start_date || novoFin.principal <= 0}
                    onClick={() => executar(async () => { await salvarFinanciamento(novoFin); setNovoFin(null); }, "Financiamento salvo.")}
                    style={{ background: COR.vinhoEscuro, color: "#fff" }}>Salvar</Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!novoFin && locais.length > 0 && (
        <Button variant="outline" className="mt-2" onClick={() => setNovoFin({
          location_id: locais[0].id, description: "Financiamento", start_date: "", principal: 0,
          annual_rate_pct: 0, term_months: 120, amortization_system: "SAC",
        })}>+ Novo financiamento</Button>
      )}
    </div>
  );
}
