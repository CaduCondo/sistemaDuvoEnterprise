import type { CSSProperties } from "react";
import type { Periodo } from "@/lib/demonstrativos/tipos";
import { diferencaEmMeses } from "@/lib/demonstrativos/datas";
import { COR, FONTE_CORPO, fmtPct, fmtPeriodo, fmtR } from "./estilo";

/**
 * Tabela de um demonstrativo (DRE, Balanço, DFC) no padrão visual do #128:
 * grupo = linha bege com texto vinho; detalhe = sem preenchimento;
 * total = bege, negrito, borda vinho em cima e embaixo. Ao lado de cada
 * coluna R$ vai uma coluna "%" (análise vertical sobre a receita bruta).
 */

export type TipoDeLinha = "grupo" | "detalhe" | "total";

export interface LinhaDaTabela {
  rotulo: string;
  tipo: TipoDeLinha;
  valor?: (p: Periodo) => number;
  /** Mostra a coluna %. Padrão: sim, exceto nos grupos. */
  comPercentual?: boolean;
  testId?: string;
}

const borda = `1px solid ${COR.vinhoEscuro}`;

export function TabelaDemonstrativo({
  titulo, linhas, periodos, linhaDoTempo, mesBase, testId,
}: {
  titulo: string;
  linhas: LinhaDaTabela[];
  periodos: Periodo[];
  /** Série mensal: mostra a faixa "Linha do tempo", o índice e as datas. */
  linhaDoTempo?: boolean;
  /** Mês de abertura ("AAAA-MM"): o índice do período conta a partir dele. */
  mesBase?: string;
  testId?: string;
}) {
  const base = (p: Periodo) => p.dre.receitaBruta;
  const celula: CSSProperties = { padding: "2px 6px", textAlign: "center", fontSize: 13, whiteSpace: "nowrap", minWidth: 90 };
  const rotulo: CSSProperties = {
    padding: "2px 8px", fontSize: 13, minWidth: 300, position: "sticky", left: 0, zIndex: 1, textAlign: "left",
  };
  const colunas = periodos.length * 2;

  return (
    <div className="overflow-x-auto" data-testid={testId} style={{ fontFamily: FONTE_CORPO, color: COR.texto }}>
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr>
            <th
              colSpan={colunas + 1}
              style={{ background: COR.vinhoEscuro, color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "left", padding: "4px 8px" }}
            >
              {linhaDoTempo ? "Linha do tempo" : titulo}
            </th>
          </tr>
          {linhaDoTempo && (
            <tr style={{ background: COR.bege, color: COR.vinhoEscuro, fontWeight: 700 }}>
              <th style={{ ...rotulo, background: COR.bege }}>Período</th>
              {periodos.map((p, i) => (
                <th key={p.chave} colSpan={2} style={{ ...celula, borderLeft: borda }}>
                  {mesBase ? diferencaEmMeses(mesBase, p.chave) : i}
                </th>
              ))}
            </tr>
          )}
          <tr style={{ background: COR.bege, color: COR.vinhoEscuro, fontWeight: 700, borderTop: borda, borderBottom: borda }}>
            <th style={{ ...rotulo, background: COR.bege }}>{linhaDoTempo ? titulo : "R$"}</th>
            {periodos.map((p) => (
              <th key={p.chave} colSpan={2} style={{ ...celula, borderLeft: borda }}>
                <span style={{ color: linhaDoTempo ? COR.vinculo : COR.vinhoEscuro }}>{fmtPeriodo(p.chave)}</span>{" "}
                <span
                  data-testid={`tipo-${p.chave}`}
                  title={p.tipo === "A" ? "Realizado" : p.tipo === "P" ? "Projetado" : "Realizado + projetado"}
                  style={{
                    fontSize: 11, padding: "0 4px", borderRadius: 3, marginLeft: 2,
                    background: p.tipo === "A" ? COR.vinhoEscuro : "#fff",
                    color: p.tipo === "A" ? "#fff" : COR.vinhoEscuro,
                    border: `1px ${p.tipo === "A" ? "solid" : "dashed"} ${COR.vinhoEscuro}`,
                  }}
                >
                  {p.tipo}
                </span>
              </th>
            ))}
          </tr>
          <tr style={{ background: COR.bege, color: COR.vinhoEscuro, fontWeight: 700, fontSize: 12 }}>
            <th style={{ ...rotulo, background: COR.bege }} />
            {periodos.map((p) => [
              <th key={`${p.chave}-r`} style={{ ...celula, borderLeft: borda }}>R$</th>,
              <th key={`${p.chave}-p`} style={celula}>%</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const destaque = l.tipo !== "detalhe";
            const estiloLinha: CSSProperties = destaque
              ? { background: COR.bege, color: COR.vinhoEscuro, fontWeight: 700, borderTop: borda, borderBottom: borda }
              : {};
            const fundoRotulo = destaque ? COR.bege : "#fff";
            const mostrarPct = l.comPercentual ?? l.tipo !== "grupo";
            return (
              <tr key={i} style={estiloLinha} data-testid={l.testId}>
                <td style={{ ...rotulo, background: fundoRotulo, paddingLeft: l.tipo === "detalhe" ? 20 : 8 }}>{l.rotulo}</td>
                {periodos.map((p) => {
                  const v = l.valor ? l.valor(p) : null;
                  return [
                    <td key={`${p.chave}-r`} style={{ ...celula, borderLeft: borda }} data-periodo={p.chave}>
                      {v == null ? "" : fmtR(v)}
                    </td>,
                    <td key={`${p.chave}-p`} style={{ ...celula, minWidth: 56, fontSize: 12 }}>
                      {v == null || !mostrarPct ? "" : fmtPct(base(p) ? v / base(p) : 0)}
                    </td>,
                  ];
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
