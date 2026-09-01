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
    .select("start_date")
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
  // PASSO 5: NOVA LÓGICA - Criar/Atualizar recebimentos
  // ==========================================
  console.log("\n📝 PASSO 5: Criar/Atualizar recebimentos");

  if (isAfterDueDate) {
    // ========== REGRA 1: RESCISÃO POSTERIOR AO VENCIMENTO ==========
    console.log("\n  🔵 REGRA 1: Criar 2 recebimentos no mesmo mês");
    
    // ✅ SOLUÇÃO DEFINITIVA: DELETAR TODOS os recebimentos PENDING do mês ANTES de criar os novos
    console.log("\n  🗑️ PASSO CRÍTICO: Deletar TODOS os recebimentos PENDING do mês da rescisão");
    
    const { data: pendingPayments, error: fetchPendingError } = await supabase
      .from("payments")
      .select("id, due_date, status, expected_amount, installment")
      .eq("rental_id", rentalId)
      .eq("reference_month", String(terminationMonth).padStart(2, "0"))
      .eq("reference_year", String(terminationYear))
      .eq("status", "pending");

    if (fetchPendingError) {
      console.error("    ❌ Erro ao buscar recebimentos pending:", fetchPendingError);
      throw fetchPendingError;
    }

    if (pendingPayments && pendingPayments.length > 0) {
      console.log(`  ⚠️ Encontrados ${pendingPayments.length} recebimento(s) PENDING no mês ${terminationMonth}/${terminationYear}`);
      pendingPayments.forEach((p, idx) => {
        console.log(`    ${idx + 1}. ID: ${p.id} | Due: ${p.due_date} | Amount: ${p.expected_amount} | Installment: ${p.installment}`);
      });

      console.log(`  🔥 Deletando TODOS os ${pendingPayments.length} recebimentos PENDING...`);
      
      const { error: deleteAllError } = await supabase
        .from("payments")
        .delete()
        .in("id", pendingPayments.map(p => p.id));

      if (deleteAllError) {
        console.error("    ❌ Erro ao deletar recebimentos pending:", deleteAllError);
        throw deleteAllError;
      }
      
      console.log("    ✅ Todos os recebimentos PENDING deletados com sucesso!");
    } else {
      console.log("  ℹ️ Nenhum recebimento PENDING encontrado no mês");
    }

    // --- Recebimento 1: Aluguel cheio no vencimento normal ---
    console.log("\n  📄 CRIANDO RECEBIMENTO 1 (Aluguel Cheio):");
    const dueDate1 = new Date(terminationYear, terminationMonth - 1, paymentDay);
    const dueDateStr1 = dueDate1.toISOString().split("T")[0];
    
    console.log(`    Vencimento: ${dueDateStr1}`);
    console.log(`    Valor: R$ ${fullMonthRent.toFixed(2)}`);
    console.log(`    Installment: 1`);
    
    const { error: createError1 } = await supabase
      .from("payments")
      .insert({
        rental_id: rentalId,
        due_date: dueDateStr1,
        expected_amount: fullMonthRent,
        reference_month: String(terminationMonth).padStart(2, "0"),
        reference_year: String(terminationYear),
        status: "pending",
        installment: 1, // ✅ CORREÇÃO DEFINITIVA: usar installment 1
        total_installments: 2, // ✅ Total de 2 recebimentos neste mês
        payment_kind: "rent",
        termination_group_id: grupoRescisao,
        breakdown: garageValue > 0
          ? [
              {
                description: `Aluguel Mês ${terminationMonth}/${terminationYear}`,
                amount: monthlyRent,
                type: "addition"
              },
              {
                description: `Garagem Mês ${terminationMonth}/${terminationYear}`,
                amount: garageValue,
                type: "addition"
              }
            ]
          : [
              {
                description: `Aluguel Mês ${terminationMonth}/${terminationYear}`,
                amount: fullMonthRent,
                type: "addition"
              }
            ]
      });

    if (createError1) {
      console.error("    ❌ Erro ao criar recebimento 1:", createError1);
      console.error("    📋 Detalhes do erro:", JSON.stringify(createError1, null, 2));
      throw createError1;
    }
    
    console.log("    ✅ Recebimento 1 criado com sucesso!");

    // --- Recebimento 2: Rescisão no dia da saída ---
    console.log("\n  📄 CRIANDO RECEBIMENTO 2 (Rescisão):");
    const dueDateStr2 = terminationDate;
    
    console.log(`    Vencimento: ${dueDateStr2}`);
    console.log(`    Installment: 2`);
    
    const breakdown2 = [];
    
    // A descricao da linha fica CURTA ("Aluguel Proporcional *") e o periodo
    // vai uma vez so para a legenda no rodape do bloco (28/ago/2026). Antes o
    // periodo inteiro era repetido em cada linha, o que estourava a coluna.
    const diasTexto2 = `${String(daysUsed).padStart(2, "0")} ${daysUsed === 1 ? "dia" : "dias"}`;
    const legendaProporcional2 =
      `* Proporcional de ${diasTexto2} extras - de ${lastPaymentDate.toISOString().split("T")[0]} até ${terminationDate}`;

    breakdown2.push({
      description: "Aluguel Proporcional *",
      nota: legendaProporcional2,
      amount: proportionalRentOnly,
      type: "addition"
    });

    // Linha própria para a garagem, como no recebimento mensal normal.
    if (proportionalGarage > 0) {
      breakdown2.push({
        description: "Garagem Proporcional *",
        nota: legendaProporcional2,
        amount: proportionalGarage,
        type: "addition"
      });
    }

    if (penaltyAmount > 0) {
      breakdown2.push({
        description: "Multa Rescisória",
        amount: penaltyAmount,
        type: "addition"
      });
    }

    // ⚠️ A devolucao do caucao NAO entra mais aqui (#49). Ela virou um
    // recebimento proprio, na aba Caucoes, criado no final desta funcao.
    // Enquanto ficava neste recebimento, o caucao (dinheiro de terceiro)
    // entrava na base das taxas de adm e gerenciamento.

    const totalAmount2 = Math.round((proportionalRent + penaltyAmount) * 100) / 100;
    
    console.log("    Breakdown:");
    breakdown2.forEach(item => {
      console.log(`      ${item.type === "addition" ? "+" : "-"} ${item.description}: R$ ${Math.abs(item.amount).toFixed(2)}`);
    });
    console.log(`    Total: R$ ${totalAmount2.toFixed(2)}`);

    const { error: createError2 } = await supabase
      .from("payments")
      .insert({
        rental_id: rentalId,
        due_date: dueDateStr2,
        expected_amount: totalAmount2,
        reference_month: String(terminationMonth).padStart(2, "0"),
        reference_year: String(terminationYear),
        status: "pending",
        installment: 2, // ✅ CORREÇÃO DEFINITIVA: usar installment 2 (diferente do primeiro)
        payment_kind: "rent",
        termination_group_id: grupoRescisao,
        total_installments: 2, // ✅ Total de 2 recebimentos neste mês
        breakdown: breakdown2,
        notes: `Rescisão de Contrato - Data de saída: ${terminationDate}. Despesas de reforma podem ser adicionadas na tela de Recebimentos.`
      });

    if (createError2) {
      console.error("    ❌ Erro ao criar recebimento 2:", createError2);
      console.error("    📋 Detalhes do erro:", JSON.stringify(createError2, null, 2));
      console.error("    📋 Código do erro:", createError2.code);
      console.error("    📋 Mensagem:", createError2.message);
      throw createError2;
    }
    
    console.log("    ✅ Recebimento 2 criado com sucesso!");
  } else {
    // ========== REGRA 2: RESCISÃO ANTERIOR AO VENCIMENTO ==========
    console.log("\n  🔵 REGRA 2: Atualizar recebimento existente do mês");
    
    const dueDateStr = terminationDate;
    
    console.log(`    Novo vencimento: ${dueDateStr}`);
    
    const breakdown = [];
    
    const diasTexto = `${String(daysUsed).padStart(2, "0")} ${daysUsed === 1 ? "dia" : "dias"}`;
    const legendaProporcional =
      `* Proporcional de ${diasTexto} extras - de ${lastPaymentDate.toISOString().split("T")[0]} até ${terminationDate}`;

    breakdown.push({
      description: "Aluguel Proporcional *",
      nota: legendaProporcional,
      amount: proportionalRentOnly,
      type: "addition"
    });

    // Linha própria para a garagem, como no recebimento mensal normal.
    if (proportionalGarage > 0) {
      breakdown.push({
        description: "Garagem Proporcional *",
        nota: legendaProporcional,
        amount: proportionalGarage,
        type: "addition"
      });
    }

    if (penaltyAmount > 0) {
      breakdown.push({
        description: "Multa Rescisória",
        amount: penaltyAmount,
        type: "addition"
      });
    }

    // ⚠️ A devolucao do caucao NAO entra mais aqui (#49) — ver comentario acima.

    const totalAmount = Math.round((proportionalRent + penaltyAmount) * 100) / 100;
    
    console.log("    Breakdown:");
    breakdown.forEach(item => {
      console.log(`      ${item.type === "addition" ? "+" : "-"} ${item.description}: R$ ${Math.abs(item.amount).toFixed(2)}`);
    });
    console.log(`    Total: R$ ${totalAmount.toFixed(2)}`);

    // Buscar recebimento do mês
    const { data: existingPayment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("rental_id", rentalId)
      .eq("reference_month", String(terminationMonth).padStart(2, "0"))
      .eq("reference_year", String(terminationYear))
      .maybeSingle();

    if (fetchError) {
      console.error("    ❌ Erro ao buscar recebimento:", fetchError);
      throw fetchError;
    }

    if (existingPayment) {
      console.log("    ⚙️ Atualizando recebimento existente...");
      
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          due_date: dueDateStr,
          expected_amount: totalAmount,
          breakdown: breakdown,
          payment_kind: "rent",
          termination_group_id: grupoRescisao,
          notes: `Rescisão de Contrato - Data de saída: ${terminationDate}.`,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingPayment.id);

      if (updateError) {
        console.error("    ❌ Erro ao atualizar recebimento:", updateError);
        throw updateError;
      }
      
      console.log("    ✅ Recebimento atualizado com sucesso!");
    } else {
      console.log("    ⚙️ Criando novo recebimento...");
      
      const { error: createError } = await supabase
        .from("payments")
        .insert({
          rental_id: rentalId,
          due_date: dueDateStr,
          expected_amount: totalAmount,
          reference_month: String(terminationMonth).padStart(2, "0"),
          reference_year: String(terminationYear),
          status: "pending",
          breakdown: breakdown,
          payment_kind: "rent",
          termination_group_id: grupoRescisao,
          notes: `Rescisão de Contrato - Data de saída: ${terminationDate}.`
        });

      if (createError) {
        console.error("    ❌ Erro ao criar recebimento:", createError);
        throw createError;
      }
      
      console.log("    ✅ Recebimento criado com sucesso!");
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

  if (valorDevolucao !== 0 || valorDespesas !== 0 || valorDesconto !== 0) {
    const breakdownRescisao: Array<{ description: string; amount: number; type: string }> = [];

    if (valorDevolucao !== 0) {
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
  } else {
    console.log("  ℹ️ Nada a devolver, nenhuma despesa e nenhum desconto: recebimento não criado.");
  }

  // ==========================================
  // PASSO 6: Atualizar data fim do contrato
  // ==========================================
  console.log("\n📅 PASSO 6: Atualizar data fim do contrato");
  
  const { error: updateRentalError } = await supabase
    .from("rentals")
    .update({
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

  const { data: remainingPayments, error: remainingError } = await supabase
    .from("payments")
    .select("id, due_date, installment, total_installments")
    .eq("rental_id", rentalId)
    .order("due_date", { ascending: true });

  if (remainingError) {
    console.error("❌ Erro ao buscar pagamentos restantes:", remainingError);
    throw remainingError;
  }

  if (!remainingPayments || remainingPayments.length === 0) {
    console.log("  ⚠️ ERRO: Nenhum pagamento encontrado após deleção!");
    throw new Error("Nenhum pagamento encontrado após deleção");
  }

  const newTotalInstallments = remainingPayments.length;
  console.log(`  📊 Total de parcelas CORRETO: ${newTotalInstallments}`);

  for (let i = 0; i < remainingPayments.length; i++) {
    const newInstallmentNumber = i + 1;
    const payment = remainingPayments[i];

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

  console.log(`  ✅ Todos os ${newTotalInstallments} pagamentos atualizados!`);

  // ==========================================
  // RESUMO FINAL
  // ==========================================
  console.log("\n" + "═".repeat(80));
  console.log("🎉 RESUMO DA RESCISÃO");
  console.log("═".repeat(80));
  
  if (isAfterDueDate) {
    console.log("✅ RESCISÃO POSTERIOR AO VENCIMENTO:");
    console.log(`   - Recebimento 1 (dia ${paymentDay}): R$ ${fullMonthRent.toFixed(2)} (aluguel cheio)`);
    console.log(`   - Recebimento 2 de aluguel (${terminationDate}): R$ ${(proportionalRent + penaltyAmount).toFixed(2)}`);
    console.log(`   - Recebimento de Rescisão (${terminationDate}): R$ ${totalRescisao.toFixed(2)} (aba Cauções)`);
  } else {
    console.log("✅ RESCISÃO ANTERIOR AO VENCIMENTO:");
    console.log(`   - Recebimento de aluguel (${terminationDate}): R$ ${(proportionalRent + penaltyAmount).toFixed(2)}`);
    console.log(`   - Recebimento de Rescisão (${terminationDate}): R$ ${totalRescisao.toFixed(2)} (aba Cauções)`);
  }
  
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