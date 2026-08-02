import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Payment, Rental, Property, Tenant } from "@/types";
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
      console.log("🔄 [usePayments] Buscando recebimentos do banco...");
      
      // 1. Buscar payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .order("due_date", { ascending: false });

      if (paymentsError) {
        console.error("❌ [usePayments] Erro ao buscar payments:", paymentsError);
        throw paymentsError;
      }

      console.log(`✅ [usePayments] Payments carregados do banco: ${paymentsData?.length || 0}`);

      if (!paymentsData || paymentsData.length === 0) {
        setPayments([]);
        return;
      }

      // 2. Buscar rentals únicos (apenas os necessários)
      const uniqueRentalIds = [...new Set(paymentsData.map(p => p.rental_id).filter(Boolean))];
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

      // 5. ⚡ Criar MAPs para lookup O(1) em vez de .find() O(n)
      const rentalsMap = new Map(rentalsData?.map(r => [r.id, r]) || []);
      const propertiesMap = new Map(propertiesData?.map(p => [p.id, p]) || []);
      const tenantsMap = new Map(tenantsData?.map(t => [t.id, t]) || []);

      console.log("🗺️ [usePayments] Maps criados para lookup rápido");

      // 6. Mapear payments com dados relacionados (lookup O(1))
      const mappedPayments = paymentsData.map((payment): Payment => {
        const rental = rentalsMap.get(payment.rental_id);
        const property = rental ? propertiesMap.get(rental.property_id) : null;
        const tenant = rental ? tenantsMap.get(rental.tenant_id) : null;

        // ✅ CORREÇÃO: Converter attachments JSON para array de strings
        let attachmentsArray: string[] = [];
        if (payment.attachments) {
          if (Array.isArray(payment.attachments)) {
            // Json[] pode conter strings ou outros tipos - filtrar apenas strings
            attachmentsArray = (payment.attachments as any[])
              .filter(item => typeof item === 'string') as string[];
          }
        }

        return {
          id: payment.id,
          rentalId: payment.rental_id,
          propertyId: rental?.property_id || "",
          tenantId: rental?.tenant_id || "",
          referenceMonth: new Date(payment.due_date).getMonth() + 1,
          referenceYear: new Date(payment.due_date).getFullYear(),
          dueDate: payment.due_date,
          paymentDate: payment.payment_date || null,
          expectedAmount: payment.expected_amount || 0,
          paidAmount: payment.paid_amount || 0,
          status: payment.status as "pending" | "paid" | "overdue" | "partial",
          paymentMethod: payment.payment_method || null,
          notes: payment.notes || null,
          lateFee: 0,
          interest: 0,
          breakdown: null,
          attachments: attachmentsArray,
          pixCode: payment.pix_code || null,
          createdAt: payment.created_at,
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
      setPayments(mappedPayments);

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