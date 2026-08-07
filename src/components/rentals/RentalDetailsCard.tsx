import { useMemo, memo, useCallback, useState, useEffect } from "react";
import { Rental, Property, Tenant, Attachment } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, User, DollarSign, FileText, Car, Coins, Banknote, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/masks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RentalAttachmentsDialog } from "./RentalAttachmentsDialog";
import { DepositPaymentDialog } from "./DepositPaymentDialog";
import { supabase } from "@/integrations/supabase/client";
import type { DepositInstallment } from "@/types";

interface RentalDetailsCardProps {
  rental: Rental;
  property: Property | null;
  tenant: Tenant | null;
}

// Helper para formatar data de forma segura
const safeDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateString;
  }
};

// Componente de seção de informação
const InfoSection = memo(({ icon: Icon, title, children }: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Icon className="h-4 w-4" />
      {title}
    </div>
    {children}
  </div>
));
InfoSection.displayName = "InfoSection";

// Componente de parcela de caução
const DepositInstallment = memo(({ 
  label, 
  value, 
  date, 
  pixCode 
}: { 
  label: string;
  value: number;
  date?: string;
  pixCode?: string;
}) => (
  <div className="p-3 bg-white rounded border border-slate-200 text-sm">
    <div className="flex justify-between items-center mb-1">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="font-bold text-green-600">{formatCurrency(value)}</span>
    </div>
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {date && <span>Vencimento: {safeDate(date)}</span>}
      {pixCode && <span className="truncate block">PIX: {pixCode}</span>}
    </div>
  </div>
));
DepositInstallment.displayName = "DepositInstallment";

