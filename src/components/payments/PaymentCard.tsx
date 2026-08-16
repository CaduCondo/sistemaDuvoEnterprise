import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, User, Calendar, X, FileText, Paperclip, Download, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/masks";
import type { Payment, Property, Tenant } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaymentCardProps {
  payment: Payment;
  property: Property | null;
  tenant: Tenant | null;
  isPaid: boolean;
  viewMode: "grid" | "list";
  installment: string;
  expectedAmount: number;
  onCardClick: (paymentId: string) => void;
  onCancelPayment?: (paymentId: string, e: React.MouseEvent) => void;
  onViewReceipt?: (paymentId: string, e: React.MouseEvent) => void;
  getMonthName: (month: number) => string;
  onClick?: () => void;
}

// Helper para determinar cores baseado na data de vencimento
const getDueDateColor = (dueDate: string, isPaid: boolean): { border: string; icon: string; amount: string } => {
  if (isPaid) {
    return { 
      border: "border-l-green-500", 
      icon: "text-green-600", 
      amount: "text-green-600" 
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  
  if (due < today) {
    return { 
      border: "border-l-red-500", 
      icon: "text-red-600", 
      amount: "text-red-600" 
    };
  } else if (due.getTime() === today.getTime()) {
    return { 
      border: "border-l-yellow-500", 
      icon: "text-yellow-600", 
      amount: "text-yellow-600" 
    };
  } else {
    return { 
      border: "border-l-blue-500", 
      icon: "text-blue-600", 
      amount: "text-blue-600" 
    };
  }
};

// Helper para badge de status
const getStatusBadge = (status: Payment["status"]) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-500 text-white text-xs">Pago</Badge>;
    case "partial":
      return <Badge className="bg-yellow-500 text-white text-xs">Parcial</Badge>;
    case "overdue":
      return <Badge className="bg-red-500 text-white text-xs">Atrasado</Badge>;
    default:
      return <Badge className="bg-gray-500 text-white text-xs">Pendente</Badge>;
  }
};

// Helper para verificar se há anexos
const hasAttachments = (payment: Payment): boolean => {
  return payment.attachments && Array.isArray(payment.attachments) && payment.attachments.length > 0;
};

// ✅ Recebimento de rescisão de contrato (junta aluguel proporcional +
// despesas - devolução de caução em um recebimento só, que pode até ficar
// negativo) - mostramos uma etiqueta pra não parecer um recebimento comum.
const isTerminationPayment = (payment: Payment): boolean => {
  return payment.notes?.includes("Rescisão de Contrato") || false;
};

