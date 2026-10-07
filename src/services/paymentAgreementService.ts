import { supabase } from "@/integrations/supabase/client";
import { atualizarFimDeContrato } from "./contractEndService";
import {
  arred,
  baseDeAtrasoDoRecebimento,
  PRIMEIRO_VENCIMENTO_ACEITO,
  type ParcelaDoAcordo,
  type RecebimentoDoAcordo,
  type AtrasoCalculado,
} from "@/lib/paymentAgreement";

/**
 * Acordo de parcelamento do débito do inquilino (#119) — acesso ao banco.
 *
 * Criar e desfazer passam pelas funções do banco criar_acordo_parcelamento e
 * desfazer_acordo_parcelamento (migração 20261006120000): ou o acordo inteiro
 * é gravado (acordo + entrada + parcelas + originais "renegociados"), ou nada.
 */

const db = supabase as any;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface DadosDaLocacaoDoAcordo {
  rentalId: string;
  inquilino: string;
  imovel: string;
  multaPercentual: number;
  jurosDiarioPercentual: number;
  recebimentos: RecebimentoDoAcordo[];
}

function descreverRecebimento(p: any): string {
  const [ano, mes] = String(p.due_date || "").split("-");
  const mesAno = mes ? `${MESES[Number(mes) - 1]}/${ano}` : "";
  if ((p.payment_kind || "rent") === "termination") {
    return p.contract_end ? "Fim de Contrato (devolução do caução)" : "Recebimento de Rescisão (devolução do caução)";
  }
  if (p.termination_group_id) return `Aluguel proporcional + multa da rescisão (${mesAno})`;
  if (p.contract_end) return `Proporcional de fim de contrato (${mesAno})`;
  const parcela = p.installment && p.total_installments ? ` – parcela ${p.installment}/${p.total_installments}` : "";
  return `Aluguel ${mesAno}${parcela}`;
}

