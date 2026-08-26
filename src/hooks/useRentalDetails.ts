import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Rental, Payment, Property, Tenant, DepositInstallment } from "@/types";
import { parseISO } from "date-fns";
import { processContractTermination } from "@/services/terminationService";

export function useRentalDetails(rentalId: string) {
  const [rental, setRental] = useState<Rental | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const loadRentalData = async () => {
    try {
      setIsLoading(true);

      console.log("=".repeat(80));
      console.log("🚀 useRentalDetails.loadRentalData INICIADO - rentalId:", rentalId);
      console.log("=".repeat(80));

      // ✅ OTIMIZAÇÃO: 1 única query com todos os dados relacionados
      const { data: rentalData, error: rentalError } = await supabase
        .from("rentals")
        .select(`
          *,
          properties!rentals_property_id_fkey (
            *,
            locations!properties_location_id_fkey (*)
          ),
          tenants!rentals_tenant_id_fkey (*),
          payments!payments_rental_id_fkey (
            *
          )
        `)
        .eq("id", rentalId)
        .single();

      if (rentalError) throw rentalError;

      console.log("=".repeat(80));
      console.log("📦 DADOS RECEBIDOS DO SUPABASE (RAW):");
      console.log("=".repeat(80));
      console.log("🔍 rentalData completo:", rentalData);
      console.log("🔍 deposit_installments:", rentalData.deposit_installments);
      console.log("=".repeat(80));

      if (!rentalData) {
        toast({
          title: "Erro",
          description: "Locação não encontrada",
          variant: "destructive",
        });
        router.push("/rentals");
        return;
      }

      // ✅ OTIMIZAÇÃO: Dados já vêm da query principal - sem queries extras!
      const propertyData = rentalData.properties;
      const tenantData = rentalData.tenants;
      const paymentsData = rentalData.payments || [];

      // Dados brutos com type casting para any para facilitar o mapeamento
      const r: any = rentalData;
      const p: any = propertyData;
      const t: any = tenantData;

      // Mapear Rental (Snake Case -> Camel Case)
      const mappedRental: Rental = {
        ...r,
        id: r.id,
        propertyId: r.property_id,
        tenantId: r.tenant_id,
        startDate: r.start_date,
        endDate: r.end_date,
        rentAmount: r.rent_value || 0,
        condominiumFee: r.condominium_fee || 0,
        iptuFee: r.iptu_fee || 0,
        depositAmount: r.deposit_amount || r.deposit || 0,
        paymentDay: r.payment_day,
        autoRenew: r.auto_renew,
        installments: r.installments,
        status: r.status as Rental["status"],
        attachments: (r.attachments as string[]) || [],
        contractAttachments: (r.contract_attachments as string[]) || [],
        depositInstallments: r.deposit_installments,
      };

      console.log("=".repeat(80));
      console.log("✅ OBJETO mappedRental CRIADO:");
      console.log("=".repeat(80));
      console.log("📋 mappedRental:", mappedRental);
      console.log("📋 depositInstallments:", mappedRental.depositInstallments);
      console.log("=".repeat(80));

      // Mapear Property
      const mappedProperty: Property = p ? {
        ...p,
        id: p.id,
        locationId: p.location_id,
        address: p.street || p.address || "",
        hasGarage: p.has_garage,
        monthlyRent: p.monthly_rent || p.value || 0,
        garageValue: p.garage_value || 0,
        hasFurniture: p.has_furniture,
        acceptsPets: p.accepts_pets,
        status: p.status as Property["status"],
        images: (p.images as string[]) || [],
      } : null;

      // Mapear Tenant
      const mappedTenant: Tenant = t ? {
        ...t,
        id: t.id,
        documentType: (t.document_type as "cpf" | "cnpj") || "cpf",
        document: t.document || t.cpf || t.cnpj || "",
        status: t.status as Tenant["status"],
        active: t.is_active !== undefined ? t.is_active : (t.status === 'active'),
      } : null;

      // Mapear Payments
      const mappedPayments: Payment[] = (paymentsData || []).map((pay: any) => ({
        ...pay,
        id: pay.id,
        rentalId: pay.rental_id,
        dueDate: pay.due_date,
        expectedAmount: pay.expected_amount || pay.amount || 0,
        paidAmount: pay.paid_amount,
        referenceMonth: pay.reference_month,
        referenceYear: pay.reference_year,
        installmentNumber: pay.installment_number,
        status: pay.status as Payment["status"],
      }));

      setRental(mappedRental);
      setProperty(mappedProperty);
      setTenant(mappedTenant);
      setPayments(mappedPayments);
    } catch (error) {
      console.error("Erro ao carregar dados da locação:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da locação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateRental = async (data: {
    terminationDate: string;
    applyPenalty: boolean;
    penaltyAmount: number;
    depositAmount: number;
  }) => {
    if (!rental) return;

    try {
      console.log("=== HOOK: INICIANDO RESCISÃO ===");
      console.log("Rental ID:", rental.id);
      console.log("Data de rescisão:", data.terminationDate);
      console.log("💰 Valor do caução recebido (JÁ DEVE SER CORRIGIDO):", data.depositAmount);
      
      // 1. Calcular aluguel proporcional aqui para passar para o serviço
      const termDate = parseISO(data.terminationDate);
      const paymentDay = rental.paymentDay || 1;
      const terminationDay = termDate.getDate();
      const monthlyRent = rental.value || 0;
      
      let daysUsed = 0;
      if (terminationDay >= paymentDay) {
        daysUsed = terminationDay - paymentDay + 1;
      } else {
        daysUsed = 30; 
      }
      
      // 2. Chamar serviço de rescisão com o valor DO CAUÇÃO JÁ CORRIGIDO
      await processContractTermination({
        rentalId: rental.id,
        terminationDate: data.terminationDate,
        penaltyAmount: data.penaltyAmount,
        depositAmount: data.depositAmount, // Este já deve vir corrigido do diálogo
        paymentDay: rental.paymentDay || 1,
        monthlyRent: rental.value || 0,
        // A garagem tem que entrar na conta da rescisao: sem ela, o valor
        // proporcional sai menor e a vaga deixa de ser cobrada (#49).
        garageValue: rental.hasGarage ? (rental.garageValue || 0) : 0,
      });

      console.log("✅ HOOK: Rescisão processada!");

      toast({
        title: "Rescisão processada com sucesso!",
        description: "O recebimento final foi criado. Aguardando pagamento para finalizar.",
      });
      
      console.log("🔄 HOOK: Recarregando dados da locação...");
      // Recarregar dados
      await loadRentalData();
      console.log("✅ HOOK: Dados recarregados!");
    } catch (error) {
      console.error("❌ HOOK: Error terminating rental:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a rescisão.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const calculateTotals = () => {
    const totalExpected = payments.reduce((sum, p) => sum + (p.expectedAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalPending = payments.filter(p => p.status === "pending").length;
    const totalOverdue = payments.filter(p => {
      if (p.status !== "pending") return false;
      const dueDate = new Date(p.dueDate);
      return dueDate < new Date();
    }).length;

    return {
      totalExpected,
      totalPaid,
      totalPending,
      totalOverdue,
    };
  };

  useEffect(() => {
    if (rentalId) {
      loadRentalData();
    }
  }, [rentalId]);

  return {
    rental,
    property,
    tenant,
    payments,
    isLoading,
    loadRentalData,
    handleTerminateRental,
    calculateTotals,
  };
}

export const loadInstallmentFromDatabase = async (rentalId: string, installmentNumber: number) => {
  try {
    const { data, error } = await supabase
      .from("deposit_installments")
      .select("*")
      .eq("rental_id", rentalId)
      .eq("installment_number", installmentNumber)
      .single();

    if (error) {
      console.error("Erro ao buscar parcela:", error);
      return null;
    }

    if (!data) return null;

    // ✅ CORREÇÃO: Mapear installment_total (banco) → total_installments (TypeScript)
    return {
      id: data.id,
      rental_id: data.rental_id,
      installment_number: data.installment_number,
      total_installments: data.installment_total, // ✅ Campo correto do banco
      amount: data.amount,
      due_date: data.due_date,
      payment_date: data.payment_date,
      paid_amount: data.paid_amount || 0,
      payment_method: data.payment_method,
      pix_code: data.pix_code,
      status: data.status as "pending" | "paid" | "partial" | "overdue",
      notes: data.notes,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as DepositInstallment;
  } catch (error) {
    console.error("Erro ao carregar parcela do banco:", error);
    return null;
  }
};