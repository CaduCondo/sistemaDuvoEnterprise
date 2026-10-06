import { supabase } from "@/integrations/supabase/client";
import { parseISO, getMonth, getYear, differenceInDays } from "date-fns";
import { calculateCorrectedDeposit } from "./igpmService";
import { calcularProporcionalAluguelEGaragem } from "@/lib/rentalCalculations";

export interface TerminationData {
  rentalId: string;
  terminationDate: string;
  penaltyAmount: number;
  depositAmount: number;
  paymentDay: number;
  monthlyRent: number;
  /**
   * Valor mensal da garagem. ⚠️ Até 24/ago/2026 este campo não existia, e a
   * garagem simplesmente não entrava na conta da rescisão — sumia da
   * cobrança em todo imóvel que tinha vaga. Ver #49 e
   * docs/tickets/rescisao-caucao.md, decisão 5.
   */
  garageValue?: number;
  /** Despesas adicionais cobradas do inquilino na rescisao. Positivo. */
  additionalExpenses?: number;
  /** Desconto concedido ao inquilino. O usuario digita so o numero; gravamos negativo. */
  discount?: number;
}

/**
 * Processa a rescisão de contrato - NOVA VERSÃO COM REGRAS DE VENCIMENTO
 * 
 * NOVAS REGRAS:
 * 1. Rescisão POSTERIOR ao vencimento: cria 2 recebimentos no mesmo mês
 *    - Recebimento 1 (vencimento original): aluguel cheio
 *    - Recebimento 2 (vencimento = data rescisão): proporcional + multa - caução
 * 
 * 2. Rescisão ANTERIOR ao vencimento: atualiza recebimento existente
 *    - Vencimento = data da rescisão
 *    - Proporcional + multa - caução
 */