/** Recebimentos em aberto da locação que podem entrar num acordo. */
export async function carregarDebitoDaLocacao(rentalId: string): Promise<DadosDaLocacaoDoAcordo> {
  const [{ data: pagamentos, error: e1 }, { data: locacao, error: e2 }, { data: config }] = await Promise.all([
    db
      .from("payments")
      .select("*")
      .eq("rental_id", rentalId)
      .in("status", ["pending", "partial", "overdue"])
      .is("agreement_id", null)
      // Até 31/12/2025 o sistema não existia: esses registros nunca entram.
      .gte("due_date", PRIMEIRO_VENCIMENTO_ACEITO)
      .order("due_date", { ascending: true }),
    db
      .from("rentals")
      .select("id, tenants!rentals_tenant_id_fkey(name), properties!rentals_property_id_fkey(complement, locations!properties_location_id_fkey(name))")
      .eq("id", rentalId)
      .maybeSingle(),
    db.from("configs").select("late_fee_percentage, interest_rate_percentage").limit(1).maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const linhas = await atualizarFimDeContrato((pagamentos || []) as any[]);

  const recebimentos: RecebimentoDoAcordo[] = linhas.map((p: any) => {
    const tipo = (p.payment_kind || "rent") as RecebimentoDoAcordo["tipo"];
    const esperado = Number(p.expected_amount) || 0;
    const pago = Number(p.paid_amount) || 0;
    if (tipo === "termination") {
      // Caução corrigido (negativo) + Despesas Adicionais − Desconto, como
      // estão salvos (o caução do Fim de Contrato já vem recalculado acima).
      const caucao = arred(Number(p.termination_corrected_deposit) || 0);
      const despesas = arred(Number(p.termination_additional_expenses) || 0);
      const desconto = arred(Number(p.termination_discount) || 0);
      return {
        id: p.id,
        dueDate: p.due_date,
        descricao: descreverRecebimento(p),
        tipo,
        status: p.status,
        expectedAmount: arred(caucao + despesas + desconto),
        paidAmount: 0,
        saldo: arred(caucao + despesas + desconto),
        baseAtraso: 0,
        caucao,
        despesas,
        desconto,
      };
    }
    return {
      id: p.id,
      dueDate: p.due_date,
      descricao: descreverRecebimento(p),
      tipo,
      status: p.status,
      expectedAmount: arred(esperado),
      paidAmount: arred(pago),
      saldo: arred(esperado - pago),
      baseAtraso: baseDeAtrasoDoRecebimento(p.breakdown, esperado),
    };
  });

  return {
    rentalId,
    inquilino: locacao?.tenants?.name || "",
    imovel: [locacao?.properties?.locations?.name, locacao?.properties?.complement].filter(Boolean).join(" "),
    multaPercentual: Number(config?.late_fee_percentage) || 0,
    jurosDiarioPercentual: Number(config?.interest_rate_percentage) || 0,
    recebimentos,
  };
}

export async function criarAcordo(params: {
  rentalId: string;
  itens: RecebimentoDoAcordo[];
  atrasos: Record<string, AtrasoCalculado>;
  parcelas: ParcelaDoAcordo[];
  desconto: number;
  entrada: number;
  entradaData: string | null;
  dataAcordo: string;
  observacoes?: string;
}): Promise<string> {
  const { data, error } = await db.rpc("criar_acordo_parcelamento", {
    p_rental_id: params.rentalId,
    p_origens: params.itens.map((i) => ({
      id: i.id,
      saldo: i.saldo,
      multa: params.atrasos[i.id]?.multa || 0,
      juros: params.atrasos[i.id]?.juros || 0,
      ...(i.tipo === "termination" ? { caucao: i.caucao ?? 0 } : {}),
    })),
    p_parcelas: params.parcelas,
    p_desconto: params.desconto,
    p_entrada: params.entrada,
    p_entrada_data: params.entrada > 0 ? params.entradaData : null,
    p_data_acordo: params.dataAcordo,
    p_observacoes: params.observacoes || null,
  });
  if (error) throw new Error(error.message || "Não foi possível criar o acordo.");
  return data as string;
}

export async function desfazerAcordo(acordoId: string): Promise<void> {
  const { error } = await db.rpc("desfazer_acordo_parcelamento", { p_acordo_id: acordoId });
  if (error) throw new Error(error.message || "Não foi possível desfazer o acordo.");
}

export interface AcordoDetalhado {
  id: string;
  numero: number;
  status: "active" | "paid" | "undone";
  dataAcordo: string;
  totalOriginal: number;
  multaJuros: number;
  desconto: number;
  entrada: number;
  totalAcordado: number;
  parcelas: { id: string; descricao: string; vencimento: string; valor: number; status: string; pago: number }[];
  originais: { id: string; vencimento: string; valor: number; statusAnterior: string | null }[];
  podeDesfazer: boolean;
}

export async function buscarAcordo(acordoId: string): Promise<AcordoDetalhado | null> {
  const [{ data: acordo, error: e1 }, { data: parcelas }, { data: originais }] = await Promise.all([
    db.from("payment_agreements").select("*").eq("id", acordoId).maybeSingle(),
    db.from("payments").select("id, notes, due_date, expected_amount, status, paid_amount").eq("agreement_id", acordoId).order("due_date"),
    db
      .from("payments")
      .select("id, due_date, expected_amount, status_before_agreement")
      .eq("renegotiated_in_agreement_id", acordoId)
      .order("due_date"),
  ]);
  if (e1) throw e1;
  if (!acordo) return null;

  const listaParcelas = (parcelas || []).map((p: any) => ({
    id: p.id,
    descricao: p.notes || "",
    vencimento: p.due_date,
    valor: Number(p.expected_amount) || 0,
    status: p.status,
    pago: Number(p.paid_amount) || 0,
  }));

  return {
    id: acordo.id,
    numero: Number(acordo.agreement_number),
    status: acordo.status,
    dataAcordo: acordo.agreement_date,
    totalOriginal: Number(acordo.total_original) || 0,
    multaJuros: Number(acordo.late_fees) || 0,
    desconto: Number(acordo.discount) || 0,
    entrada: Number(acordo.down_payment) || 0,
    totalAcordado: Number(acordo.total_agreed) || 0,
    parcelas: listaParcelas,
    originais: (originais || []).map((o: any) => ({
      id: o.id,
      vencimento: o.due_date,
      valor: Number(o.expected_amount) || 0,
      statusAnterior: o.status_before_agreement,
    })),
    podeDesfazer:
      acordo.status === "active" &&
      listaParcelas.every((p: { status: string; pago: number }) => p.status !== "paid" && p.status !== "partial" && p.pago <= 0),
  };
}
