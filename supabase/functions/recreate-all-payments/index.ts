import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface Rental {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  rent_due_day: number;
  status: string;
  properties: {
    property_identifier: string;
    locations: {
      name: string;
    };
  };
  tenants: {
    name: string;
  };
}

interface Payment {
  id: string;
  due_date: string;
  status: string;
  expected_amount: number;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 Iniciando recriação de TODOS os recebimentos...\n");

    // Buscar TODAS as locações ativas
    const { data: rentals, error: rentalsError } = await supabase
      .from("rentals")
      .select(`
        id,
        property_id,
        tenant_id,
        start_date,
        end_date,
        rent_amount,
        rent_due_day,
        status,
        properties!inner(
          property_identifier,
          locations!inner(name)
        ),
        tenants!inner(name)
      `)
      .eq("status", "active")
      .order("start_date");

    if (rentalsError) {
      throw new Error(`Erro ao buscar locações: ${rentalsError.message}`);
    }

    if (!rentals || rentals.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma locação ativa encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Total de locações ativas: ${rentals.length}
`);

    const summary = {
      rentalsProcessed: 0,
      paymentsCreated: 0,
      paymentsSkipped: 0,
      errors: [] as string[],
    };

    // Processar cada locação
    for (const rental of rentals as Rental[]) {
      try {
        const locationName = rental.properties.locations.name;
        const propertyName = rental.properties.property_identifier;
        const tenantName = rental.tenants.name;

        console.log(`
🏠 ============================================`);
        console.log(`🏠 PROCESSANDO LOCAÇÃO ${summary.rentalsProcessed + 1}/${rentals.length}`);
        console.log(`🏠 ${locationName} - ${propertyName}`);
        console.log(`🏠 Inquilino: ${tenantName}`);
        console.log(`🏠 Período: ${rental.start_date} a ${rental.end_date}`);
        console.log(`🏠 Aluguel: R$ ${rental.rent_amount.toFixed(2)}`);
        console.log(`🏠 Vencimento: Dia ${rental.rent_due_day}`);
        console.log(`🏠 ============================================`);

        // Buscar recebimentos PAGOS desta locação
        const { data: paidPayments, error: paymentsError } = await supabase
          .from("payments")
          .select("id, due_date, status, expected_amount")
          .eq("rental_id", rental.id)
          .eq("status", "paid")
          .order("due_date");

        if (paymentsError) {
          throw new Error(`Erro ao buscar recebimentos: ${paymentsError.message}`);
        }

        const paidPaymentsMap = new Map<string, Payment>();
        if (paidPayments) {
          paidPayments.forEach((payment: Payment) => {
            const monthKey = payment.due_date.substring(0, 7); // YYYY-MM
            paidPaymentsMap.set(monthKey, payment);
          });
          console.log(`💰 Recebimentos PAGOS existentes: ${paidPayments.length}`);
        }

        // Gerar recebimentos esperados
        const startDate = new Date(rental.start_date + "T00:00:00");
        const endDate = new Date(rental.end_date + "T00:00:00");
        
        // Calcular total de meses
        const totalMonths = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        );

        console.log(`📅 Total de meses do contrato: ${totalMonths}`);

        const paymentsToCreate = [];
        let installmentNumber = 1;

        // Iterar mês a mês
        for (let monthOffset = 0; monthOffset < totalMonths + 1; monthOffset++) {
          const currentMonth = startDate.getMonth() + monthOffset;
          const currentYear = startDate.getFullYear() + Math.floor(currentMonth / 12);
          const normalizedMonth = currentMonth % 12;

          // Criar data de vencimento
          const dueDate = new Date(currentYear, normalizedMonth, rental.rent_due_day);
          
          // Se a data de vencimento for antes da data de início, pular
          if (dueDate < startDate) {
            continue;
          }

          // Se a data de vencimento for depois da data de término, parar
          if (dueDate > endDate) {
            break;
          }

          const dueDateStr = dueDate.toISOString().split("T")[0];
          const monthKey = dueDateStr.substring(0, 7); // YYYY-MM

          // Verificar se JÁ EXISTE recebimento PAGO neste mês
          if (paidPaymentsMap.has(monthKey)) {
            console.log(`✅ Mês ${monthKey} JÁ TEM recebimento PAGO - Pulando`);
            summary.paymentsSkipped++;
            installmentNumber++;
            continue;
          }

          // Calcular valor (proporcional se for primeira ou última parcela)
          let amount = rental.rent_amount;
          let description = `${installmentNumber}/${totalMonths}`;

          // Primeira parcela proporcional
          if (monthOffset === 0 && startDate.getDate() > 1) {
            const daysInMonth = new Date(currentYear, normalizedMonth + 1, 0).getDate();
            const daysToCharge = daysInMonth - startDate.getDate() + 1;
            amount = (rental.rent_amount / daysInMonth) * daysToCharge;
            description = `Parcela Proporcional (${daysToCharge} dias)`;
            console.log(`📊 Primeira parcela PROPORCIONAL: ${daysToCharge} dias de ${daysInMonth}`);
          }

          // Última parcela proporcional
          const isLastPayment = dueDate >= endDate || monthOffset === totalMonths;
          if (isLastPayment && endDate.getDate() < new Date(currentYear, normalizedMonth + 1, 0).getDate()) {
            const daysInMonth = new Date(currentYear, normalizedMonth + 1, 0).getDate();
            const daysToCharge = endDate.getDate();
            amount = (rental.rent_amount / daysInMonth) * daysToCharge;
            description = `Parcela Proporcional (${daysToCharge} dias)`;
            console.log(`📊 Última parcela PROPORCIONAL: ${daysToCharge} dias de ${daysInMonth}`);
          }

          console.log(`➕ CRIAR: ${dueDateStr} | ${description} | R$ ${amount.toFixed(2)}`);

          paymentsToCreate.push({
            rental_id: rental.id,
            expected_amount: amount,
            due_date: dueDateStr,
            installment: installmentNumber,
            total_installments: totalMonths,
            reference_month: normalizedMonth + 1,
            reference_year: currentYear,
            status: "pending",
            notes: description,
          });

          installmentNumber++;
        }

        // Criar recebimentos em lote
        if (paymentsToCreate.length > 0) {
          const { error: insertError } = await supabase
            .from("payments")
            .insert(paymentsToCreate);

          if (insertError) {
            throw new Error(`Erro ao criar recebimentos: ${insertError.message}`);
          }

          console.log(`✅ ${paymentsToCreate.length} recebimentos criados com sucesso!`);
          summary.paymentsCreated += paymentsToCreate.length;
        } else {
          console.log(`ℹ️ Nenhum recebimento a criar (todos os meses já têm pagos)`);
        }

        summary.rentalsProcessed++;

      } catch (error) {
        const errorMsg = `Erro ao processar locação ${rental.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    console.log(`

🎉 ============================================`);
    console.log(`🎉 RECRIAÇÃO CONCLUÍDA COM SUCESSO!`);
    console.log(`🎉 ============================================`);
    console.log(`📋 Locações processadas: ${summary.rentalsProcessed}/${rentals.length}`);
    console.log(`➕ Recebimentos criados: ${summary.paymentsCreated}`);
    console.log(`⏭️ Recebimentos pulados (já pagos): ${summary.paymentsSkipped}`);
    console.log(`❌ Erros: ${summary.errors.length}`);

    if (summary.errors.length > 0) {
      console.log(`
⚠️ ERROS ENCONTRADOS:`);
      summary.errors.forEach((error) => console.log(`   - ${error}`));
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Erro fatal:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});