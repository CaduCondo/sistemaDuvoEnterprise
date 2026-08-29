import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Payment, Rental, Property, Tenant, DepositInstallment as DepositInstallmentType } from "@/types";
import { getAllDepositInstallments } from "@/services/depositInstallmentService";

export const usePayments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const loadingRef = useRef(false);

  const loadPayments = useCallback(async (month: string = "all", year: string = "all") => {
    if (loadingRef.current) return;

    try {
      setLoading(true);
      loadingRef.current = true;

      console.log(`🔄 [usePayments] Buscando recebimentos do banco... (mês: ${month}, ano: ${year})`);

      // ✅ Intervalo de datas usado tanto para os recebimentos de aluguel
      // (payments) quanto para os de caução (deposit_installments) - os dois
      // aparecem juntos na mesma tela, cada um no mês da sua própria data de
      // vencimento.
      let dateRange: { startDate: string; endDate: string } | null = null;
      if (month !== "all" && year !== "all") {
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const startDate = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
        console.log(`🔍 [usePayments] Aplicando filtro de data: ${startDate} até ${endDate}`);
        dateRange = { startDate, endDate };
      } else {
        console.log(`🔍 [usePayments] SEM FILTRO - buscando TODOS os registros`);
      }

      // 1. Buscar payments (aluguel) COM FILTRO de mês/ano aplicado no banco
      let paymentsQuery = supabase
        .from("payments")
        .select("*")
        .order("due_date", { ascending: false });

      if (dateRange) {
        paymentsQuery = paymentsQuery.gte("due_date", dateRange.startDate).lte("due_date", dateRange.endDate);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;

      if (paymentsError) {
        console.error("❌ [usePayments] Erro ao buscar payments:", paymentsError);
        throw paymentsError;
      }

      console.log(`✅ [usePayments] Payments (aluguel) carregados do banco: ${paymentsData?.length || 0}`);

      // 1b. Buscar deposit_installments (caução) com o MESMO filtro de mês/ano,
      // pra aparecerem juntos com os recebimentos de aluguel nesta tela.
      let depositsQuery = supabase
        .from("deposit_installments")
        .select("*")
        .order("due_date", { ascending: false });

      if (dateRange) {
        depositsQuery = depositsQuery.gte("due_date", dateRange.startDate).lte("due_date", dateRange.endDate);
      }

      const { data: depositsData, error: depositsError } = await depositsQuery;

      if (depositsError) {
        console.error("❌ [usePayments] Erro ao buscar deposit_installments:", depositsError);
        throw depositsError;
      }

      console.log(`✅ [usePayments] Cauções carregadas do banco: ${depositsData?.length || 0}`);

      if ((!paymentsData || paymentsData.length === 0) && (!depositsData || depositsData.length === 0)) {
        console.warn(`⚠️ [usePayments] NENHUM recebimento retornado - tabelas vazias ou filtro muito restritivo`);
        setPayments([]);
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      // 2. Buscar rentals únicos (dos payments E dos deposit_installments juntos)
      const uniqueRentalIds = [...new Set([
        ...(paymentsData || []).map(p => p.rental_id),
        ...(depositsData || []).map(d => d.rental_id),
      ].filter(Boolean))];
      console.log(`🔍 [usePayments] Buscando ${uniqueRentalIds.length} rentals únicos...`);

      const { data: rentalsData, error: rentalsError } = await supabase
        .from("rentals")
        .select(`
          id,
          property_id,
          tenant_id,
          start_date,
          end_date,
          rent_value,
          rent_due_day,
          status,
          is_active
        `)
        .in("id", uniqueRentalIds);

      if (rentalsError) {
        console.error("❌ [usePayments] Erro ao buscar rentals:", rentalsError.message);
        throw rentalsError;
      }

      console.log(`✅ [usePayments] Rentals carregados: ${rentalsData?.length || 0}`);

      // 3. ⚡ OTIMIZAÇÃO: Buscar TODAS as properties de uma vez (1 query)
      const uniquePropertyIds = [...new Set(rentalsData?.map(r => r.property_id).filter(Boolean) || [])];
      console.log(`🔍 [usePayments] Buscando ${uniquePropertyIds.length} properties ÚNICAS em LOTE...`);

      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select(`
          id,
          location_id,
          property_identifier,
          complement,
          description,
          value,
          status,
          rooms,
          bathrooms,
          area,
          locations!properties_location_id_fkey(name)
        `)
        .in("id", uniquePropertyIds);

      if (propertiesError) {
        console.error("❌ [usePayments] Erro ao buscar properties:", propertiesError.message, propertiesError);
        throw new Error(`Erro ao buscar imóveis: ${propertiesError.message}`);
      }

      console.log(`✅ [usePayments] Properties carregadas em LOTE: ${propertiesData?.length || 0}`);

      // 🔍 DEBUG: Mostrar 1 property de exemplo para verificar estrutura
      if (propertiesData && propertiesData.length > 0) {
        console.log("🔎 [DEBUG] Exemplo de 1 property BRUTA do banco:", JSON.stringify(propertiesData[0], null, 2));
      }

      // 4. ⚡ OTIMIZAÇÃO: Buscar TODOS os tenants de uma vez (1 query)
      const uniqueTenantIds = [...new Set(rentalsData?.map(r => r.tenant_id).filter(Boolean) || [])];
      console.log(`🔍 [usePayments] Buscando ${uniqueTenantIds.length} tenants ÚNICOS em LOTE...`);

      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name, cpf, phone, email, status")
        .in("id", uniqueTenantIds);

      if (tenantsError) {
        console.error("❌ [usePayments] Erro ao buscar tenants:", tenantsError.message, tenantsError);
        throw new Error(`Erro ao buscar inquilinos: ${tenantsError.message}`);
      }

      console.log(`✅ [usePayments] Tenants carregados em LOTE: ${tenantsData?.length || 0}`);

      // 🔍 DEBUG: Mostrar 1 tenant de exemplo para verificar estrutura
      if (tenantsData && tenantsData.length > 0) {
        console.log("🔎 [DEBUG] Exemplo de 1 tenant BRUTO do banco:", JSON.stringify(tenantsData[0], null, 2));
      }

      // 5. ⚡ Criar MAPs para lookup O(1) em vez de .find() O(n)
      const rentalsMap = new Map(rentalsData?.map(r => [r.id, r]) || []);
      const propertiesMap = new Map(propertiesData?.map(p => [p.id, p]) || []);
      const tenantsMap = new Map(tenantsData?.map(t => [t.id, t]) || []);

      console.log("🗺️ [usePayments] Maps criados para lookup rápido");

      // 6. Mapear payments com dados relacionados (lookup O(1))
      const mappedPayments = (paymentsData || []).map((payment): Payment => {
        const rental = rentalsMap.get(payment.rental_id);
        const property = rental ? propertiesMap.get(rental.property_id) : null;
        const tenant = rental ? tenantsMap.get(rental.tenant_id) : null;

        // ✅ CORREÇÃO: Converter attachments JSON para array de strings (urls).
        // Anexos são salvos como objetos { url, name, description } — o filtro
        // antigo só aceitava strings puras e descartava TODOS os objetos,
        // fazendo a coluna "Anexo" sempre mostrar "Não" mesmo quando existia.
        let attachmentsArray: string[] = [];
        if (payment.attachments && Array.isArray(payment.attachments)) {
          attachmentsArray = (payment.attachments as any[])
            .map((item) => (typeof item === "string" ? item : item?.url))
            .filter((url): url is string => typeof url === "string" && url.length > 0);
        }

        // ✅ CORREÇÃO CRÍTICA: Calcular referenceMonth e referenceYear SEMPRE a partir de due_date
        // NÃO usar payment.reference_month/reference_year do banco (podem estar incorretos)
        const dueDate = new Date(payment.due_date + "T12:00:00"); // Add time para evitar timezone issues
        const calculatedMonth = dueDate.getMonth() + 1; // 1-12
        const calculatedYear = dueDate.getFullYear();

        return {
          id: payment.id,
          rentalId: payment.rental_id,
          propertyId: rental?.property_id || "",
          tenantId: rental?.tenant_id || "",
          referenceMonth: calculatedMonth,
          referenceYear: calculatedYear,
          dueDate: payment.due_date,
          paymentDate: payment.payment_date || null,
          paymentTime: payment.payment_time || null,
          expectedAmount: payment.expected_amount || 0,
          // Tipo do recebimento (#49). Sem isto, a lista de Recebimentos nao
          // consegue distinguir o Recebimento de Rescisao do de aluguel e a
          // etiqueta "Rescisão" acabava no registro errado. Recebimentos
          // anteriores a migracao vem nulos e valem como 'rent'.
          paymentKind: (payment as any).payment_kind || "rent",
          paidAmount: payment.paid_amount || 0,
          status: payment.status as "pending" | "paid" | "overdue" | "partial",
          paymentMethod: payment.payment_method || null,
          notes: payment.notes || null,
          lateFee: 0,
          interest: 0,
          breakdown: null,
          attachments: attachmentsArray,
          partialPayments: Array.isArray(payment.partial_payments) ? payment.partial_payments : [],
          pixCode: payment.pix_code || null,
          installment: payment.installment || 1,
          totalInstallments: payment.total_installments || 1,
          property: property ? {
            id: property.id,
            locationId: property.location_id,
            location: property.locations?.name || "",
            complement: property.complement || "",
            propertyIdentifier: property.property_identifier || "",
            description: property.description || "",
            rooms: property.rooms || 0,
            bathrooms: property.bathrooms || 0,
            area: property.area || 0,
            value: property.value || 0,
            hasGarage: false,
            hasFurniture: false,
            acceptsPets: false,
            status: property.status as "available" | "occupied" | "unavailable",
            images: [],
            createdAt: "",
            address: "",
            features: [],
          } : undefined,
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email || "",
            phone: tenant.phone || "",
            cpf: tenant.cpf || "",
            rg: "",
            status: "rented" as const,
            createdAt: "",
          } : undefined,
          rental: rental ? {
            id: rental.id,
            propertyId: rental.property_id,
            tenantId: rental.tenant_id,
            startDate: rental.start_date,
            endDate: rental.end_date || null,
            monthlyRent: rental.rent_value,
            paymentDay: rental.rent_due_day,
            status: (rental.status === "inactive" ? "ended" : rental.status) as "active" | "terminated" | "ended",
            value: rental.rent_value,
            depositAmount: 0,
            isActive: rental.is_active || false,
            hasGarage: false,
            hasPartnerBroker: false,
            attachments: [],
            contractAttachments: [],
          } : undefined,
        };
      });

      console.log(`✅ [usePayments] ${mappedPayments.length} payments mapeados com sucesso`);

      // 🔍 DEBUG: Mostrar 1 payment MAPEADO de exemplo para verificar o resultado final
      if (mappedPayments.length > 0) {
        console.log("🔎 [DEBUG] Exemplo de 1 payment MAPEADO:");
        console.log("   - ID:", mappedPayments[0].id);
        console.log("   - Property:", mappedPayments[0].property ? {
          id: mappedPayments[0].property.id,
          location: mappedPayments[0].property.location,
          complement: mappedPayments[0].property.complement,
          propertyIdentifier: mappedPayments[0].property.propertyIdentifier,
        } : "UNDEFINED");
        console.log("   - Tenant:", mappedPayments[0].tenant ? {
          id: mappedPayments[0].tenant.id,
          name: mappedPayments[0].tenant.name,
        } : "UNDEFINED");
      }

      // 7. Mapear deposit_installments (caução) no MESMO formato "Payment",
      // usando os mesmos maps de rental/property/tenant já buscados acima -
      // assim eles aparecem juntos na tela de Recebimentos, com isDeposit
      // marcando quais são caução (pra mostrar a etiqueta e abrir a tela certa
      // ao clicar).
      const mappedDeposits = (depositsData || []).map((installment): Payment => {
        const rental = rentalsMap.get(installment.rental_id);
        const property = rental ? propertiesMap.get(rental.property_id) : null;
        const tenant = rental ? tenantsMap.get(rental.tenant_id) : null;

        const dueDate = new Date(installment.due_date + "T12:00:00");
        const calculatedMonth = dueDate.getMonth() + 1;
        const calculatedYear = dueDate.getFullYear();

        const depositInstallment: DepositInstallmentType = {
          id: installment.id,
          rental_id: installment.rental_id,
          installment_number: installment.installment_number,
          total_installments: installment.installment_total,
          amount: installment.amount,
          due_date: installment.due_date,
          payment_date: installment.payment_date,
          paid_amount: installment.paid_amount || 0,
          payment_method: installment.payment_method,
          status: installment.status as "pending" | "paid" | "partial" | "overdue",
          notes: installment.notes,
          attachments: Array.isArray(installment.attachments) ? installment.attachments : [],
          pix_code: installment.pix_code || null,
          partial_payments: Array.isArray(installment.partial_payments)
            ? (installment.partial_payments as unknown as DepositInstallmentType["partial_payments"])
            : [],
          penalty_amount: installment.penalty_amount ?? null,
          interest_amount: installment.interest_amount ?? null,
          created_at: installment.created_at,
          updated_at: installment.updated_at,
        };

        return {
          id: installment.id,
          rentalId: installment.rental_id,
          propertyId: rental?.property_id || "",
          tenantId: rental?.tenant_id || "",
          referenceMonth: calculatedMonth,
          referenceYear: calculatedYear,
          dueDate: installment.due_date,
          paymentDate: installment.payment_date || null,
          expectedAmount: installment.amount || 0,
          paidAmount: installment.paid_amount || 0,
          status: installment.status as "pending" | "paid" | "overdue" | "partial",
          paymentMethod: installment.payment_method || null,
          notes: installment.notes || null,
          lateFee: 0,
          interest: 0,
          breakdown: null,
          attachments: Array.isArray(installment.attachments) ? installment.attachments : [],
          pixCode: installment.pix_code || null,
          installment: installment.installment_number || 1,
          totalInstallments: installment.installment_total || 1,
          isDeposit: true,
          depositInstallment,
          property: property ? {
            id: property.id,
            locationId: property.location_id,
            location: property.locations?.name || "",
            complement: property.complement || "",
            propertyIdentifier: property.property_identifier || "",
            description: property.description || "",
            rooms: property.rooms || 0,
            bathrooms: property.bathrooms || 0,
            area: property.area || 0,
            value: property.value || 0,
            hasGarage: false,
            hasFurniture: false,
            acceptsPets: false,
            status: property.status as "available" | "occupied" | "unavailable",
            images: [],
            createdAt: "",
            address: "",
            features: [],
          } : undefined,
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email || "",
            phone: tenant.phone || "",
            cpf: tenant.cpf || "",
            rg: "",
            status: "rented" as const,
            createdAt: "",
          } : undefined,
          rental: rental ? {
            id: rental.id,
            propertyId: rental.property_id,
            tenantId: rental.tenant_id,
            startDate: rental.start_date,
            endDate: rental.end_date || null,
            monthlyRent: rental.rent_value,
            paymentDay: rental.rent_due_day,
            status: (rental.status === "inactive" ? "ended" : rental.status) as "active" | "terminated" | "ended",
            value: rental.rent_value,
            depositAmount: 0,
            isActive: rental.is_active || false,
            hasGarage: false,
            hasPartnerBroker: false,
            attachments: [],
            contractAttachments: [],
          } : undefined,
        };
      });

      console.log(`✅ [usePayments] ${mappedDeposits.length} cauções mapeadas com sucesso`);

      setPayments([...mappedPayments, ...mappedDeposits]);

    } catch (error) {
      console.error("❌ [usePayments] Erro ao carregar recebimentos:", error);
      // ✅ CORREÇÃO: Mostrar mensagem real do erro, não "Object"
      if (error instanceof Error) {
        console.error("❌ [usePayments] Mensagem:", error.message);
        console.error("❌ [usePayments] Stack:", error.stack);
      }
      setPayments([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [toast]);

  const handleCancelPayment = useCallback(async (paymentId: string) => {
    try {
      // Cancelar apenas payment regular (aluguel)
      const { error } = await supabase
        .from("payments")
        .update({
          status: "pending",
          payment_date: null,
          payment_time: null,
          paid_amount: 0,
          payment_method: null,
          attachments: null,
          // ✅ CORREÇÃO (pedido do Cadu): cancelar o recebimento também apaga o
          // histórico de pagamentos parciais - senão os recibos antigos
          // continuavam aparecendo mesmo depois do cancelamento.
          partial_payments: [],
        })
        .eq("id", paymentId);

      if (error) throw error;

      toast({
        title: "Recebimento cancelado",
        description: "O recebimento foi cancelado com sucesso.",
      });

    } catch (error) {
      console.error("Error canceling payment:", error);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar recebimento",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
      });
      throw error;
    }
  }, [toast]);

  // ✅ Carregar payments do mês/ano ATUAL na montagem (como era antes)
  useEffect(() => {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString();
    const currentYear = now.getFullYear().toString();
    
    console.log(`📅 [usePayments] Hook montado - carregando mês ATUAL: ${currentMonth}/${currentYear}`);
    loadPayments(currentMonth, currentYear);
  }, []); // Dependências vazias = executa UMA vez na montagem

  return {
    payments,
    rentals,
    properties,
    tenants,
    loading,
    handleCancelPayment,
    loadPayments,
  };
};