export async function processContractTermination(data: TerminationData): Promise<void> {
  console.log("\n".repeat(3));
  console.log("═".repeat(80));
  console.log("🚀 INICIO processContractTermination - VERSÃO COM NOVAS REGRAS DE VENCIMENTO");
  console.log("═".repeat(80));
  console.log("Dados recebidos:", JSON.stringify(data, null, 2));

  const { 
    rentalId, 
    terminationDate, 
    penaltyAmount, 
    depositAmount,
    paymentDay,
    monthlyRent,
    garageValue = 0,
    additionalExpenses = 0,
    discount = 0
  } = data;

  // ==========================================
  // PASSO 0: Tirar o fim de contrato "programado" (03/out/2026)
  //
  // Desde a regra de fim de contrato (#108), toda locação já nasce com o
  // proporcional final e o recebimento de Fim de Contrato vencendo na data
  // fim. A rescisão cria os recebimentos dela -- então os programados, se
  // ainda não foram pagos, saem antes, para não ficar cobrança em dobro.
  // ==========================================
  {
    const { apagarFimDeContratoPendente } = await import("./rentalUpdateService");
    await apagarFimDeContratoPendente(rentalId);
  }

  // ==========================================
  // PASSO 1: Determinar o mês da rescisão
  // ==========================================
  console.log("\n📅 PASSO 1: Determinar mês da rescisão");
  
  const terminationDateObj = parseISO(terminationDate);
  const terminationMonth = getMonth(terminationDateObj) + 1; // 1-12
  const terminationYear = getYear(terminationDateObj);
  const terminationDay = terminationDateObj.getDate();
  
  console.log(`  Data de rescisão: ${terminationDate}`);
  console.log(`  Mês/Ano: ${terminationMonth}/${terminationYear}`);
  console.log(`  Dia: ${terminationDay}`);
  console.log(`  Dia de vencimento: ${paymentDay}`);

  // ==========================================
  // PASSO 2: Determinar se é ANTES ou DEPOIS do vencimento
  // ==========================================
  console.log("\n🔍 PASSO 2: Determinar relação com vencimento");
  
  const isAfterDueDate = terminationDay >= paymentDay;
  
  if (isAfterDueDate) {
    console.log("  ✅ RESCISÃO POSTERIOR AO VENCIMENTO");
    console.log(`  Vencimento (dia ${paymentDay}) já passou no mês ${terminationMonth}/${terminationYear}`);
  } else {
    console.log("  ✅ RESCISÃO ANTERIOR AO VENCIMENTO");
    console.log(`  Vencimento (dia ${paymentDay}) ainda não chegou no mês ${terminationMonth}/${terminationYear}`);
  }

  // ==========================================
  // PASSO 3: Calcular valores
  // ==========================================
  console.log("\n💰 PASSO 3: Calcular valores");
  
  let lastPaymentDate: Date;
  let fullMonthRent = 0;
  let proportionalRent = 0;
  let proportionalRentOnly = 0;
  let proportionalGarage = 0;
  let daysUsed = 0;

  if (isAfterDueDate) {
    // Rescisão APÓS o vencimento
    lastPaymentDate = new Date(terminationYear, terminationMonth - 1, paymentDay);
    
    console.log("  📊 Cálculo para rescisão APÓS vencimento:");
    console.log(`  Último vencimento: ${lastPaymentDate.toISOString().split("T")[0]}`);
    
    // Cobra mês cheio (já venceu) + proporcional dos dias extras
    fullMonthRent = monthlyRent + garageValue;
    daysUsed = differenceInDays(terminationDateObj, lastPaymentDate) + 1;

    const proporcional = calcularProporcionalAluguelEGaragem(monthlyRent, garageValue, daysUsed);
    proportionalRentOnly = proporcional.aluguel;
    proportionalGarage = proporcional.garagem;
    proportionalRent = proporcional.total;

    console.log(`  Mês cheio (recebimento 1): R$ ${fullMonthRent.toFixed(2)}`);
    console.log(`  Dias extras (${lastPaymentDate.toISOString().split("T")[0]} a ${terminationDate}): ${daysUsed}`);
    console.log(`  Proporcional do aluguel: R$ ${proportionalRentOnly.toFixed(2)}`);
    console.log(`  Proporcional da garagem: R$ ${proportionalGarage.toFixed(2)}`);
    console.log(`  Valor proporcional total (recebimento 2): R$ ${proportionalRent.toFixed(2)}`);
  } else {
    // Rescisão ANTES do vencimento
    const previousMonth = terminationMonth === 1 ? 12 : terminationMonth - 1;
    const previousYear = terminationMonth === 1 ? terminationYear - 1 : terminationYear;
    lastPaymentDate = new Date(previousYear, previousMonth - 1, paymentDay);
    
    console.log("  📊 Cálculo para rescisão ANTES do vencimento:");
    console.log(`  Último vencimento: ${lastPaymentDate.toISOString().split("T")[0]}`);
    
    // Apenas proporcional desde o último vencimento até a rescisão
    daysUsed = differenceInDays(terminationDateObj, lastPaymentDate) + 1;

    const proporcional = calcularProporcionalAluguelEGaragem(monthlyRent, garageValue, daysUsed);
    proportionalRentOnly = proporcional.aluguel;
    proportionalGarage = proporcional.garagem;
    proportionalRent = proporcional.total;

    console.log(`  Período: ${lastPaymentDate.toISOString().split("T")[0]} até ${terminationDate}`);
    console.log(`  Total de dias: ${daysUsed}`);
    console.log(`  Proporcional do aluguel: R$ ${proportionalRentOnly.toFixed(2)}`);
    console.log(`  Proporcional da garagem: R$ ${proportionalGarage.toFixed(2)}`);
    console.log(`  Valor proporcional total: R$ ${proportionalRent.toFixed(2)}`);
  }

  // ==========================================
  // PASSO 4: Calcular caução corrigido
  // ==========================================
  console.log("\n💰 PASSO 4: Calcular caução corrigido pelo IGPM");
  
  const rentalStartDate = await supabase
    .from("rentals")
    .select("start_date, property_id")
    .eq("id", rentalId)
    .single();

  const startDate = rentalStartDate.data?.start_date || terminationDate;

  // ⚠️ A correcao incide sobre o que o inquilino EFETIVAMENTE PAGOU, e nao
  // sobre o valor contratado. Decisao 4 do ticket (docs/tickets/rescisao-caucao.md):
  // se o caucao foi contratado em 3 parcelas e so 2 foram pagas, devolve-se
  // sobre as 2. Se nao foi pago nada, nao ha o que devolver.
  const { data: parcelasCaucao, error: erroParcelas } = await supabase
    .from("deposit_installments")
    .select("paid_amount, amount, status")
    .eq("rental_id", rentalId);

  if (erroParcelas) {
    console.error("  ❌ Erro ao buscar parcelas de caucao:", erroParcelas);
    throw erroParcelas;
  }

  // ⚠️ DEFEITO CORRIGIDO EM 27/ago/2026 — a rescisao nascia ZERADA.
  //
  // Somava so `paid_amount`. Existe um defeito antigo em que a parcela de
  // caucao era marcada como PAGA sem que o valor pago fosse gravado junto
  // (markDepositInstallmentAsPaid gravava status e data, mas nao o valor) —
  // ficava "paga por R$ 0,00". Com todas as parcelas assim, a soma dava
  // zero, a devolucao dava zero, e o Recebimento de Rescisao nascia com
  // valor R$ 0,00 — foi exatamente o que o Cadu viu na tela.
  //
  // Uma parcela marcada como paga valendo zero e um dado inconsistente, nao
  // um pagamento de zero reais. Nesse caso vale o valor da propria parcela.
  //
  // A causa de raiz esta no BANCO e e corrigida pelo passo 4 do
  // docs/tickets/PROD-rescisao-49.sql (o UPDATE que preenche paid_amount das
  // parcelas pagas). Esta defesa aqui existe para que uma base que ainda nao
  // recebeu aquela correcao nao gere rescisao zerada em silencio.
  const caucaoPago = (parcelasCaucao || []).reduce((soma, parcela: any) => {
    const valorPago = Number(parcela.paid_amount || 0);
    const valorDaParcela = Number(parcela.amount || 0);

    if (parcela.status === "paid" && valorPago === 0 && valorDaParcela > 0) {
      console.warn(
        `  ⚠️ Parcela de caucao marcada como PAGA com valor R$ 0,00. ` +
        `Usando o valor da parcela (R$ ${valorDaParcela.toFixed(2)}). ` +
        `Rode o passo 4 de docs/tickets/PROD-rescisao-49.sql neste banco.`
      );
      return soma + valorDaParcela;
    }

    return soma + valorPago;
  }, 0);

  console.log(`  Caucao contratado: R$ ${depositAmount.toFixed(2)}`);
  console.log(`  Caucao efetivamente pago: R$ ${caucaoPago.toFixed(2)} (${(parcelasCaucao || []).length} parcelas)`);

  const igpmCorrection = calculateCorrectedDeposit(
    caucaoPago,
    startDate,
    terminationDate
  );

  const correctedDeposit = igpmCorrection.correctedAmount;

  console.log(`  Valor base da correcao: R$ ${caucaoPago.toFixed(2)}`);
  console.log(`  Meses ativos: ${igpmCorrection.months}`);
  console.log(`  IGPM acumulado: ${igpmCorrection.poupancaPercentage.toFixed(2)}%`);
  console.log(`  Valor corrigido: R$ ${correctedDeposit.toFixed(2)}`);

  // ==========================================
  // PASSO 4B: Cancelar parcelas de caução nunca pagas
  //
  // ⚠️ NOVO (01/set/2026): quem confirma a rescisão já foi avisado (tela
  // de confirmação em RentalTerminationDialog) de que a locação tem
  // caução pendente/parcial. Uma vez confirmado, essas parcelas nunca
  // serão cobradas nem devolvidas -- viram "cancelled" (decisão do Cadu).
  // Migration: 20260901120000_add_cancelled_status_to_deposit_installments.sql.
  // ==========================================
  const { error: erroCancelarCaucao } = await supabase
    .from("deposit_installments")
    .update({ status: "cancelled" })
    .eq("rental_id", rentalId)
    .in("status", ["pending", "partial"]);

  if (erroCancelarCaucao) {
    console.error("  ❌ Erro ao cancelar parcelas de caução não pagas:", erroCancelarCaucao);
    throw erroCancelarCaucao;
  }

  console.log("  ✅ Parcelas de caução pendentes/parciais (se houver) marcadas como canceladas.");

  // Identificador que liga os DOIS recebimentos desta rescisao (#49).
  const grupoRescisao = (globalThis.crypto?.randomUUID?.() ??
    `${rentalId}-${terminationDate}-${Date.now()}`);

  // Os tres valores do Recebimento de Rescisao, com os sinais combinados:
  //   devolucao NEGATIVA, despesas POSITIVAS, desconto NEGATIVO.
  const valorDevolucao = correctedDeposit > 0 ? -correctedDeposit : 0;
  const valorDespesas = Math.abs(additionalExpenses);
  const valorDesconto = discount === 0 ? 0 : -Math.abs(discount);
  const totalRescisao =
    Math.round((valorDevolucao + valorDespesas + valorDesconto) * 100) / 100;

  console.log("\n💰 Recebimento de Rescisao (aba Caucoes):");
  console.log(`  Valor corrigido p/ devolucao: R$ ${valorDevolucao.toFixed(2)}`);
  console.log(`  Despesas adicionais:          R$ ${valorDespesas.toFixed(2)}`);
  console.log(`  Valor desconto:               R$ ${valorDesconto.toFixed(2)}`);
  console.log(`  TOTAL:                        R$ ${totalRescisao.toFixed(2)}`);

  // ==========================================
  // PASSO 5: Recebimento de ALUGUEL da rescisão (proporcional + multa)
  //
  // ⚠️ Regra do Cadu, 05/out/2026 (bug de produção LEMOS APTO 05: o mês já
  // estava PAGO e a rescisão cobrou o aluguel cheio de novo). O sistema olha o
  // recebimento REGULAR do mês escolhido na rescisão e se a rescisão foi
  // ANTES ou DEPOIS do dia de vencimento:
  //
  //   ANTES do vencimento (não há proporcional: o próximo aluguel nem começou)
  //     1. PAGO     -> cria um recebimento só com a MULTA
  //     2. PARCIAL  -> soma a MULTA no próprio recebimento
  //     3. PENDENTE -> soma a MULTA no próprio recebimento
  //   DEPOIS do vencimento
  //     4. PAGO     -> cria um recebimento com o PROPORCIONAL + a MULTA
  //     5. PARCIAL  -> soma o PROPORCIONAL + a MULTA no próprio recebimento
  //     6. PENDENTE -> soma o PROPORCIONAL + a MULTA no próprio recebimento
  //
  // Em todos: o recebimento criado/atualizado passa a vencer na DATA DA
  // RESCISÃO, e o Recebimento de Rescisão (caução, PASSO 5B) também. O
  // recebimento CRIADO (casos 1 e 4) não é parcela de aluguel: fica sem número.
  // O ATUALIZADO (2, 3, 5, 6) continua sendo a última parcela.
  // ==========================================
  console.log("\n📝 PASSO 5: Recebimento de aluguel da rescisão");

  const mesStr = String(terminationMonth).padStart(2, "0");
  const anoStr = String(terminationYear);
  const primeiroDiaDoMes = `${anoStr}-${mesStr}-01`;
  const ultimoDiaDoMes = `${anoStr}-${mesStr}-${String(new Date(terminationYear, terminationMonth, 0).getDate()).padStart(2, "0")}`;

  const { data: doMes, error: erroDoMes } = await (supabase as any)
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .gte("due_date", primeiroDiaDoMes)
    .lte("due_date", ultimoDiaDoMes)
    .order("due_date", { ascending: true });

  if (erroDoMes) {
    console.error("  ❌ Erro ao buscar o recebimento do mês da rescisão:", erroDoMes);
    throw erroDoMes;
  }

  // Recebimento REGULAR do mês (não o proporcional de fim de contrato -- que
  // já saiu no PASSO 0 -- nem um de rescisão).
  const regularesDoMes = (doMes || []).filter(
    (p: any) => (p.payment_kind || "rent") === "rent" && !p.contract_end && !p.termination_group_id
  );
  const recebimentoDoMes: any = regularesDoMes.length > 0 ? regularesDoMes[regularesDoMes.length - 1] : null;
  const jaPago = recebimentoDoMes?.status === "paid";

  console.log(
    recebimentoDoMes
      ? `  Recebimento do mês: ${recebimentoDoMes.due_date} | parcela ${recebimentoDoMes.installment} | ${recebimentoDoMes.status} | rescisão ${isAfterDueDate ? "DEPOIS" : "ANTES"} do vencimento`
      : "  Nenhum recebimento regular no mês da rescisão"
  );

  // O que a rescisão cobra: proporcional só DEPOIS do vencimento; multa sempre.
  const diasTexto = `${String(daysUsed).padStart(2, "0")} ${daysUsed === 1 ? "dia" : "dias"}`;
  const legendaProporcional =
    `* Proporcional de ${diasTexto} - de ${lastPaymentDate.toISOString().split("T")[0]} até ${terminationDate}`;

  const linhasProporcional: Array<{ description: string; nota?: string; amount: number; type: string }> = [];
  if (isAfterDueDate && proportionalRentOnly > 0) {
    linhasProporcional.push({ description: "Aluguel Proporcional *", nota: legendaProporcional, amount: proportionalRentOnly, type: "addition" });
  }
  if (isAfterDueDate && proportionalGarage > 0) {
    linhasProporcional.push({ description: "Garagem Proporcional *", nota: legendaProporcional, amount: proportionalGarage, type: "addition" });
  }
  const linhaMulta = penaltyAmount > 0
    ? [{ description: "Multa Rescisória", amount: penaltyAmount, type: "addition" }]
    : [];

  const somar = (linhas: Array<{ amount: number }>) =>
    Math.round(linhas.reduce((s, l) => s + Number(l.amount || 0), 0) * 100) / 100;

  const notaRescisao = `Rescisão de Contrato - Data de saída: ${terminationDate}.`;

  /** Encaixa cada proporcional logo abaixo da linha cheia correspondente
   *  (Aluguel, Aluguel Proporcional, Garagem, Garagem Proporcional, Multa). */
  const juntarLinhas = (atuais: any[]) => {
    const pendentes = [...linhasProporcional];
    const tirar = (prefixo: string) => {
      const i = pendentes.findIndex((l) => l.description.startsWith(prefixo));
      return i >= 0 ? pendentes.splice(i, 1) : [];
    };
    const resultado: any[] = [];
    for (const item of atuais) {
      resultado.push(item);
      const desc = String(item?.description || "");
      if (desc.startsWith("Aluguel") && !desc.includes("Proporcional")) resultado.push(...tirar("Aluguel Proporcional"));
      if (desc.startsWith("Garagem") && !desc.includes("Proporcional")) resultado.push(...tirar("Garagem Proporcional"));
    }
    resultado.push(...pendentes, ...linhaMulta);
    return resultado;
  };

  const aluguelCheioDoMes = () =>
    garageValue > 0
      ? [
          { description: "Aluguel", amount: monthlyRent, type: "addition" },
          { description: "Garagem", amount: garageValue, type: "addition" },
        ]
      : [{ description: "Aluguel", amount: fullMonthRent, type: "addition" }];

  if (recebimentoDoMes && !jaPago) {
    // ---------- CASOS 2, 3, 5 e 6: PARCIAL ou PENDENTE -> soma nele ----------
    const atuais: any[] = Array.isArray(recebimentoDoMes.breakdown) && recebimentoDoMes.breakdown.length > 0
      ? recebimentoDoMes.breakdown
      : [{ description: "Aluguel", amount: Number(recebimentoDoMes.expected_amount) || fullMonthRent, type: "addition" }];
    const novasLinhas = juntarLinhas(atuais);
    const total = somar(novasLinhas);

    console.log(`  🔵 ${recebimentoDoMes.status.toUpperCase()}: parcela ${recebimentoDoMes.installment} passa a cobrar R$ ${total.toFixed(2)}, vencendo em ${terminationDate}`);

    const { error } = await (supabase as any)
      .from("payments")
      .update({
        due_date: terminationDate,
        expected_amount: total,
        breakdown: novasLinhas,
        termination_group_id: grupoRescisao,
        notes: notaRescisao,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recebimentoDoMes.id);
    if (error) {
      console.error("  ❌ Erro ao atualizar o recebimento do mês:", error);
      throw error;
    }
  } else if (jaPago) {
    // ---------- CASOS 1 e 4: PAGO -> recebimento novo, sem número de parcela ----------
    const linhas = [...linhasProporcional, ...linhaMulta];
    const total = somar(linhas);

    if (linhas.length > 0 && total > 0) {
      console.log(`  🔵 PAGO: recebimento novo com ${isAfterDueDate ? "proporcional + multa" : "multa"}: R$ ${total.toFixed(2)}`);
      const { error } = await (supabase as any)
        .from("payments")
        .insert({
          rental_id: rentalId,
          due_date: terminationDate,
          expected_amount: total,
          reference_month: mesStr,
          reference_year: anoStr,
          status: "pending",
          installment: null,
          payment_kind: "rent",
          contract_end: false,
          termination_group_id: grupoRescisao,
          breakdown: linhas,
          notes: `${notaRescisao} Despesas de reforma podem ser adicionadas na tela de Recebimentos.`,
        });
      if (error) {
        console.error("  ❌ Erro ao criar o recebimento de aluguel da rescisão:", error);
        throw error;
      }
    } else {
      console.log("  ℹ️ Mês já pago e nada de proporcional nem multa: nenhum recebimento de aluguel novo.");
    }
  } else {
    // ---------- Sem recebimento regular no mês (dado antigo/incompleto) ----------
    // Trata como se o mês estivesse PENDENTE: cobra o aluguel do mês junto
    // com o proporcional/multa, e esse passa a ser a última parcela.
    const linhas = juntarLinhas(aluguelCheioDoMes());
    const total = somar(linhas);
    console.log(`  🔵 Sem recebimento do mês: criando um com aluguel + ${isAfterDueDate ? "proporcional + " : ""}multa: R$ ${total.toFixed(2)}`);

    const { error } = await (supabase as any)
      .from("payments")
      .insert({
        rental_id: rentalId,
        due_date: terminationDate,
        expected_amount: total,
        reference_month: mesStr,
        reference_year: anoStr,
        status: "pending",
        installment: 9999, // numerado de verdade no PASSO 8
        payment_kind: "rent",
        contract_end: false,
        termination_group_id: grupoRescisao,
        breakdown: linhas,
        notes: `${notaRescisao} Despesas de reforma podem ser adicionadas na tela de Recebimentos.`,
      });
    if (error) {
      console.error("  ❌ Erro ao criar o recebimento de aluguel da rescisão:", error);
      throw error;
    }
  }

  // ==========================================
  // PASSO 5B: Criar o Recebimento de Rescisao (aba Caucoes)
  //
  // Este e o segundo recebimento da rescisao (#49). Ele guarda a devolucao do
  // caucao, as despesas adicionais e o desconto — e NAO entra na base das
  // taxas de adm e gerenciamento, porque nada disso e receita da imobiliaria.
  //
  // Vence no mesmo dia da rescisao, ou seja, cai no mesmo periodo da ultima
  // parcela de aluguel.
  // ==========================================
  console.log("\n📝 PASSO 5B: Criar o Recebimento de Rescisao (aba Cauções)");

  // ⚠️ 05/out/2026 (regra do Cadu): o Recebimento de Rescisão é criado
  // SEMPRE -- mesmo sem caução pago (linha da devolução zerada), para poder
  // lançar despesas ou desconto na saída. Antes, sem nada a devolver, ele
  // simplesmente não nascia.
  {
    const breakdownRescisao: Array<{ description: string; amount: number; type: string }> = [];

    {
      breakdownRescisao.push({
        // A mencao a poupanca saiu daqui: virou a linha de baixo, que e o
        // link do tooltip com o detalhe da correcao (28/ago/2026).
        description: "Caução Corrigido p/ Devolução",
        amount: valorDevolucao,
        type: "deduction"
      });
    }

    if (valorDespesas !== 0) {
      breakdownRescisao.push({
        description: "Despesas Adicionais",
        amount: valorDespesas,
        type: "addition"
      });
    }

    if (valorDesconto !== 0) {
      breakdownRescisao.push({
        description: "Valor Desconto",
        amount: valorDesconto,
        type: "deduction"
      });
    }

    const { error: erroRescisao } = await supabase
      .from("payments")
      .insert({
        rental_id: rentalId,
        due_date: terminationDate,
        expected_amount: totalRescisao,
        reference_month: String(terminationMonth).padStart(2, "0"),
        reference_year: String(terminationYear),
        status: "pending",
        payment_kind: "termination",
        termination_group_id: grupoRescisao,
        termination_corrected_deposit: valorDevolucao,
        termination_additional_expenses: valorDespesas,
        termination_discount: valorDesconto,
        breakdown: breakdownRescisao,
        notes: `Recebimento de Rescisão - Data de saída: ${terminationDate}. Devolução de caução, despesas adicionais e desconto. Não entra na base das taxas de administração e gerenciamento.`
      });

    if (erroRescisao) {
      console.error("  ❌ Erro ao criar o Recebimento de Rescisão:", erroRescisao);
      throw erroRescisao;
    }

    // ⚠️ Trava contra o trigger antigo do banco (27/ago/2026).
    //
    // O Recebimento de Rescisão nasce PENDENTE: quem decide se foi quitado é
    // a aplicação, não o banco. Só que o trigger validate_payment_status, na
    // versão anterior à #49, olhava "esperado − pago" e, vendo zero de um
    // lado e zero do outro, cravava 'paid' por cima do 'pending'.
    //
    // O desvio para payment_kind='termination' está no passo 3 do
    // docs/tickets/PROD-rescisao-49.sql. Num banco que ainda não recebeu
    // aquele passo, o recebimento nascia marcado como PAGO e não havia como
    // desmarcar pela tela. Este UPDATE devolve o status correto logo após a
    // inserção — inofensivo num banco já corrigido.
    // `(supabase as any)`: os tipos gerados ainda nao conhecem as colunas da
    // #49 em "payments", e a cadeia tipada estoura o limite de inferencia do TS.
    const { error: erroStatusRescisao } = await (supabase as any)
      .from("payments")
      .update({ status: "pending" })
      .eq("termination_group_id", grupoRescisao)
      .eq("payment_kind", "termination")
      .neq("status", "pending");

    if (erroStatusRescisao) {
      console.warn("  ⚠️ Nao foi possivel reafirmar o status pendente:", erroStatusRescisao);
    }

    console.log(`  ✅ Recebimento de Rescisão criado: R$ ${totalRescisao.toFixed(2)}`);
  }

  // ==========================================
  // PASSO 6: Atualizar data fim do contrato
  // ==========================================
  console.log("\n📅 PASSO 6: Atualizar data fim do contrato");
  
  // ⚠️ Até 07/set/2026 quem marcava a locação como "ended" e liberava o
  // imóvel como disponível era uma rotina automática à parte
  // (rentalService.checkAndUpdateExpiredRentals), que rodava sozinha
  // sempre que a end_date ficava no passado -- o que essa própria rescisão
  // acabava de causar. Isso travava a tela (Renovar/Rescindir sumiam) e já
  // liberava o imóvel antes de qualquer acerto de verdade. Agora quem
  // encerra a locação e libera o imóvel é só esta rescisão, no momento
  // certo -- ver "Encerramento de Locações com Data Fim Vencida" no Manual.
  const { error: updateRentalError } = await supabase
    .from("rentals")
    .update({
      status: "ended",
      end_date: terminationDate,
      returned_deposit_amount: correctedDeposit, // ✅ Salvar valor devolvido
      updated_at: new Date().toISOString()
    })
    .eq("id", rentalId);

  if (updateRentalError) {
    console.error("❌ Erro ao atualizar data fim do contrato:", updateRentalError);
    throw updateRentalError;
  }

  console.log(`  ✅ Data fim atualizada para: ${terminationDate}`);
  console.log(`  ✅ Valor devolvido do caução: R$ ${correctedDeposit.toFixed(2)}`);
  console.log(`  ✅ Status da locação atualizado para: ended`);

  const propertyId = rentalStartDate.data?.property_id;
  if (propertyId) {
    const { error: updatePropertyError } = await supabase
      .from("properties")
      .update({ status: "available" })
      .eq("id", propertyId);

    if (updatePropertyError) {
      // Não interrompe a rescisão por isso -- o financeiro já foi todo
      // processado e gravado; só avisa no log pra alguém liberar manualmente.
      console.error("❌ Erro ao liberar o imóvel como disponível:", updatePropertyError);
    } else {
      console.log(`  ✅ Imóvel ${propertyId} liberado como disponível`);
    }
  }

  // ==========================================
  // PASSO 7: DELETAR pagamentos futuros
  // ==========================================
  console.log("\n🗑️ PASSO 7: DELETAR pagamentos futuros");
  
  const nextMonth = terminationMonth === 12 ? 1 : terminationMonth + 1;
  const nextYear = terminationMonth === 12 ? terminationYear + 1 : terminationYear;

  console.log(`  🎯 CRITÉRIO DE DELEÇÃO: Pagamentos a partir de ${nextMonth}/${nextYear}`);

  const cutoffDate = new Date(terminationYear, terminationMonth, 1);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  const { data: paymentsToDelete, error: fetchDeleteError } = await supabase
    .from("payments")
    .select("id, due_date, reference_month, reference_year, status")
    .eq("rental_id", rentalId)
    .gte("due_date", cutoffDateStr);

  if (fetchDeleteError) {
    console.error("❌ Erro ao buscar pagamentos para deletar:", fetchDeleteError);
    throw fetchDeleteError;
  }

  console.log(`  📋 PAGAMENTOS ENCONTRADOS PARA DELETAR: ${paymentsToDelete?.length || 0}`);
  
  if (paymentsToDelete && paymentsToDelete.length > 0) {
    paymentsToDelete.forEach((p, idx) => {
      console.log(`    ${idx + 1}. Due: ${p.due_date} | Ref: ${p.reference_month}/${p.reference_year} | Status: ${p.status}`);
    });

    const idsToDelete = paymentsToDelete.map(p => p.id);
    
    console.log(`  🔥 EXECUTANDO DELEÇÃO de ${idsToDelete.length} pagamentos...`);

    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("❌ Erro ao deletar recebimentos:", deleteError);
      throw deleteError;
    }

    console.log(`  ✅ ${paymentsToDelete.length} pagamentos deletados com SUCESSO!`);
  } else {
    console.log("  ℹ️ Nenhum pagamento encontrado para deletar");
  }

  // ==========================================
  // PASSO 8: RECALCULAR números de parcelas
  // ==========================================
  console.log("\n🔢 PASSO 8: RECALCULAR números de parcelas");

  // ⚠️ 05/out/2026 (regra do Cadu): só as PARCELAS DE ALUGUEL têm número.
  // O recebimento de Rescisão (caução) e o recebimento só de proporcional e
  // multa sobre um mês já pago ficam sem número. Antes, TODOS os recebimentos
  // eram renumerados juntos -- a LEMOS APTO 05 terminou em "13/13" com o
  // caução contado como parcela 12, num contrato que acabou na 10ª parcela.
  const { data: remainingPayments, error: remainingError } = await (supabase as any)
    .from("payments")
    .select("id, due_date, installment, total_installments, payment_kind")
    .eq("rental_id", rentalId)
    .order("due_date", { ascending: true })
    .order("installment", { ascending: true });

  if (remainingError) {
    console.error("❌ Erro ao buscar pagamentos restantes:", remainingError);
    throw remainingError;
  }

  const parcelas = (remainingPayments || []).filter(
    (p: any) => (p.payment_kind || "rent") === "rent" && p.installment !== null && p.installment !== undefined
  );
  const semNumero = (remainingPayments || []).filter((p: any) => !parcelas.includes(p));

  const newTotalInstallments = parcelas.length;
  console.log(`  📊 Total de parcelas de aluguel: ${newTotalInstallments}`);

  for (let i = 0; i < parcelas.length; i++) {
    const newInstallmentNumber = i + 1;
    const payment = parcelas[i];
    if (payment.installment === newInstallmentNumber && payment.total_installments === newTotalInstallments) continue;

    const { error: updateInstallmentError } = await supabase
      .from("payments")
      .update({
        installment: newInstallmentNumber,
        total_installments: newTotalInstallments
      })
      .eq("id", payment.id);

    if (updateInstallmentError) {
      console.error(`  ❌ Erro ao atualizar parcela ${newInstallmentNumber}:`, updateInstallmentError);
      throw updateInstallmentError;
    }
  }

  if (semNumero.length > 0) {
    const { error: erroSemNumero } = await supabase
      .from("payments")
      .update({ installment: null, total_installments: null })
      .in("id", semNumero.map((p: any) => p.id));
    if (erroSemNumero) throw erroSemNumero;
  }

  console.log(`  ✅ Todos os ${newTotalInstallments} pagamentos atualizados!`);

  // ==========================================
  // RESUMO FINAL
  // ==========================================
  console.log("\n" + "═".repeat(80));
  console.log("🎉 RESUMO DA RESCISÃO");
  console.log("═".repeat(80));
  
  console.log(`✅ Recebimento do mês: ${recebimentoDoMes ? (jaPago ? "já pago (não mexido)" : `${recebimentoDoMes.status} (cobrança da rescisão somada nele)`) : "não existia"}`);
  console.log(`✅ Recebimento de Rescisão (${terminationDate}): R$ ${totalRescisao.toFixed(2)} (aba Cauções)`);
  
  console.log(`✅ Dias proporcionais cobrados: ${daysUsed} dias`);
  console.log(`✅ Pagamentos deletados: ${paymentsToDelete?.length || 0}`);
  console.log(`✅ Total de parcelas recalculado: ${newTotalInstallments}`);
  console.log(`✅ Data fim do contrato: ${terminationDate}`);
  console.log("═".repeat(80));
  console.log("🏁 FIM processContractTermination");
  console.log("═".repeat(80) + "\n");
}

export async function calculateTerminationValues(rentalId: string) {
  console.log("🔍 Buscando dados da locação para rescisão:", rentalId);

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select(`
      id,
      property_id,
      tenant_id,
      start_date,
      end_date,
      value,
      monthly_rent,
      deposit_amount,
      deposit_installments,
      deposit_installment1,
      deposit_installment2,
      deposit_installment3,
      has_garage,
      garage_value,
      properties!rentals_property_id_fkey (
        id,
        location_id,
        complement,
        locations!properties_location_id_fkey (
          id,
          name
        )
      ),
      tenants!rentals_tenant_id_fkey (
        id,
        name
      )
    `)
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    console.error("❌ Erro ao buscar locação:", rentalError);
    throw new Error("Locação não encontrada");
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, status, expected_amount, paid_amount, payment_date, reference_month, reference_year")
    .eq("rental_id", rentalId)
    .order("reference_year", { ascending: true })
    .order("reference_month", { ascending: true });

  if (paymentsError) {
    console.error("❌ Erro ao buscar pagamentos:", paymentsError);
    throw paymentsError;
  }
}