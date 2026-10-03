import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/types";
import { diasProporcionalFimContrato } from "@/lib/contractEnd";
import { calcularProporcionalAluguelEGaragem } from "@/lib/rentalCalculations";

/**
 * Service para gerenciar atualizações de recebimentos quando uma locação é editada
 * 
 * REGRA PRINCIPAL:
 * Quando startDate ou endDate são alterados, os recebimentos devem ser:
 * 1. Deletados se não fazem mais sentido (apenas pending/overdue)
 * 2. Criados se faltam para o novo período
 * 3. Ajustados se eram proporcionais e agora não são mais
 */

interface RentalUpdateChanges {
  startDate?: string;
  endDate?: string | null;
  monthlyRent?: number;
  paymentDay?: number;
  hasGarage?: boolean;
  garageValue?: number;
}


type LinhaRecebimento = Record<string, any>;

/** Busca os recebimentos de aluguel/fim de contrato de uma locação. */
async function buscarRecebimentos(rentalId: string): Promise<LinhaRecebimento[]> {
  const { data, error } = await (supabase as any)
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Apaga os recebimentos de FIM DE CONTRATO ainda não pagos (o proporcional
 * final e o recebimento de Fim de Contrato -- marcados `contract_end`). Usado
 * quando a data fim muda (renovação/edição) ou quando o contrato é rescindido:
 * eles deixam de valer para a data antiga. Os já pagos/parciais ficam
 * (são histórico) -- só aparece um aviso no log.
 */
export async function apagarFimDeContratoPendente(rentalId: string): Promise<number> {
  const existentes = await buscarRecebimentos(rentalId);
  const fimDeContrato = existentes.filter((p) => p.contract_end === true);
  const apagar = fimDeContrato.filter((p) => p.status === "pending" || p.status === "overdue");
  const mantidos = fimDeContrato.filter((p) => !apagar.includes(p));

  if (mantidos.length > 0) {
    console.warn(
      `⚠️ [fimDeContrato] ${mantidos.length} recebimento(s) de fim de contrato já pago(s)/parcial(is) foram mantidos (histórico):`,
      mantidos.map((p) => `${p.due_date} R$ ${p.expected_amount}`)
    );
  }

  if (apagar.length > 0) {
    const { error } = await supabase.from("payments").delete().in("id", apagar.map((p) => p.id));
    if (error) throw error;
    console.log(`🗑️ [fimDeContrato] ${apagar.length} recebimento(s) de fim de contrato pendente(s) apagado(s)`);
  }
  return apagar.length;
}

/** Reconta total_installments: só parcelas de aluguel contam. */
async function atualizarTotalDeParcelas(rentalId: string): Promise<void> {
  const existentes = await buscarRecebimentos(rentalId);
  const aluguel = existentes.filter((p) => (p.payment_kind || "rent") === "rent");
  if (aluguel.length === 0) return;
  const { error } = await (supabase as any)
    .from("payments")
    .update({ total_installments: aluguel.length })
    .eq("rental_id", rentalId)
    .or("payment_kind.is.null,payment_kind.eq.rent");
  if (error) throw error;
}

function valorCheio(monthlyRent: number, hasGarage: boolean, garageValue: number) {
  const garagem = hasGarage ? garageValue || 0 : 0;
  const breakdown: any[] = [{ description: "Aluguel", amount: monthlyRent, type: "addition" }];
  if (garagem > 0) breakdown.push({ description: "Garagem", amount: garagem, type: "addition" });
  return { total: parseFloat((monthlyRent + garagem).toFixed(2)), breakdown };
}

/**
 * RENOVAÇÃO DE CONTRATO -- regra do Cadu (03/out/2026).
 *
 * Renovar é só EMPURRAR O FIM DO CONTRATO para a frente. Por isso:
 *  1. As parcelas regulares que já existem NUNCA são apagadas nem mudam de
 *     mês -- pagas, pendentes ou atrasadas. (Bug de produção, JD. COLOMBO
 *     APTO 10: depois de renovar, setembro/2026 ficou sem a parcela de 05/09,
 *     que estava atrasada, e outubro ficou com duas.)
 *  2. O proporcional de fim de contrato e o recebimento de Fim de Contrato da
 *     data fim ANTIGA são apagados (se ainda não foram pagos) -- eles vão para
 *     a data fim nova.
 *  3. Contratos criados pela regra antiga terminavam com a última parcela
 *     regular PROPORCIONAL; renovando, ela passa a ser um mês normal, então
 *     volta para o valor cheio (só se ainda estiver pendente/atrasada).
 *  4. Cria as parcelas que faltam até a data fim nova, mais o proporcional e
 *     o Fim de Contrato da data nova.
 */
export async function renovarRecebimentos(params: {
  rentalId: string;
  startDate: string;
  oldEndDate: string;
  newEndDate: string;
  monthlyRent: number;
  paymentDay: number;
  hasGarage?: boolean;
  garageValue?: number;
}): Promise<void> {
  const { rentalId, startDate, oldEndDate, newEndDate, monthlyRent, paymentDay } = params;
  const hasGarage = !!params.hasGarage;
  const garageValue = params.garageValue || 0;
  console.log("🔁 [renovarRecebimentos]", { rentalId, oldEndDate, newEndDate });

  // 2. Fim de contrato antigo sai.
  await apagarFimDeContratoPendente(rentalId);

  // 3. Última parcela regular da regra antiga (proporcional) volta a cheia.
  const cheio = valorCheio(monthlyRent, hasGarage, garageValue);
  const mesDoFimAntigo = oldEndDate.slice(0, 7);
  const existentes = await buscarRecebimentos(rentalId);
  for (const p of existentes) {
    const ehRegular = (p.payment_kind || "rent") === "rent" && !p.contract_end;
    const pendente = p.status === "pending" || p.status === "overdue";
    const noMesDoFimAntigo = String(p.due_date || "").slice(0, 7) === mesDoFimAntigo;
    if (ehRegular && pendente && noMesDoFimAntigo && p.installment !== 1 &&
        p.due_date <= newEndDate && Number(p.expected_amount) < cheio.total - 0.01) {
      const { error } = await (supabase as any)
        .from("payments")
        .update({ expected_amount: cheio.total, breakdown: cheio.breakdown })
        .eq("id", p.id);
      if (error) throw error;
      console.log(`🔄 [renovarRecebimentos] Parcela ${p.installment} (${p.due_date}) voltou para o valor cheio`);
    }
  }

  // 4. Cria só o que falta até a data fim nova (nunca mexe no que existe).
  const { createPaymentsForRental } = await import("./paymentService");
  await createPaymentsForRental({
    rental: { id: rentalId } as Rental,
    startDate: new Date(startDate + "T00:00:00Z"),
    endDate: new Date(newEndDate + "T00:00:00Z"),
    monthlyRent,
    paymentDay,
    hasGarage,
    garageValue,
  });

  await atualizarTotalDeParcelas(rentalId);
  console.log("✅ [renovarRecebimentos] Concluído");
}

/**
 * FUNÇÃO PRINCIPAL: Sincroniza recebimentos quando datas da locação são
 * alteradas pela tela de EDIÇÃO da locação.
 *
 * ⚠️ Reescrita em 03/out/2026 (issue #108): a lista do que "deveria existir"
 * agora vem da MESMA função que cria os recebimentos de uma locação nova
 * (generateExpectedPayments) -- antes eram duas contas separadas, que já
 * divergiram mais de uma vez. Regras:
 *  - fim de contrato (proporcional final + Fim de Contrato) pendente é
 *    apagado e recriado para as datas novas;
 *  - parcela regular paga/parcial nunca é tocada;
 *  - parcela regular pendente/atrasada que deixou de caber no período é
 *    apagada; a que continua mas com valor diferente do esperado (ex.: deixou
 *    de ser a 1ª proporcional) é recalculada;
 *  - o que falta é criado.
 */
export async function syncPaymentsOnDateChange(
  rentalId: string,
  oldStartDate: string,
  oldEndDate: string | null,
  newStartDate: string,
  newEndDate: string | null,
  monthlyRent: number,
  paymentDay: number,
  hasGarage: boolean = false,
  garageValue: number = 0
): Promise<void> {
  console.log("🔄 [syncPaymentsOnDateChange] Iniciando sincronização...", {
    oldStartDate, oldEndDate, newStartDate, newEndDate,
  });

  if (oldStartDate === newStartDate && oldEndDate === newEndDate) {
    console.log("ℹ️ Nenhuma mudança nas datas");
    return;
  }

  const fim = newEndDate || (() => {
    const [a, m, d] = newStartDate.split("-").map(Number);
    return `${a + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  })();

  const { generateExpectedPayments, chaveDoRecebimento } = await import("./paymentService");
  const esperados = generateExpectedPayments({
    rentalId,
    startDate: newStartDate,
    endDate: fim,
    monthlyRent,
    paymentDay,
    hasGarage,
    garageValue,
  });
  const esperadosPorChave = new Map(esperados.map((e: any) => [chaveDoRecebimento(e), e]));

  // 1. Fim de contrato da data antiga sai (pendente).
  await apagarFimDeContratoPendente(rentalId);

  // 2. Parcelas regulares existentes.
  const existentes = (await buscarRecebimentos(rentalId)).filter(
    (p) => (p.payment_kind || "rent") === "rent" && !p.contract_end
  );
  const apagar: string[] = [];
  const chavesExistentes = new Set<string>();

  for (const p of existentes) {
    const chave = chaveDoRecebimento(p);
    if (p.status === "paid" || p.status === "partial") {
      chavesExistentes.add(chave);
      continue;
    }
    const esperado: any = esperadosPorChave.get(chave);
    if (!esperado || chavesExistentes.has(chave)) {
      apagar.push(p.id);
      console.log(`🗑️ Apagar parcela ${p.installment} (${p.due_date}) -- fora do período novo`);
      continue;
    }
    chavesExistentes.add(chave);
    if (Math.abs(Number(p.expected_amount) - Number(esperado.expected_amount)) > 0.01) {
      const { error } = await (supabase as any)
        .from("payments")
        .update({ expected_amount: esperado.expected_amount, breakdown: esperado.breakdown })
        .eq("id", p.id);
      if (error) throw error;
      console.log(`🔄 Parcela ${p.installment} (${p.due_date}): R$ ${p.expected_amount} → R$ ${esperado.expected_amount}`);
    }
  }

  if (apagar.length > 0) {
    const { error } = await supabase.from("payments").delete().in("id", apagar);
    if (error) throw error;
  }

  // 3. Cria o que falta (inclusive o fim de contrato da data nova).
  const numerosUsados = existentes
    .filter((p) => !apagar.includes(p.id))
    .map((p) => Number(p.installment) || 0);
  let proximoNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) + 1 : 1;

  const criar = esperados
    .filter((e: any) => !chavesExistentes.has(chaveDoRecebimento(e)))
    .map((e: any) => ({
      ...e,
      installment: e.payment_kind === "termination" ? null : proximoNumero++,
    }));

  if (criar.length > 0) {
    const { error } = await (supabase as any).from("payments").insert(criar);
    if (error) throw error;
    console.log(`✅ ${criar.length} recebimento(s) criado(s)`);
  }

  await atualizarTotalDeParcelas(rentalId);
  console.log("✅ [syncPaymentsOnDateChange] Sincronização concluída!");
}

/**
 * Ajusta o valor do aluguel de uma locação ativa e recalcula os recebimentos
 * ainda não pagos (pending ou overdue) do mês atual em diante.
 *
 * ⚠️ REGRA CONFIRMADA PELO CADU EM 16/set/2026 (substitui a correção
 * anterior de 27/ago/2026, que estava incompleta): reajustar o valor do
 * aluguel deve atualizar os recebimentos do MÊS PRESENTE e os futuros --
 * nunca meses passados, mesmo que ainda estejam pendentes/atrasados. Um
 * recebimento de 2 meses atrás que nunca foi pago não deve ganhar o valor
 * novo retroativamente; só o que vence a partir do 1º dia do mês corrente.
 *
 * A versão anterior (27/ago/2026) atualizava QUALQUER pending/overdue,
 * inclusive de meses antigos -- resolvia o caso "reajuste atrasado, mês
 * atual sem o aumento" mas ia longe demais, reescrevendo histórico de meses
 * que já deviam ter ficado como estavam.
 *
 * O parâmetro `effectiveDate` nunca foi usado aqui (sempre chega com a data
 * de hoje, de qualquer forma) -- o corte usado é sempre o 1º dia do mês
 * corrente, não uma data efetiva escolhida por quem chama.
 */
export async function adjustRentalValue(
  rentalId: string,
  oldValue: number,
  newValue: number,
  effectiveDate: string
): Promise<void> {
  console.log("💰 [adjustRentalValue] Ajustando valor do aluguel...");

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) throw new Error("Locação não encontrada");

  const hoje = new Date();
  const inicioDoMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data: unpaidPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .in("status", ["pending", "overdue"])
    .gte("due_date", inicioDoMesAtual)
    .order("due_date", { ascending: true });

  if (paymentsError) throw paymentsError;
  if (!unpaidPayments || unpaidPayments.length === 0) {
    console.log("ℹ️ Nenhum pagamento pendente/atrasado do mês atual em diante para atualizar");
    return;
  }

  console.log(`📊 ${unpaidPayments.length} pagamento(s) do mês atual em diante serão atualizados`);

  const garageAmount = (rental.has_garage && rental.garage_value) ? rental.garage_value : 0;
  const totalNewValue = newValue + garageAmount;

  for (const payment of unpaidPayments as any[]) {
    // Recebimento de Fim de Contrato (caução) não é aluguel: nunca muda aqui.
    if (payment.payment_kind === "termination") continue;

    // Proporcional de fim de contrato: continua proporcional, só que sobre o
    // valor novo (mesmos dias).
    if (payment.contract_end) {
      const dias = diasProporcionalFimContrato(payment.due_date, Number(rental.rent_due_day));
      const prop = calcularProporcionalAluguelEGaragem(newValue, garageAmount, dias);
      const bdProp: any[] = [
        { type: "addition", amount: prop.aluguel, description: `Aluguel - Proporcional Fim de Contrato (${dias} dias)` },
      ];
      if (garageAmount > 0) {
        bdProp.push({ type: "addition", amount: prop.garagem, description: `Garagem - Proporcional Fim de Contrato (${dias} dias)` });
      }
      const { error: propError } = await supabase
        .from("payments")
        .update({ expected_amount: prop.total, breakdown: bdProp })
        .eq("id", payment.id);
      if (propError) throw propError;
      continue;
    }

    const breakdown = [
      { type: "addition", amount: parseFloat(newValue.toFixed(2)), description: "Aluguel" }
    ];
    if (garageAmount > 0) {
      breakdown.push({
        type: "addition",
        amount: parseFloat(garageAmount.toFixed(2)),
        description: "Garagem"
      });
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        expected_amount: parseFloat(totalNewValue.toFixed(2)),
        breakdown
      })
      .eq("id", payment.id);

    if (updateError) throw updateError;
  }

  console.log(`✅ ${unpaidPayments.length} pagamentos atualizados`);
}

/**
 * Atualiza só o DIA de vencimento (o "dia de cobrança") dos recebimentos
 * pending/overdue de uma locação, mantendo o mesmo mês/ano de referência de
 * cada um -- usada quando o dia de vencimento muda SOZINHO, sem mexer em
 * data início/fim do contrato.
 *
 * ⚠️ REGRA CONFIRMADA PELO CADU EM 16/set/2026: ao contrário do reajuste de
 * valor (que só pega mês atual em diante), a troca do dia de vencimento
 * vale para TODOS os recebimentos pendentes -- inclusive os de meses
 * passados que ainda não foram pagos -- porque é a mesma cobrança, só muda
 * o dia do mês em que ela vence. Nunca mexe em 'paid'/'partial' (histórico).
 *
 * Bug encontrado ao ler o código (16/set/2026): antes desta função existir,
 * mudar SÓ o dia de vencimento (sem mexer em data início/fim nem em valor)
 * não disparava nada -- nem `syncPaymentsOnDateChange` (só roda quando
 * início/fim mudam) nem `adjustRentalValue` (só roda quando o valor muda).
 * Resultado: a tela deixava editar o dia de vencimento, a edição "salvava",
 * mas nenhum recebimento existente refletia o novo dia -- só os recebimentos
 * criados depois disso é que nasciam certos.
 */
export async function syncPaymentDueDay(
  rentalId: string,
  newPaymentDay: number
): Promise<void> {
  console.log(`📅 [syncPaymentDueDay] Atualizando dia de vencimento para ${newPaymentDay}...`);

  const { data: payments, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .in("status", ["pending", "overdue"]);

  if (fetchError) throw fetchError;
  if (!payments || payments.length === 0) {
    console.log("ℹ️ Nenhum pagamento pendente/atrasado para atualizar o dia de vencimento");
    return;
  }

  let atualizados = 0;
  for (const payment of payments as any[]) {
    // Fim de contrato (proporcional final e recebimento de Fim de Contrato)
    // vence na DATA FIM, não no dia de vencimento -- não muda de dia aqui.
    if (payment.contract_end) continue;
    const dataAtual = new Date(payment.due_date + "T00:00:00");
    const diasNoMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0).getDate();
    // Se o novo dia não existe naquele mês (ex.: dia 31 num mês de 30 dias),
    // usa o último dia do mês -- mesma regra já usada no resto do sistema
    // pra gerar vencimentos.
    const novoDia = Math.min(newPaymentDay, diasNoMes);
    const novaDataVencimento = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), novoDia)
      .toISOString()
      .split("T")[0];

    if (novaDataVencimento === payment.due_date) continue;

    const { error: updateError } = await supabase
      .from("payments")
      .update({ due_date: novaDataVencimento })
      .eq("id", payment.id);

    if (updateError) throw updateError;
    atualizados++;
  }

  console.log(`✅ [syncPaymentDueDay] ${atualizados} recebimento(s) com o dia de vencimento atualizado`);
}

export const rentalUpdateService = {
  syncPaymentsOnDateChange,
  renovarRecebimentos,
  apagarFimDeContratoPendente,
  adjustRentalValue,
  syncPaymentDueDay,

  async updatePaymentsOnRentalEdit(
    rentalId: string, 
    oldRental: Rental, 
    newChanges: RentalUpdateChanges
  ): Promise<void> {
    try {
      console.log("🚀 [rentalUpdateService] Analisando mudanças...");

      const startDateChanged = newChanges.startDate && newChanges.startDate !== oldRental.startDate;
      const endDateChanged = newChanges.endDate !== undefined && newChanges.endDate !== oldRental.endDate;
      
      if (startDateChanged || endDateChanged) {
        const monthlyRent = newChanges.monthlyRent ?? oldRental.monthlyRent;
        const paymentDay = newChanges.paymentDay ?? oldRental.paymentDay;
        const hasGarage = newChanges.hasGarage ?? oldRental.hasGarage;
        const garageValue = newChanges.garageValue ?? oldRental.garageValue ?? 0;

        await syncPaymentsOnDateChange(
          rentalId,
          oldRental.startDate,
          oldRental.endDate,
          newChanges.startDate ?? oldRental.startDate,
          newChanges.endDate ?? oldRental.endDate,
          monthlyRent,
          paymentDay,
          hasGarage,
          garageValue
        );
      }

      const valueChanged = (newChanges.monthlyRent !== undefined && newChanges.monthlyRent !== oldRental.monthlyRent) ||
                          (newChanges.hasGarage !== undefined && newChanges.hasGarage !== oldRental.hasGarage) ||
                          (newChanges.garageValue !== undefined && newChanges.garageValue !== oldRental.garageValue);

      if (valueChanged && !startDateChanged && !endDateChanged) {
        const newRent = newChanges.monthlyRent ?? oldRental.monthlyRent;
        await adjustRentalValue(rentalId, oldRental.monthlyRent, newRent, new Date().toISOString().split('T')[0]);
      }

      // ⚠️ Bug corrigido em 16/set/2026 (regra confirmada pelo Cadu): quando
      // SÓ o dia de vencimento muda (sem mexer em data início/fim), nada
      // disparava antes -- syncPaymentsOnDateChange só roda com mudança de
      // início/fim (e já cuida do dia de vencimento nesse caso, porque
      // recalcula tudo do zero com o paymentDay novo), e adjustRentalValue só
      // roda com mudança de valor. O dia de vencimento sozinho ficava sem
      // nenhum efeito nos recebimentos já existentes.
      const paymentDayChanged =
        newChanges.paymentDay !== undefined && newChanges.paymentDay !== oldRental.paymentDay;

      if (paymentDayChanged && !startDateChanged && !endDateChanged) {
        await syncPaymentDueDay(rentalId, newChanges.paymentDay!);
      }

      console.log("✅ [rentalUpdateService] Concluído");
    } catch (error) {
      console.error("❌ [rentalUpdateService] ERRO:", error);
      throw error;
    }
  }
};