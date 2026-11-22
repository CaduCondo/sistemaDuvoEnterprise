import { supabase } from "@/integrations/supabase/client";
import { calcularDemonstrativos, type ResultadoDosDemonstrativos } from "@/lib/demonstrativos/motor";
import type {
  DadosDoMotor, FinanciamentoBruto, PatrimonioBruto, Premissas, Regime,
} from "@/lib/demonstrativos/tipos";
import { mesDe } from "@/lib/demonstrativos/datas";

/**
 * Leitura do banco para a página Demonstrativos (#128). As contas ficam em
 * src/lib/demonstrativos (funções puras); aqui só se busca e se grava.
 */

const db = supabase as any;

/** O Supabase devolve no máximo 1.000 linhas por vez: busca página a página. */
async function buscarTudo(montar: () => any, tamanho = 1000): Promise<any[]> {
  const linhas: any[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar().range(de, de + tamanho - 1);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < tamanho) break;
  }
  return linhas;
}

export async function carregarPremissas(): Promise<Premissas & { id: string }> {
  const { data, error } = await db.from("demonstrativos_premissas").select("*").eq("singleton", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Premissas dos Demonstrativos não encontradas (rodar a migração 20261122120000).");
  return {
    ...data,
    opening_cash: Number(data.opening_cash) || 0,
    owner_distribution_pct: Number(data.owner_distribution_pct) || 0,
    projected_vacancy_pct: Number(data.projected_vacancy_pct) || 0,
    projected_default_pct: Number(data.projected_default_pct) || 0,
  };
}

export async function salvarPremissas(id: string, campos: Partial<Premissas>) {
  const { error } = await db.from("demonstrativos_premissas").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export interface PatrimonioDoLocal extends PatrimonioBruto { id?: string; notes?: string | null }

export async function carregarPatrimonios(): Promise<PatrimonioDoLocal[]> {
  const { data, error } = await db.from("location_assets").select("*");
  if (error) throw error;
  return (data || []).map((p: any) => ({
    ...p,
    land_value: Number(p.land_value) || 0,
    building_value: Number(p.building_value) || 0,
    building_useful_life_years: Number(p.building_useful_life_years) || 25,
  }));
}

export async function salvarPatrimonio(p: PatrimonioDoLocal) {
  const { id, ...campos } = p as any;
  const { error } = await db
    .from("location_assets")
    .upsert({ ...campos, updated_at: new Date().toISOString() }, { onConflict: "location_id" });
  if (error) throw error;
}

export interface FinanciamentoDoLocal extends FinanciamentoBruto { id?: string; description?: string; notes?: string | null }

export async function carregarFinanciamentos(): Promise<FinanciamentoDoLocal[]> {
  const { data, error } = await db.from("location_financings").select("*").order("start_date");
  if (error) throw error;
  return (data || []).map((f: any) => ({
    ...f,
    principal: Number(f.principal) || 0,
    annual_rate_pct: Number(f.annual_rate_pct) || 0,
  }));
}

export async function salvarFinanciamento(f: FinanciamentoDoLocal) {
  const { id, ...campos } = f as any;
  const consulta = id
    ? db.from("location_financings").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id)
    : db.from("location_financings").insert(campos);
  const { error } = await consulta;
  if (error) throw error;
}

export async function apagarFinanciamento(id: string) {
  const { error } = await db.from("location_financings").delete().eq("id", id);
  if (error) throw error;
}

/** Último mês realizado = o mês de hoje. */
export function mesDeHoje(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export interface OpcoesDeCarga {
  /** Perfil financeiro: só os Locais permitidos a ele. Vazio = todos. */
  locaisPermitidos?: string[];
  hoje?: Date;
}

export async function carregarDadosDoMotor(opcoes: OpcoesDeCarga = {}): Promise<DadosDoMotor> {
  const premissas = await carregarPremissas();
  const anoBase = Number((mesDe(premissas.base_date) ?? "2026-01").slice(0, 4));

  const [locais, imoveis, locacoes, recebimentos, caucoes, despesas, acordos, patrimonios, financiamentos, config, isAdm, isGer] =
    await Promise.all([
      buscarTudo(() => db.from("locations").select("id, name, is_active").order("name")),
      buscarTudo(() => db.from("properties").select("id, location_id")),
      buscarTudo(() => db.from("rentals").select(
        "id, property_id, status, start_date, end_date, rent_value, garage_value, has_garage, properties!rentals_property_id_fkey(location_id)",
      )),
      // Recebimentos de anos anteriores à base também vêm: rescisões e
      // cauções antigas mexem no passivo de abertura.
      buscarTudo(() => db.from("payments").select(
        "id, rental_id, payment_kind, status, expected_amount, paid_amount, reference_month, reference_year, due_date, " +
        "payment_date, discount_amount, late_fee, interest, late_fee_waived, interest_waived, breakdown, partial_payments, " +
        "termination_corrected_deposit, rentals!payments_rental_id_fkey(properties!rentals_property_id_fkey(location_id))",
      ).order("id")),
      buscarTudo(() => db.from("deposit_installments").select(
        "rental_id, status, amount, paid_amount, payment_date, due_date, pix_code, rentals!deposit_installments_rental_id_fkey(properties!rentals_property_id_fkey(location_id))",
      ).order("id")),
      buscarTudo(() => db.from("location_expenses")
        .select("location_id, amount, expense_type, reference_month, reference_year, is_capex")
        .gte("reference_year", anoBase).order("id")),
      buscarTudo(() => db.from("payment_agreements").select(
        "rental_id, agreement_date, status, deposit_returned, rentals!payment_agreements_rental_id_fkey(properties!rentals_property_id_fkey(location_id))",
      )),
      carregarPatrimonios(),
      carregarFinanciamentos(),
      db.from("configs").select("admin_fee_percentage, management_fee_percentage").maybeSingle(),
      db.from("admin_fee_exempt_locations").select("location_id"),
      db.from("management_fee_exempt_locations").select("location_id"),
    ]);

  const localDe = (x: any) => x?.properties?.location_id ?? x?.rentals?.properties?.location_id ?? null;
  const permitido = (id: string | null) =>
    !!id && (!opcoes.locaisPermitidos || opcoes.locaisPermitidos.length === 0 || opcoes.locaisPermitidos.includes(id));

  const unidades = new Map<string, number>();
  for (const i of imoveis) unidades.set(i.location_id, (unidades.get(i.location_id) || 0) + 1);

  return {
    locais: locais
      .filter((l) => l.is_active !== false && permitido(l.id))
      .map((l) => ({ id: l.id, name: l.name, unidades: unidades.get(l.id) || 0 })),
    locacoes: locacoes
      .map((l) => ({ ...l, location_id: localDe(l), rent_value: Number(l.rent_value) || 0, garage_value: Number(l.garage_value) || 0 }))
      .filter((l) => permitido(l.location_id)),
    recebimentos: recebimentos
      .map((r) => ({ ...r, location_id: localDe(r.rentals), expected_amount: Number(r.expected_amount) || 0 }))
      .filter((r) => permitido(r.location_id)),
    caucoes: caucoes
      .map((c) => ({ ...c, location_id: localDe(c.rentals), amount: Number(c.amount) || 0 }))
      .filter((c) => permitido(c.location_id)),
    despesas: despesas.filter((d) => permitido(d.location_id)).map((d) => ({ ...d, amount: Number(d.amount) || 0 })),
    acordos: acordos.map((a) => ({ ...a, location_id: localDe(a.rentals) })).filter((a) => permitido(a.location_id)),
    patrimonios: patrimonios.filter((p) => permitido(p.location_id)),
    financiamentos: financiamentos.filter((f) => permitido(f.location_id)),
    premissas,
    config: {
      percentualTaxaAdm: config.data?.admin_fee_percentage,
      percentualTaxaGer: config.data?.management_fee_percentage,
      locaisIsentosAdm: (isAdm.data || []).map((e: any) => e.location_id),
      locaisIsentosGer: (isGer.data || []).map((e: any) => e.location_id),
    },
    mesAtual: mesDeHoje(opcoes.hoje),
  };
}

export async function carregarDemonstrativos(opcoes: OpcoesDeCarga = {}): Promise<{
  dados: DadosDoMotor;
  resultado: ResultadoDosDemonstrativos;
}> {
  const dados = await carregarDadosDoMotor(opcoes);
  return { dados, resultado: calcularDemonstrativos(dados) };
}

export const NOME_DO_REGIME: Record<Regime, string> = { pf: "Pessoa física", holding: "Holding" };