export const RentalDetailsCard = memo(function RentalDetailsCard({ rental, property, tenant }: RentalDetailsCardProps) {
  console.log("🎨 [RentalDetailsCard] Componente renderizado - rental.id:", rental.id);
  
  const [depositInstallments, setDepositInstallments] = useState<DepositInstallment[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<DepositInstallment | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Buscar parcelas de caução ao montar componente
  useEffect(() => {
    const fetchInstallments = async () => {
      if (!rental.id) return;
      
      console.log("🔍 [RentalDetailsCard] Buscando parcelas de caução para rental:", rental.id);
      
      setLoadingInstallments(true);
      try {
        const { data, error } = await supabase
          .from("deposit_installments")
          .select("*")
          .eq("rental_id", rental.id)
          .order("installment_number", { ascending: true });

        if (error) {
          console.error("❌ [RentalDetailsCard] Erro ao buscar parcelas:", error);
          throw error;
        }
        
        console.log("📦 [RentalDetailsCard] Parcelas retornadas do banco:", data);
        
        // Convert database schema to DepositInstallment type
        const installments: DepositInstallment[] = (data || []).map(item => ({
          id: item.id,
          rental_id: item.rental_id,
          installment_number: item.installment_number,
          total_installments: item.installment_total, // ✅ CORREÇÃO: campo do banco é installment_total
          amount: item.amount,
          due_date: item.due_date,
          payment_date: item.payment_date,
          paid_amount: item.paid_amount || 0,
          payment_method: item.payment_method,
          pix_code: item.pix_code,
          status: item.status as "pending" | "paid" | "partial" | "overdue",
          notes: item.notes,
          attachments: Array.isArray(item.attachments) ? item.attachments : [],
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        
        console.log("✅ [RentalDetailsCard] Parcelas mapeadas:", installments);
        console.log("✅ [RentalDetailsCard] Total de parcelas:", installments.length);
        
        setDepositInstallments(installments);
      } catch (error) {
        console.error("❌ [RentalDetailsCard] Erro ao buscar parcelas de caução:", error);
      } finally {
        setLoadingInstallments(false);
      }
    };

    console.log("🔄 [RentalDetailsCard] useEffect disparado - rental.id:", rental.id);
    fetchInstallments();
  }, [rental.id]); // Dependência simples: apenas rental.id

  // Função para recarregar parcelas (usada após pagamento)
  const reloadInstallments = useCallback(async () => {
    if (!rental.id) return;
    
    setLoadingInstallments(true);
    try {
      const { data, error } = await supabase
        .from("deposit_installments")
        .select("*")
        .eq("rental_id", rental.id)
        .order("installment_number", { ascending: true });

      if (error) throw error;
      
      const installments: DepositInstallment[] = (data || []).map(item => ({
        id: item.id,
        rental_id: item.rental_id,
        installment_number: item.installment_number,
        total_installments: item.installment_total, // ✅ CORREÇÃO: campo do banco é installment_total
        amount: item.amount,
        due_date: item.due_date,
        payment_date: item.payment_date,
        paid_amount: item.paid_amount || 0,
        payment_method: item.payment_method,
        pix_code: item.pix_code,
        status: item.status as "pending" | "paid" | "partial" | "overdue",
        notes: item.notes,
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      
      setDepositInstallments(installments);
    } catch (error) {
      console.error("❌ Erro ao recarregar parcelas:", error);
    } finally {
      setLoadingInstallments(false);
    }
  }, [rental.id]);

  // Badge de status
  const getStatusBadge = useCallback((status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      terminated: "destructive",
      pending: "secondary",
    };

    const labels: Record<string, string> = {
      active: "Ativa",
      terminated: "Encerrada",
      pending: "Pendente",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  }, []);

  // Verifica se o contrato está expirado
  const isExpired = useMemo(() => {
    if (!rental.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(rental.endDate);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  }, [rental.endDate]);

  // Status efetivo
  const effectiveStatus = useMemo(() => 
    isExpired || !rental.isActive ? "terminated" : "active",
    [isExpired, rental.isActive]
  );

  // Determinar se tem caução
  const hasDeposit = useMemo(() => 
    (rental.depositAmount && rental.depositAmount > 0) || 
    (rental.depositInstallments && rental.depositInstallments > 0) ||
    (rental.depositInstallment1 && rental.depositInstallment1 > 0),
    [rental.depositAmount, rental.depositInstallments, rental.depositInstallment1]
  );

  // Normalizar anexos para garantir compatibilidade
  const normalizedAttachments = useMemo((): Attachment[] => {
    if (!rental.attachments) return [];
    
    return rental.attachments.map((att: string | Attachment) => {
      if (typeof att === 'string') {
        const name = att.split('/').pop() || 'Arquivo';
        return {
          id: att, // Usar URL como ID para strings antigas
          name: name,
          url: att,
          type: 'application/octet-stream',
          category: 'other',
          uploadedAt: new Date().toISOString()
        } as Attachment;
      }
      return att as Attachment;
    });
  }, [rental.attachments]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Detalhes da Locação</span>
          </div>
          <div className="flex gap-2">
            <Badge variant={effectiveStatus === "active" ? "default" : "secondary"}>
              {effectiveStatus === "active" ? "Ativo" : "Encerrado"}
            </Badge>
            {rental.endDate && getStatusBadge(effectiveStatus)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Propriedade */}
        <InfoSection icon={MapPin} title="Propriedade">
          {property ? (
            <div className="ml-6 space-y-1 text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {property.location} {property.complement ? `- ${property.complement}` : ''}
              </p>
              <p>{property.address}, {property.number}</p>
              <p>{property.neighborhood} - {property.city}/{property.state}</p>
              <p>CEP: {property.zipCode}</p>
            </div>
          ) : (
            <p className="ml-6 text-sm text-muted-foreground">Informações indisponíveis</p>
          )}
        </InfoSection>

        {/* Inquilino */}
        <InfoSection icon={User} title="Inquilino">
          {tenant ? (
            <div className="ml-6 space-y-1 text-sm text-slate-600">
              <p className="font-medium text-slate-900">{tenant.name}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p>CPF: {tenant.cpf}</p>
                <p>RG: {tenant.rg}</p>
                <p>Tel: {tenant.phone}</p>
                <p>Email: {tenant.email}</p>
              </div>
            </div>
          ) : (
            <p className="ml-6 text-sm text-muted-foreground">Informações indisponíveis</p>
          )}
        </InfoSection>

        {/* Valores e Prazos */}
        <InfoSection icon={DollarSign} title="Valores e Prazos">
          <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Valor do Aluguel</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(rental.value || 0)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Dia do Vencimento</p>
              <p className="font-medium text-slate-900">Dia {rental.paymentDay}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Início do Contrato</p>
              <p className="font-medium text-slate-900">{safeDate(rental.startDate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fim do Contrato</p>
              <p className="font-medium text-slate-900">
                {rental.endDate ? safeDate(rental.endDate) : "Indeterminado"}
              </p>
            </div>
          </div>
        </InfoSection>

        {/* Adicionais */}
        <InfoSection icon={Car} title="Adicionais">
          <div className="ml-6 space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={rental.hasGarage} readOnly className="rounded border-gray-300 pointer-events-none" />
              <span className="text-sm">Possui vaga de garagem</span>
              {rental.hasGarage && rental.garageValue && (
                <span className="text-sm font-semibold text-green-600 ml-2">
                  (+ {formatCurrency(rental.garageValue)})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={rental.hasPartnerBroker} readOnly className="rounded border-gray-300 pointer-events-none" />
              <span className="text-sm">Corretor Parceiro</span>
            </div>
          </div>
        </InfoSection>

        {/* Caução */}
        {hasDeposit && (
          <InfoSection icon={Coins} title="Garantia (Caução)">
            <div className="ml-6 space-y-4">
              {/* Informações do Caução */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-600">Valor Total</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatCurrency(rental.depositAmount || 0)}
                  </p>
                </div>

                {rental.depositInstallments && rental.depositInstallments > 1 && (
                  <div>
                    <p className="text-xs font-medium text-slate-600">Parcelamento</p>
                    <p className="text-sm">{rental.depositInstallments}x</p>
                  </div>
                )}
              </div>

              {/* Valores das Parcelas (se parcelado) */}
              {rental.depositInstallments && rental.depositInstallments > 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  {rental.depositAmount && (
                    <div>
                      <p className="text-xs font-medium text-slate-600">1ª Parcela</p>
                      <p className="text-sm">{formatCurrency(rental.depositAmount)}</p>
                      {rental.depositPaymentDate && (
                        <p className="text-xs text-slate-500">
                          Venc: {format(new Date(rental.depositPaymentDate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}

                  {rental.depositInstallments >= 2 && rental.depositInstallment2 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600">2ª Parcela</p>
                      <p className="text-sm">{formatCurrency(rental.depositInstallment2)}</p>
                      {rental.depositInstallment2PaymentDate && (
                        <p className="text-xs text-slate-500">
                          Venc: {format(new Date(rental.depositInstallment2PaymentDate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}

                  {rental.depositInstallments === 3 && rental.depositInstallment3 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600">3ª Parcela</p>
                      <p className="text-sm">{formatCurrency(rental.depositInstallment3)}</p>
                      {rental.depositInstallment3PaymentDate && (
                        <p className="text-xs text-slate-500">
                          Venc: {format(new Date(rental.depositInstallment3PaymentDate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Recebimento por Parcela */}
              {depositInstallments.length > 0 && (
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-slate-600">Recebimentos:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {depositInstallments.map((installment) => (
                      <Button
                        key={installment.id}
                        type="button"
                        variant={installment.status === "paid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedInstallment(installment);
                          setPaymentDialogOpen(true);
                        }}
                        className="gap-2 justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Receipt className="h-3 w-3" />
                          Parcela {installment.installment_number}/{installment.total_installments}
                        </span>
                        <Badge 
                          variant={installment.status === "paid" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {installment.status === "paid"
                            ? "Pago"
                            : installment.status === "overdue"
                            ? "Atrasado"
                            : "Pendente"}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoSection>
        )}

        {/* Anexos */}
        <div className="pt-4 border-t">
          <RentalAttachmentsDialog
            rentalId={rental.id}
            attachments={normalizedAttachments}
            onAttachmentsUpdate={() => {
              // Força atualização da página de locações
              window.location.reload();
            }}
          />
        </div>
      </CardContent>

      {/* Dialog de Recebimento de Caução */}
      {selectedInstallment && (
        <DepositPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          installment={selectedInstallment}
          rental={rental}
          onSuccess={async () => {
            setPaymentDialogOpen(false);
            await reloadInstallments();
          }}
        />
      )}
    </Card>
  );
});