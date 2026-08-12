import { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Trash2, Phone, Mail, FileText, CreditCard } from "lucide-react";
import { Tenant } from "@/types";

interface TenantCardProps {
  tenant: Tenant;
  onClick: () => void;
  onDelete: () => void;
  viewMode?: "grid" | "list";
}

// ✅ CORREÇÃO: o valor real do status gravado no banco é "active" (ver
// tenants.tsx/getStatusBadge), não "new". Com "new" o card sempre caía no
// estilo/label "default" (cinza, mostrando o valor cru "active") para
// qualquer inquilino disponível.
const STATUS_STYLES = {
  active: "bg-green-500 hover:bg-green-600",
  rented: "bg-blue-500 hover:bg-blue-600",
  inactive: "bg-red-500 hover:bg-red-600",
  default: "bg-gray-500 hover:bg-gray-600",
} as const;

const statusLabels: Record<string, string> = {
  active: "Disponível",
  rented: "Locatário",
  inactive: "Inativo",
};

export const TenantCard = memo(function TenantCard({ tenant, onClick, onDelete, viewMode = "grid" }: TenantCardProps) {
  const statusColor = useMemo(() => 
    STATUS_STYLES[tenant.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.default,
    [tenant.status]
  );

  const statusLabel = useMemo(() => 
    statusLabels[tenant.status as keyof typeof statusLabels] || tenant.status,
    [tenant.status]
  );

  const displayDocument = useMemo(() => 
    tenant.document || tenant.cpf || "N/A",
    [tenant.document, tenant.cpf]
  );

  if (viewMode === "list") {
    return (
      <Card 
        className="card-hover-effect touch-target-card bg-white dark:bg-slate-800" 
        onClick={onClick}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-full p-2.5 sm:p-3 flex-shrink-0">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 truncate">
                    {tenant.name}
                  </h3>
                  <Badge className={`${statusColor} text-white px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-md flex-shrink-0 sm:hidden`}>
                    {statusLabel}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">CPF: {displayDocument}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{tenant.email || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{tenant.phone || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
              <Badge className={`${statusColor} text-white px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md hidden sm:inline-flex`}>
                {statusLabel}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="card-hover-effect touch-target-card bg-white dark:bg-slate-800 relative" 
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-full p-2 flex-shrink-0">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-blue-600 dark:text-blue-400 truncate">
              {tenant.name}
            </h3>
          </div>
          <Badge className={`${statusColor} text-white px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-md flex-shrink-0`}>
            {statusLabel}
          </Badge>
        </div>
        
        <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" strokeWidth={1.5} />
            <span className="truncate">CPF: {displayDocument}</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" strokeWidth={1.5} />
            <span className="truncate">RG: {tenant.rg || "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" strokeWidth={1.5} />
            <span className="truncate">{tenant.email || "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" strokeWidth={1.5} />
            <span className="truncate">{tenant.phone || "N/A"}</span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-3 right-3 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </Button>
      </CardContent>
    </Card>
  );
});