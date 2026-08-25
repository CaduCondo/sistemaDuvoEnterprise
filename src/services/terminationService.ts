import { supabase } from "@/integrations/supabase/client";
import { parseISO, getMonth, getYear, differenceInDays } from "date-fns";
import { calculateCorrectedDeposit } from "./igpmService";
import { calcularProporcionalAluguelEGaragem } from "@/lib/rentalCalculations";

/** dd/mm/aaaa — o formato que o Cadu le. Datas ISO nao aparecem para o usuario. */
function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

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
    .select("paid_amount, status")
    .eq("rental_id", rentalId);

  if (erroParcelas) {
    console.error("  ❌ Erro ao buscar parcelas de caucao:", erroParcelas);
    throw erroParcelas;
  }

  const caucaoPago = (parcelasCaucao || []).reduce(
    (soma, parcela) => soma + Number(parcela.paid_amount || 0),
    0
  );

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

    // --- UM UNICO Recebimento de Aluguel ---
    //
    // ⚠️ Ate 25/ago/2026 esta regra criava DOIS recebimentos de aluguel no
    // mesmo mes: um com o mes cheio e outro com o proporcional + multa. Na
    // tela isso virava duas linhas "Pendente" quase iguais, e o usuario tinha
    // que abrir as duas para entender a conta.
    //
    // Agora e um so, com todas as linhas dentro. A rescisao passa a gerar
    // exatamente DOIS recebimentos no total: este (aluguel) e o de rescisao.
    console.log("\n  📄 CRIANDO O RECEBIMENTO DE ALUGUEL (mes cheio + proporcional + multa):");

    const notaPeriodo = `${daysUsed} Dias Extras - ${formatarData(lastPaymentDate)} a ${formatarData(terminationDateObj)}`;

    const breakdownAluguel: Array<any> = [];

    breakdownAluguel.push({
      description: "Aluguel - Mês Cheio",
      amount: monthlyRent,
      type: "addition"
    });

    breakdownAluguel.push({
      description: "Aluguel - Proporcional",
      amount: proportionalRentOnly,
      type: "addition",
      nota: notaPeriodo
    });

    if (garageValue > 0) {
      breakdownAluguel.push({
        description: "Garagem - Mês Cheio",
        amount: garageValue,
        type: "addition"
      });

      breakdownAluguel.push({
        description: "Garagem - Proporcional",
        amount: proportionalGarage,
        type: "addition",
        nota: notaPeriodo
      });
    }

    if (penaltyAmount > 0) {
      breakdownAluguel.push({
        description: "Multa Rescisória",
        amount: penaltyAmount,
        type: "addition"
      });
    }

    const totalAluguel =
      Math.round(
        (monthlyRent + garageValue + proportionalRentOnly + proportionalGarage + penaltyAmount) * 100
      ) / 100;

    console.log(`    Vencimento: ${terminationDate}`);
    console.log(`    Total: R$ ${totalAluguel.toFixed(2)}`);

    const { error: erroAluguel } = await supabase
      .from("payments")
      .insert({
        rental_id: rentalId,
        due_date: terminationDate,
        expected_amount: totalAluguel,
        reference_month: String(terminationMonth).padStart(2, "0"),
        reference_year: String(terminationYear),
        status: "pending",
        payment_kind: "rent",
        termination_group_id: grupoRescisao,
        breakdown: breakdownAluguel,
        notes: `Rescisão de Contrato - Data de saída: ${terminationDate}.`
      });

    if (erroAluguel) {
      console.error("    ❌ Erro ao criar o Recebimento de Aluguel:", erroAluguel);
      throw erroAluguel;
    }

    console.log("    ✅ Recebimento de Aluguel criado!");

  } else {
    // ========== REGRA 2: RESCISÃO ANTERIOR AO VENCIMENTO ==========
    console.log("\n  🔵 REGRA 2: Atualizar recebimento existente do mês");
    
    const dueDateStr = terminationDate;
    
    console.log(`    Novo vencimento: ${dueDateStr}`);
    
    const breakdown: Array<any> = [];
    
    const notaPeriodo = `${daysUsed} Dias Extras - ${formatarData(lastPaymentDate)} a ${formatarData(terminationDateObj)}`;

    breakdown.push({
      description: "Aluguel Proporcional",
      amount: proportionalRentOnly,
      type: "addition",
      nota: notaPeriodo
    });

    // Linha própria para a garagem, como no recebimento mensal normal.
    if (proportionalGarage > 0) {
      breakdown.push({
        description: "Garagem Proporcional",
        amount: proportionalGarage,
        type: "addition",
        nota: notaPeriodo
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
        description: "Valor Corrigido p/ Devolução (Taxa da Poupança)",
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