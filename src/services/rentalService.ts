import { supabase } from "@/integrations/supabase/client";
import type { Rental, Attachment } from "@/types";
import { deleteDepositInstallmentsByRental, createDepositInstallments } from "./depositInstallmentService";
import { getAllLocations } from "./locationService";
import { updatePendingPaymentsOnRentalEdit, createPaymentsForRental, generateExpectedPayments } from "./paymentService";
import { logAudit } from "./auditService";

let rentalsCache: { data: Rental[] | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const CACHE_DURATION = 2 * 60 * 1000;

function invalidatePaymentsCache() {
  console.log("🗑️ [rentalService] Invalidating payments cache");
}

const mapRentalData = (data: any): Rental => {
  const installments = data.deposit_installments || [];
  const installment1 = installments.find((i: any) => i.installment_number === 1);
  const installment2 = installments.find((i: any) => i.installment_number === 2);
  const installment3 = installments.find((i: any) => i.installment_number === 3);

  const tenantData = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
  const propertyData = Array.isArray(data.properties) ? data.properties[0] : data.properties;

  const rental: Rental = {
    id: data.id,
    propertyId: data.property_id,
    tenantId: data.tenant_id,
    startDate: data.start_date,
    endDate: data.end_date,
    paymentDay: data.rent_due_day,
    value: Number(data.rent_value || 0),
    monthlyRent: Number(data.rent_value || 0),
    depositAmount: data.deposit_value ? Number(data.deposit_value) : 0,
    status: data.status as "active" | "ended" | "terminated",
    isActive: data.is_active,
    attachments: (data.attachments as unknown as (string | Attachment)[]) || [],
    contractAttachments: (data.contract_attachments as unknown as string[]) || [],
    hasGarage: data.has_garage || false,
    garageValue: Number(data.garage_value || 0),
    hasPartnerBroker: data.has_partner_broker || false,
    pixCode: data.pix_code || "",
    
    depositInstallments: data.deposit_installments || 0,

    property: propertyData ? {
      id: propertyData.id,
      locationId: propertyData.location_id,
      location: propertyData.locations?.name || "",
      propertyIdentifier: propertyData.property_identifier,
      complement: propertyData.complement,
      description: propertyData.description || "",
      rooms: propertyData.rooms || 0,
      bathrooms: propertyData.bathrooms || 0,
      area: propertyData.area || 0,
      value: Number(propertyData.value || 0),
      monthlyRent: Number(propertyData.value || 0),
      hasGarage: propertyData.has_garage || false,
      hasFurniture: propertyData.has_furniture || false,
      acceptsPets: propertyData.accepts_pets || false,
      status: (propertyData.status as "available" | "occupied" | "unavailable") || "available",
      images: propertyData.images || [],
      createdAt: propertyData.created_at || new Date().toISOString(),
      address: "",
      features: [],
    } : undefined,
    
    tenant: tenantData ? {
      id: tenantData.id,
      name: tenantData.name,
      phone: tenantData.phone,
      email: "",
      document: tenantData.cpf || "",
      cpf: tenantData.cpf || "",
      status: "rented",
    } : undefined,

    depositInstallment1: Number(installment1?.amount || 0),
    depositInstallment1DueDate: installment1?.due_date || null,
    depositInstallment1PaymentDate: installment1?.payment_date || null,
    depositInstallment1PixCode: installment1?.pix_code || "",
    
    depositPaymentDate: installment1?.payment_date || null,
    depositPixCode: installment1?.pix_code || "",
    depositDueDate: installment1?.due_date || null,
    
    depositInstallment2: Number(installment2?.amount || 0),
    depositInstallment2DueDate: installment2?.due_date || null,
    depositInstallment2PaymentDate: installment2?.payment_date || null,
    depositInstallment2PixCode: installment2?.pix_code || "",
    
    depositInstallment3: Number(installment3?.amount || 0),
    depositInstallment3DueDate: installment3?.due_date || null,
    depositInstallment3PaymentDate: installment3?.payment_date || null,
    depositInstallment3PixCode: installment3?.pix_code || "",
  };

  return rental;
};

export const rentalService = {
  async checkAndUpdateExpiredRentals(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      console.log("🔍 [rentalService.checkAndUpdateExpiredRentals] Verificando contratos expirados...");
      
      const { data: expiredRentals, error } = await supabase
        .from("rentals")
        .select("id, tenant_id, property_id, end_date")
        .eq("status", "active")
        .not("end_date", "is", null)
        .lt("end_date", today);

      if (error) {
        console.error("❌ [rentalService.checkAndUpdateExpiredRentals] Erro:", error);
        return;
      }

      if (!expiredRentals || expiredRentals.length === 0) {
        console.log("✅ [rentalService.checkAndUpdateExpiredRentals] Nenhum contrato expirado encontrado");
        return;
      }

      console.log(`📋 [rentalService.checkAndUpdateExpiredRentals] ${expiredRentals.length} contrato(s) expirado(s) encontrado(s)`);

      for (const rental of expiredRentals) {
        console.log(`🔄 [rentalService.checkAndUpdateExpiredRentals] Encerrando contrato ${rental.id}...`);
        
        const { error: rentalError } = await supabase
          .from("rentals")
          .update({ status: "ended" })
          .eq("id", rental.id);

        if (rentalError) {
          console.error(`❌ Erro ao atualizar locação ${rental.id}:`, rentalError);
          continue;
        }

        if (rental.property_id) {
          const { error: propertyError } = await supabase
            .from("properties")
            .update({ status: "available" })
            .eq("id", rental.property_id);

          if (propertyError) {
            console.error(`❌ Erro ao atualizar imóvel ${rental.property_id}:`, propertyError);
          }
        }

        if (rental.tenant_id) {
          const { error: tenantError } = await supabase
            .from("tenants")
            .update({ status: "active" })
            .eq("id", rental.tenant_id);

          if (tenantError) {
            console.error(`❌ Erro ao atualizar inquilino ${rental.tenant_id}:`, tenantError);
          }
        }

        console.log(`✅ [rentalService.checkAndUpdateExpiredRentals] Contrato ${rental.id} encerrado com sucesso`);
      }

      rentalService.invalidateCache();
      
      console.log("✅ [rentalService.checkAndUpdateExpiredRentals] Verificação concluída");
    } catch (error) {
      console.error("❌ [rentalService.checkAndUpdateExpiredRentals] Erro inesperado:", error);
    }
  },

  async getAll(forceRefresh = false): Promise<Rental[]> {
    const now = Date.now();
    
    await rentalService.checkAndUpdateExpiredRentals();
    
    if (!forceRefresh && rentalsCache.data && (now - rentalsCache.timestamp) < CACHE_DURATION) {
      console.log("✅ [rentalService.getAll] Usando cache");
      return rentalsCache.data;
    }

    console.log("🔄 [rentalService.getAll] Buscando do banco...");
    
    const { data, error } = await supabase
      .from("rentals")
      .select(`
        id,
        property_id,
        tenant_id,
        start_date,
        end_date,
        rent_value,
        rent_due_day,
        deposit_value,
        status,
        is_active,
        attachments,
        contract_attachments,
        has_garage,
        garage_value,
        has_partner_broker,
        pix_code,
        deposit_installments,
        created_at,
        tenants!rentals_tenant_id_fkey(
          id, name, phone, cpf
        ),
        properties!rentals_property_id_fkey(
          id, location_id, property_identifier, complement, value,
          locations!properties_location_id_fkey(id, name)
        ),
        deposit_installments(
          id, installment_number, amount, pix_code, payment_date, due_date, 
          status, total_installments
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ [rentalService.getAll] Erro:", error);
      throw error;
    }

    console.log(`✅ [rentalService.getAll] ${data?.length || 0} locações retornadas`);
    
    const mappedRentals = data?.map((rental: any) => mapRentalData(rental)) || [];
    
    rentalsCache = {
      data: mappedRentals,
      timestamp: now,
    };
    
    return mappedRentals;
  },

  invalidateCache() {
    console.log("🗑️ [rentalService] Cache invalidado");
    rentalsCache = { data: null, timestamp: 0 };
  },

  async getById(id: string): Promise<Rental> {
    console.log(`🔄 [rentalService.getById] Buscando locação ${id}...`);
    
    await rentalService.checkAndUpdateExpiredRentals();
    
    const { data, error } = await supabase
      .from("rentals")
      .select(`
        *,
        tenants!rentals_tenant_id_fkey(
          id, name, phone, cpf
        ),
        properties!rentals_property_id_fkey(
          id, location_id, property_identifier, complement, value, description, 
          rooms, bathrooms, area, has_garage, has_furniture, accepts_pets, status, 
          images, created_at,
          locations!properties_location_id_fkey(id, name)
        ),
        deposit_installments(
          id, installment_number, amount, pix_code, payment_date, due_date, 
          status, total_installments
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("❌ [rentalService.getById] Erro:", error);
      throw error;
    }

    console.log("✅ [rentalService.getById] Locação encontrada");
    
    return mapRentalData(data);
  },

  async create(rental: Partial<Rental>): Promise<Rental> {
    const dbData = {
      property_id: rental.propertyId,
      tenant_id: rental.tenantId,
      start_date: rental.startDate,
      end_date: rental.endDate,
      rent_value: rental.monthlyRent || rental.value,
      rent_due_day: rental.paymentDay,
      deposit_value: rental.depositAmount ? rental.depositAmount : null,
      status: rental.status,
      attachments: rental.attachments as any,
      contract_attachments: rental.contractAttachments,
      has_garage: rental.hasGarage,
      garage_value: rental.garageValue,
      has_partner_broker: rental.hasPartnerBroker,
      deposit_installments: rental.depositInstallments,
    };

    const { data, error } = await supabase
      .from("rentals")
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    
    console.log("✅ [rentalService.create] Locação criada no banco:", {
      id: data.id,
      property_id: data.property_id,
      tenant_id: data.tenant_id,
      start_date: data.start_date,
      end_date: data.end_date,
      rent_value: data.rent_value,
      rent_due_day: data.rent_due_day,
    });

    // ✅ NOVO FORMATO: Buscar property e tenant para log
    const { data: propertyData } = await supabase
      .from("properties")
      .select(`
        complement,
        locations!properties_location_id_fkey(name)
      `)
      .eq("id", data.property_id)
      .single();

    const { data: tenantData } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", data.tenant_id)
      .single();

    const locationName = (propertyData?.locations as any)?.name || "Local não informado";
    const complement = propertyData?.complement || "Sem complemento";
    const tenantName = tenantData?.name || "Inquilino não informado";

    await logAudit({
      action_type: "create",
      entity_type: "rental",
      entity_id: data.id,
      changes_summary: `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName}`,
      new_values: {
        location: locationName,
        complement: complement,
        tenant: tenantName,
        start_date: data.start_date,
        end_date: data.end_date,
        rent_value: data.rent_value,
      },
    });

    if (rental.startDate && rental.endDate && rental.paymentDay) {
      console.log("🔄 [rentalService.create] Gerando recebimentos automáticos...");
      
      try {
        await createPaymentsForRental({
          rental: { id: data.id } as Rental,
          startDate: new Date(rental.startDate),
          endDate: new Date(rental.endDate),
          monthlyRent: rental.monthlyRent || rental.value || 0,
          paymentDay: rental.paymentDay,
          hasGarage: rental.hasGarage,
          garageValue: rental.garageValue,
        });
        console.log("✅ [rentalService.create] Recebimentos gerados com sucesso!");
      } catch (paymentError) {
        console.error("❌ [rentalService.create] ERRO CRÍTICO ao gerar recebimentos:", paymentError);
        throw new Error(`Falha ao criar recebimentos: ${(paymentError as any).message}`);
      }
      
      invalidatePaymentsCache();
    }

    if (rental.depositAmount && rental.depositAmount > 0) {
      console.log("🔄 [rentalService.create] Gerando parcelas de caução...");
      
      try {
        const installmentsToCreate = [];
        const totalInstallments = rental.depositInstallments || 1;
        
        installmentsToCreate.push({
          installment_number: 1,
          total_installments: totalInstallments,
          amount: rental.depositInstallment1 || rental.depositAmount,
          due_date: rental.depositInstallment1DueDate || rental.depositDueDate || rental.startDate!,
          payment_date: rental.depositInstallment1PaymentDate || rental.depositPaymentDate || null,
          pix_code: rental.depositInstallment1PixCode || rental.depositPixCode || null,
        });
        
        if (totalInstallments >= 2 && rental.depositInstallment2 && rental.depositInstallment2 > 0) {
          installmentsToCreate.push({
            installment_number: 2,
            total_installments: totalInstallments,
            amount: rental.depositInstallment2,
            due_date: rental.depositInstallment2DueDate!,
            payment_date: rental.depositInstallment2PaymentDate || null,
            pix_code: rental.depositInstallment2PixCode || null,
          });
        }
        
        if (totalInstallments === 3 && rental.depositInstallment3 && rental.depositInstallment3 > 0) {
          installmentsToCreate.push({
            installment_number: 3,
            total_installments: totalInstallments,
            amount: rental.depositInstallment3,
            due_date: rental.depositInstallment3DueDate!,
            payment_date: rental.depositInstallment3PaymentDate || null,
            pix_code: rental.depositInstallment3PixCode || null,
          });
        }
        
        await createDepositInstallments(data.id, installmentsToCreate);
        
        console.log("✅ [rentalService.create] Parcelas de caução criadas com sucesso!");
      } catch (depositError) {
        console.error("❌ [rentalService.create] ERRO ao criar parcelas de caução:", depositError);
      }
    }

    if (rental.tenantId) {
      await supabase
        .from("tenants")
        .update({ status: "rented" })
        .eq("id", rental.tenantId);
    }

    rentalService.invalidateCache();
    invalidatePaymentsCache();

    return rentalService.getById(data.id);
  },

  async update(id: string, rental: Partial<Rental>): Promise<Rental> {
    const { data: oldRentalData, error: fetchError } = await supabase
      .from("rentals")
      .select(`
        *,
        deposit_installments(
          id, installment_number, amount, due_date, payment_date, pix_code, 
          status, total_installments
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;
    
    const oldRental = mapRentalData(oldRentalData);
    
    console.log("🔍 [rentalService.update] Dados antigos:", {
      status: oldRental.status,
      endDate: oldRental.endDate,
      startDate: oldRental.startDate,
      paymentDay: oldRental.paymentDay,
    });

    const today = new Date().toISOString().split('T')[0];
    const isReactivating = 
      oldRental.status === "ended" && 
      rental.endDate && 
      rental.endDate > today;

    if (isReactivating) {
      console.log("🔄 [rentalService.update] REATIVANDO LOCAÇÃO ENCERRADA!");
      rental.status = "active";
      
      await supabase
        .from("properties")
        .update({ status: "occupied" })
        .eq("id", oldRental.propertyId);
      
      await supabase
        .from("tenants")
        .update({ status: "rented" })
        .eq("id", oldRental.tenantId);
    }

    const dbData: any = {};
    if (rental.propertyId !== undefined) dbData.property_id = rental.propertyId;
    if (rental.tenantId !== undefined) dbData.tenant_id = rental.tenantId;
    if (rental.startDate !== undefined) dbData.start_date = rental.startDate;
    if (rental.endDate !== undefined) dbData.end_date = rental.endDate;
    if (rental.value !== undefined || rental.monthlyRent !== undefined) {
      dbData.rent_value = rental.monthlyRent || rental.value;
    }
    if (rental.paymentDay !== undefined) dbData.rent_due_day = rental.paymentDay;
    if (rental.depositAmount !== undefined) dbData.deposit_value = rental.depositAmount;
    if (rental.status !== undefined) dbData.status = rental.status;
    if (rental.attachments !== undefined) dbData.attachments = rental.attachments as any;
    if (rental.contractAttachments !== undefined) dbData.contract_attachments = rental.contractAttachments;
    if (rental.hasGarage !== undefined) dbData.has_garage = rental.hasGarage;
    if (rental.garageValue !== undefined) dbData.garage_value = rental.garageValue;
    if (rental.hasPartnerBroker !== undefined) dbData.has_partner_broker = rental.hasPartnerBroker;
    if (rental.depositInstallments !== undefined) dbData.deposit_installments = rental.depositInstallments;

    const { data, error } = await supabase
      .from("rentals")
      .update(dbData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // ✅ NOVO FORMATO: Buscar property e tenant para log
    const { data: propertyData } = await supabase
      .from("properties")
      .select(`
        complement,
        locations!properties_location_id_fkey(name)
      `)
      .eq("id", data.property_id)
      .single();

    const { data: tenantData } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", data.tenant_id)
      .single();

    const locationName = (propertyData?.locations as any)?.name || "Local não informado";
    const complement = propertyData?.complement || "Sem complemento";
    const tenantName = tenantData?.name || "Inquilino não informado";

    // ✅ NOVO FORMATO: mudanças campo a campo
    const changes: string[] = [];
    if (oldRental.startDate !== data.start_date) {
      changes.push(`start_date: de=${oldRental.startDate} -> para=${data.start_date}`);
    }
    if (oldRental.endDate !== data.end_date) {
      changes.push(`end_date: de=${oldRental.endDate || 'null'} -> para=${data.end_date || 'null'}`);
    }
    if (oldRental.monthlyRent !== data.rent_value) {
      changes.push(`rent_value: de=${oldRental.monthlyRent} -> para=${data.rent_value}`);
    }
    if (oldRental.status !== data.status) {
      changes.push(`status: de=${oldRental.status} -> para=${data.status}`);
    }

    const changesSummary = changes.length > 0
      ? `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName}\n${changes.join('\n')}`
      : `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName}`;

    await logAudit({
      action_type: "update",
      entity_type: "rental",
      entity_id: id,
      changes_summary: changesSummary,
      old_values: {
        start_date: oldRental.startDate,
        end_date: oldRental.endDate,
        rent_value: oldRental.monthlyRent,
        status: oldRental.status,
      },
      new_values: {
        start_date: data.start_date,
        end_date: data.end_date,
        rent_value: data.rent_value,
        status: data.status,
      },
    });

    // Gerenciar parcelas de caução (código existente permanece igual)
    const { data: existingInstallments } = await supabase
      .from("deposit_installments")
      .select("*")
      .eq("rental_id", id)
      .order("installment_number", { ascending: true });

    const hasExistingInstallments = existingInstallments && existingInstallments.length > 0;
    const depositAmount = rental.depositAmount ?? oldRental.depositAmount ?? 0;

    if (!hasExistingInstallments && depositAmount > 0) {
      console.log("🔄 [rentalService.update] Criando parcelas de caução...");
      
      try {
        const installmentsToCreate = [];
        const totalInstallments = rental.depositInstallments ?? oldRental.depositInstallments ?? 1;
        
        installmentsToCreate.push({
          installment_number: 1,
          total_installments: totalInstallments,
          amount: rental.depositInstallment1 ?? oldRental.depositInstallment1 ?? depositAmount,
          due_date: rental.depositInstallment1DueDate ?? oldRental.depositInstallment1DueDate ?? rental.startDate ?? oldRental.startDate ?? new Date().toISOString().split('T')[0],
          payment_date: rental.depositInstallment1PaymentDate ?? oldRental.depositInstallment1PaymentDate ?? null,
          pix_code: rental.depositInstallment1PixCode ?? oldRental.depositInstallment1PixCode ?? null,
        });
        
        if (totalInstallments >= 2) {
          const installment2Amount = rental.depositInstallment2 ?? oldRental.depositInstallment2 ?? 0;
          if (installment2Amount > 0) {
            installmentsToCreate.push({
              installment_number: 2,
              total_installments: totalInstallments,
              amount: installment2Amount,
              due_date: rental.depositInstallment2DueDate ?? oldRental.depositInstallment2DueDate ?? new Date().toISOString().split('T')[0],
              payment_date: rental.depositInstallment2PaymentDate ?? oldRental.depositInstallment2PaymentDate ?? null,
              pix_code: rental.depositInstallment2PixCode ?? oldRental.depositInstallment2PixCode ?? null,
            });
          }
        }
        
        if (totalInstallments === 3) {
          const installment3Amount = rental.depositInstallment3 ?? oldRental.depositInstallment3 ?? 0;
          if (installment3Amount > 0) {
            installmentsToCreate.push({
              installment_number: 3,
              total_installments: totalInstallments,
              amount: installment3Amount,
              due_date: rental.depositInstallment3DueDate ?? oldRental.depositInstallment3DueDate ?? new Date().toISOString().split('T')[0],
              payment_date: rental.depositInstallment3PaymentDate ?? oldRental.depositInstallment3PaymentDate ?? null,
              pix_code: rental.depositInstallment3PixCode ?? oldRental.depositInstallment3PixCode ?? null,
            });
          }
        }
        
        await createDepositInstallments(id, installmentsToCreate);
        
        console.log("✅ [rentalService.update] Parcelas de caução criadas com sucesso!");
      } catch (depositError) {
        console.error("❌ [rentalService.update] ERRO ao criar parcelas de caução:", depositError);
      }
    } else if (hasExistingInstallments) {
      const hasDepositChanges = 
        rental.depositInstallment1 !== undefined ||
        rental.depositInstallment2 !== undefined ||
        rental.depositInstallment3 !== undefined ||
        rental.depositInstallment1DueDate !== undefined ||
        rental.depositInstallment2DueDate !== undefined ||
        rental.depositInstallment3DueDate !== undefined ||
        rental.depositInstallment1PaymentDate !== undefined ||
        rental.depositInstallment2PaymentDate !== undefined ||
        rental.depositInstallment3PaymentDate !== undefined ||
        rental.depositInstallment1PixCode !== undefined ||
        rental.depositInstallment2PixCode !== undefined ||
        rental.depositInstallment3PixCode !== undefined ||
        rental.depositPaymentDate !== undefined ||
        rental.depositPixCode !== undefined;

      if (hasDepositChanges) {
        console.log("🔄 [rentalService.update] Atualizando parcelas de caução...");
        
        try {
          for (const existingInstallment of existingInstallments) {
            const installmentNum = existingInstallment.installment_number;
            const updateData: any = {};
            
            if (installmentNum === 1) {
              if (rental.depositInstallment1 !== undefined) {
                updateData.amount = rental.depositInstallment1;
              }
              if (rental.depositInstallment1DueDate !== undefined) {
                updateData.due_date = rental.depositInstallment1DueDate;
              }
              if (rental.depositInstallment1PaymentDate !== undefined) {
                updateData.payment_date = rental.depositInstallment1PaymentDate;
              }
              if (rental.depositInstallment1PixCode !== undefined) {
                updateData.pix_code = rental.depositInstallment1PixCode;
              }
              if (rental.depositPaymentDate !== undefined) {
                updateData.payment_date = rental.depositPaymentDate;
              }
              if (rental.depositPixCode !== undefined) {
                updateData.pix_code = rental.depositPixCode;
              }
            } else if (installmentNum === 2) {
              if (rental.depositInstallment2 !== undefined) {
                updateData.amount = rental.depositInstallment2;
              }
              if (rental.depositInstallment2DueDate !== undefined) {
                updateData.due_date = rental.depositInstallment2DueDate;
              }
              if (rental.depositInstallment2PaymentDate !== undefined) {
                updateData.payment_date = rental.depositInstallment2PaymentDate;
              }
              if (rental.depositInstallment2PixCode !== undefined) {
                updateData.pix_code = rental.depositInstallment2PixCode;
              }
            } else if (installmentNum === 3) {
              if (rental.depositInstallment3 !== undefined) {
                updateData.amount = rental.depositInstallment3;
              }
              if (rental.depositInstallment3DueDate !== undefined) {
                updateData.due_date = rental.depositInstallment3DueDate;
              }
              if (rental.depositInstallment3PaymentDate !== undefined) {
                updateData.payment_date = rental.depositInstallment3PaymentDate;
              }
              if (rental.depositInstallment3PixCode !== undefined) {
                updateData.pix_code = rental.depositInstallment3PixCode;
              }
            }
            
            if (Object.keys(updateData).length > 0) {
              updateData.updated_at = new Date().toISOString();
              
              const { error: updateError } = await supabase
                .from("deposit_installments")
                .update(updateData)
                .eq("id", existingInstallment.id);
              
              if (updateError) {
                console.error(`❌ Erro ao atualizar parcela ${installmentNum}:`, updateError);
                throw updateError;
              }
            }
          }
          
          console.log("✅ [rentalService.update] Todas as parcelas de caução atualizadas!");
        } catch (depositError) {
          console.error("❌ [rentalService.update] ERRO ao atualizar parcelas de caução:", depositError);
        }
      }
    }

    // NOVA LÓGICA UNIFICADA: Sincronizar recebimentos de aluguel se qualquer data ou valor mudou
    const rentPaymentsChanged = 
      (rental.startDate !== undefined && rental.startDate !== oldRental.startDate) ||
      (rental.endDate !== undefined && rental.endDate !== oldRental.endDate) ||
      (rental.paymentDay !== undefined && rental.paymentDay !== oldRental.paymentDay) ||
      (rental.hasGarage !== undefined && rental.hasGarage !== oldRental.hasGarage) ||
      (rental.garageValue !== undefined && rental.garageValue !== oldRental.garageValue) ||
      (rental.monthlyRent !== undefined && rental.monthlyRent !== oldRental.monthlyRent) ||
      (rental.value !== undefined && rental.value !== oldRental.monthlyRent);

    if (rentPaymentsChanged) {
      console.log("🔄 [rentalService.update] Sincronizando recebimentos de aluguel...");
      
      try {
        const { rentalUpdateService } = await import("./rentalUpdateService");
        
        await rentalUpdateService.updatePaymentsOnRentalEdit(
          id,
          oldRental,
          {
            startDate: rental.startDate,
            endDate: rental.endDate,
            monthlyRent: rental.monthlyRent ?? rental.value,
            paymentDay: rental.paymentDay,
            hasGarage: rental.hasGarage,
            garageValue: rental.garageValue,
          }
        );
        
        console.log("✅ [rentalService.update] Recebimentos de aluguel sincronizados com sucesso!");
      } catch (paymentError) {
        console.error("❌ [rentalService.update] ERRO ao sincronizar recebimentos:", paymentError);
        throw paymentError;
      }
    }

    if (rental.status !== undefined && !isReactivating) {
      const tenantId = rental.tenantId || data.tenant_id;
      if (tenantId) {
        const newTenantStatus = rental.status === "active" ? "rented" : "active";
        await supabase
          .from("tenants")
          .update({ status: newTenantStatus })
          .eq("id", tenantId);
      }
    }

    rentalService.invalidateCache();
    invalidatePaymentsCache();

    return rentalService.getById(id);
  },

  async remove(id: string): Promise<void> {
    // ✅ Buscar dados ANTES de deletar
    const { data: rentalData } = await supabase
      .from("rentals")
      .select(`
        *,
        properties!rentals_property_id_fkey(
          complement,
          locations!properties_location_id_fkey(name)
        ),
        tenants!rentals_tenant_id_fkey(name)
      `)
      .eq("id", id)
      .single();

    const { data: paidPayments, error: paidError } = await supabase
      .from("payments")
      .select("id")
      .eq("rental_id", id)
      .in("status", ["paid", "partial"]);

    if (paidError) throw paidError;

    if (paidPayments && paidPayments.length > 0) {
      throw new Error(
        `Não é possível deletar esta locação porque ela possui ${paidPayments.length} recebimento(s) pago(s) ou parcialmente pago(s). ` +
        "Apenas locações sem nenhum recebimento efetivado podem ser deletadas."
      );
    }

    const { error: deletePaymentsError } = await supabase
      .from("payments")
      .delete()
      .eq("rental_id", id)
      .eq("status", "pending");

    if (deletePaymentsError) {
      console.error("❌ Erro ao deletar pagamentos pendentes:", deletePaymentsError);
      throw deletePaymentsError;
    }

    const { error } = await supabase.from("rentals").delete().eq("id", id);
    if (error) throw error;

    // ✅ NOVO FORMATO: Local + Complemento + Inquilino
    if (rentalData) {
      const locationName = (rentalData.properties as any)?.locations?.name || "Local não informado";
      const complement = (rentalData.properties as any)?.complement || "Sem complemento";
      const tenantName = (rentalData.tenants as any)?.name || "Inquilino não informado";

      await logAudit({
        action_type: "delete",
        entity_type: "rental",
        entity_id: id,
        changes_summary: `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName}`,
        old_values: {
          location: locationName,
          complement: complement,
          tenant: tenantName,
          start_date: rentalData.start_date,
          end_date: rentalData.end_date,
        },
      });
    }
    
    rentalService.invalidateCache();
    invalidatePaymentsCache();
  },

  async terminateContract(id: string): Promise<void> {
    const { data: rentalData, error: fetchError } = await supabase
      .from("rentals")
      .select("tenant_id")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from("rentals")
      .update({ 
        status: "terminated", 
        end_date: new Date().toISOString() 
      })
      .eq("id", id);

    if (error) throw error;

    if (rentalData?.tenant_id) {
      await supabase
        .from("tenants")
        .update({ status: "active" })
        .eq("id", rentalData.tenant_id);
    }
    
    rentalService.invalidateCache();
  }
};

export const getAll = rentalService.getAll;
export const getById = rentalService.getById;
export const create = rentalService.create;
export const update = rentalService.update;
export const remove = rentalService.remove;
export const terminateContract = rentalService.terminateContract;