export const PaymentCard = memo(function PaymentCard({
  payment,
  property,
  tenant,
  isPaid,
  viewMode,
  installment,
  expectedAmount,
  onCardClick,
  onCancelPayment,
  onViewReceipt,
  getMonthName,
  onClick,
}: PaymentCardProps) {
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  
  const isPartial = payment.status === "partial";
  
  // 🔥 CORREÇÃO: Preservar sinal do expectedAmount - NÃO usar Math.abs()
  const totalExpectedAmount = expectedAmount;
  
  // 🔥 CORREÇÃO: Preservar sinal do remainingAmount
  const remainingAmount = isPartial ? totalExpectedAmount - payment.paidAmount : totalExpectedAmount;
  const displayAmount = isPaid ? payment.paidAmount : remainingAmount;

  // 🔥 CORREÇÃO: Determinar cor baseado no sinal E status - valores negativos = vermelho
  const getAmountColor = (): string => {
    if (isPaid && displayAmount < 0) return "text-red-600"; // Valor negativo pago = vermelho (devolução)
    if (isPaid) return "text-green-600"; // Valor positivo pago = verde
    if (displayAmount < 0) return "text-red-600"; // Valor negativo a pagar = vermelho
    if (isPartial) return "text-yellow-600";
    return getDueDateColor(payment.dueDate, isPaid).amount;
  };

  const colors = useMemo(() => 
    getDueDateColor(payment.dueDate, isPaid),
    [payment.dueDate, isPaid]
  );

  const amountColor = getAmountColor();

  // 🔥 CORREÇÃO CRÍTICA: NÃO usar Math.abs() - preservar sinal negativo
  const formattedDisplayAmount = useMemo(() => {
    const isNegative = displayAmount < 0;
    const absValue = Math.abs(displayAmount);
    const formatted = formatCurrency(absValue);
    return isNegative ? `- ${formatted}` : formatted;
  }, [displayAmount]);

  const formattedPaidAmount = useMemo(() => {
    const isNegative = payment.paidAmount < 0;
    const absValue = Math.abs(payment.paidAmount);
    const formatted = formatCurrency(absValue);
    return isNegative ? `- ${formatted}` : formatted;
  }, [payment.paidAmount]);

  if (viewMode === "grid") {
    return (
      <Card
        className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 ${colors.border} active:scale-[0.98] touch-target`}
        onClick={onClick}
      >
        <CardHeader className="pb-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Home className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className={`font-semibold text-sm sm:text-base ${!isPaid ? colors.icon : ''} block truncate`}>
                  {property?.location || "Imóvel não encontrado"}
                </span>
                {property?.complement && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {property.complement}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {getMonthName(payment.referenceMonth)}/{payment.referenceYear}
              </span>
              {getStatusBadge(payment.status)}
              {isTerminationPayment(payment) && (
                <Badge className="bg-purple-500 text-white text-xs">Rescisão</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 p-4 pt-0">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <span className="font-medium block">{tenant?.name || "Inquilino não identificado"}</span>
              {tenant?.phone && (
                <span className="text-xs text-muted-foreground block">{tenant.phone}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                {isPaid ? "Pago em: " : "Vencimento: "}
                {isPaid 
                  ? (payment.paymentDate ? new Date(payment.paymentDate + "T12:00:00").toLocaleDateString("pt-BR") : "N/A")
                  : new Date(payment.dueDate + "T12:00:00").toLocaleDateString("pt-BR")
                }
              </p>
            </div>
          </div>

          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground">
                {isPaid ? "Valor Pago" : (isPartial ? "Valor Restante" : "Valor Esperado")}
              </p>
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Parcela {installment}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-2xl sm:text-3xl font-bold ${amountColor}`}>
                {formattedDisplayAmount}
              </p>
              {hasAttachments(payment) && (
                <div 
                  id={`payment-card-attachments-${payment.id}`}
                  className="cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttachmentsModal(true);
                  }}
                  title={`Ver ${Array.isArray(payment.attachments) ? payment.attachments.length : 0} anexo(s)`}
                >
                  <Paperclip className="h-4 w-4 text-purple-600" />
                </div>
              )}
            </div>
          </div>

          {isPartial && payment.paidAmount !== 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Valor Já Pago</p>
              <p className={`text-lg font-semibold ${payment.paidAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formattedPaidAmount}
              </p>
            </div>
          )}

          {!isPaid && !isPartial && payment.paidAmount !== 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Valor Pago</p>
              <p className={`text-lg font-semibold ${payment.paidAmount < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                {formattedPaidAmount}
              </p>
            </div>
          )}

          {/* Botões de ação */}
          <div className="pt-3 border-t space-y-2">
            {isPaid && onViewReceipt && (
              <Button
                id={`payment-card-receipt-${payment.id}`}
                variant="outline"
                size="sm"
                className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewReceipt(payment.id, e);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Ver Recibo
              </Button>
            )}
            
            {isPaid && onCancelPayment && (
              <Button
                id={`payment-card-cancel-${payment.id}`}
                variant="outline"
                size="sm"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelPayment(payment.id, e);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar Pagamento
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // List view - mesmas correções
  return (
    <>
      <Card
        className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 ${colors.border} active:scale-[0.98]`}
        onClick={onClick}
      >
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Home className={`h-6 w-6 ${colors.icon} flex-shrink-0 mt-1`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs text-muted-foreground">
                    {getMonthName(payment.referenceMonth)}/{payment.referenceYear}
                  </span>
                  {getStatusBadge(payment.status)}
                  {isTerminationPayment(payment) && (
                    <Badge className="bg-purple-500 text-white text-xs">Rescisão</Badge>
                  )}
                  {hasAttachments(payment) && (
                    <div 
                      id={`payment-list-attachments-${payment.id}`}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full p-1 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAttachmentsModal(true);
                      }}
                      title={`Ver ${Array.isArray(payment.attachments) ? payment.attachments.length : 0} anexo(s)`}
                    >
                      <Paperclip className="h-4 w-4 text-purple-600" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">
                    Parcela {installment}
                  </span>
                </div>
                {property ? (
                  <div className="space-y-0.5">
                    <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 block">
                      {property.location || "Local não informado"}
                    </span>
                    {property.complement && (
                      <span className="text-sm text-muted-foreground block">
                        {property.complement}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-base sm:text-lg font-semibold">Imóvel não encontrado</span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="grid grid-cols-2 sm:flex sm:gap-4">
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">Inquilino</p>
                  <p className="text-sm font-medium truncate">{tenant?.name || "N/A"}</p>
                  {tenant?.phone && (
                    <p className="text-xs text-muted-foreground">{tenant.phone}</p>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {isPaid ? "Pago em" : "Vencimento"}
                  </p>
                  <p className="text-sm font-medium">
                    {isPaid 
                      ? (payment.paymentDate ? new Date(payment.paymentDate + "T12:00:00").toLocaleDateString("pt-BR") : "N/A")
                      : new Date(payment.dueDate + "T12:00:00").toLocaleDateString("pt-BR")
                    }
                  </p>
                  {isPaid && payment.paymentMethod && (
                    <p className="text-xs text-muted-foreground capitalize">{payment.paymentMethod}</p>
                  )}
                </div>
              </div>
              
              <div className="text-left sm:text-right sm:min-w-[120px]">
                <p className="text-xs text-muted-foreground mb-1">
                  {isPaid ? "Valor Pago" : (isPartial ? "Valor Restante" : "Valor Esperado")}
                </p>
                <p className={`text-xl sm:text-2xl font-bold ${amountColor}`}>
                  {formattedDisplayAmount}
                </p>
                {isPartial && payment.paidAmount !== 0 && (
                  <p className={`text-xs font-semibold mt-1 ${payment.paidAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Já pago: {formattedPaidAmount}
                  </p>
                )}
                {!isPaid && !isPartial && payment.paidAmount !== 0 && (
                  <p className={`text-xs font-semibold mt-1 ${payment.paidAmount < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                    Pago: {formattedPaidAmount}
                  </p>
                )}
              </div>
            </div>
            
            {/* Botões de ação no modo List */}
            {isPaid && (onViewReceipt || onCancelPayment) && (
              <div className="flex flex-col gap-2 sm:flex-shrink-0 pt-3 border-t sm:border-t-0 sm:pt-0">
                {onViewReceipt && (
                  <Button
                    id={`payment-list-receipt-${payment.id}`}
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReceipt(payment.id, e);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="text-xs sm:text-sm">Ver Recibo</span>
                  </Button>
                )}
                
                {onCancelPayment && (
                  <Button
                    id={`payment-list-cancel-${payment.id}`}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelPayment(payment.id, e);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    <span className="text-xs sm:text-sm">Cancelar Pagamento</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Anexos */}
      <Dialog open={showAttachmentsModal} onOpenChange={setShowAttachmentsModal}>
        <DialogContent id={`payment-attachments-modal-${payment.id}`} className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anexos do Pagamento</DialogTitle>
            <DialogDescription>
              {property?.location} - {getMonthName(payment.referenceMonth)}/{payment.referenceYear}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {payment.attachments && Array.isArray(payment.attachments) && payment.attachments.map((attachment: any, index: number) => {
              const url = typeof attachment === 'string' ? attachment : attachment.url;
              const name = typeof attachment === 'string' 
                ? `Anexo ${index + 1}` 
                : (attachment.name || `Anexo ${index + 1}`);
              const description = typeof attachment === 'string' ? '' : (attachment.description || '');
              
              // Determinar se é imagem ou PDF
              const isImage = url?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
              const isPDF = url?.toLowerCase().match(/\.pdf$/);
              
              // Normalizar URL
              let normalizedUrl = url;
              if (url && !url.startsWith('http')) {
                normalizedUrl = url.startsWith('/') ? url : `/${url}`;
              }
              
              return (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Preview */}
                    <div className="mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden h-48 flex items-center justify-center">
                      {isImage ? (
                        <img 
                          src={normalizedUrl} 
                          alt={name}
                          className="max-w-full max-h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => window.open(normalizedUrl, '_blank', 'noopener,noreferrer')}
                        />
                      ) : isPDF ? (
                        <div className="text-center">
                          <FileText className="h-16 w-16 text-red-500 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">PDF</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Paperclip className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Arquivo</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="space-y-2">
                      <p className="font-medium text-sm truncate" title={name}>{name}</p>
                      {description && (
                        <p className="text-xs text-muted-foreground truncate" title={description}>
                          {description}
                        </p>
                      )}
                      
                      {/* Botões */}
                      <div className="flex gap-2">
                        <Button
                          id={`attachment-open-${index}`}
                          variant="outline"
                          size="sm"
                          className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => window.open(normalizedUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir
                        </Button>
                        <Button
                          id={`attachment-download-${index}`}
                          variant="outline"
                          size="sm"
                          className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = normalizedUrl;
                            link.download = name;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});