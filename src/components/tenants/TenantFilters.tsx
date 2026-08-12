import { memo, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter } from "lucide-react";

interface TenantFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;
  sortBy: "alphabetical" | "recent";
  onSortChange: (value: "alphabetical" | "recent") => void;
  totalCount: number;
}

// ✅ CORREÇÃO: o valor real do status gravado no banco é "active" (ver
// tenants.tsx/getStatusBadge), não "new". Com "new" o filtro nunca encontrava
// nenhum inquilino, porque nenhum registro tem esse valor.
const statusOptions = [
  { value: "active", label: "Disponível" },
  { value: "rented", label: "Locatário" },
  { value: "inactive", label: "Inativo" },
];

export function TenantFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  totalCount,
}: TenantFiltersProps) {
  const countText = useMemo(() => 
    `${totalCount} ${totalCount === 1 ? "inquilino encontrado" : "inquilinos encontrados"}`,
    [totalCount]
  );

  const statusText = useMemo(() => {
    if (statusFilter.length === 0) return "Todos";
    return statusOptions
      .filter(opt => statusFilter.includes(opt.value))
      .map(opt => opt.label)
      .join(", ");
  }, [statusFilter]);

  const handleStatusToggle = (value: string) => {
    if (statusFilter.includes(value)) {
      onStatusFilterChange(statusFilter.filter(s => s !== value));
    } else {
      onStatusFilterChange([...statusFilter, value]);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-full">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-medium">
          {countText}
        </div>
        
        <div className="hidden lg:block w-[180px] text-sm font-medium text-foreground text-left">Status:</div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 lg:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="tenant-filters-search"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="hidden lg:flex ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button id="tenant-filters-status" variant="outline" className="w-[180px] h-10 justify-between">
                <span className="truncate">{statusText}</span>
                <Filter className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[180px] p-3" align="start">
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                  >
                    <Checkbox
                      id={`tenant-status-${option.value}`}
                      checked={statusFilter.includes(option.value)}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}