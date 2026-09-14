import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { memo } from "react";

interface PeriodSelectorProps {
  selectedMonth: number | string;
  selectedYear: number | string;
  onPeriodChange?: (month: number | string, year: number | string) => void;
  // Props de compatibilidade para financial.tsx
  filterMonth?: number | string;
  filterYear?: number | string;
  onMonthChange?: (month: number | string) => void;
  onYearChange?: (year: number | string) => void;
  onFilterMonthChange?: (month: number | string) => void;
  onFilterYearChange?: (year: number | string) => void;
  showAllOption?: boolean;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const PeriodSelector = memo(function PeriodSelector({ 
  selectedMonth, 
  selectedYear, 
  onPeriodChange,
  filterMonth,
  filterYear,
  onMonthChange,
  onYearChange,
  onFilterMonthChange,
  onFilterYearChange,
  showAllOption = true
}: PeriodSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  // Usa filterMonth/Year se disponível (para financial.tsx), senão usa selectedMonth/Year (dashboard)
  const displayMonth = filterMonth || selectedMonth || "all";
  const displayYear = filterYear || selectedYear || "all";

  const handleMonthChange = (value: string) => {
    const newMonth = value === "all" ? "all" : parseInt(value);
    
    // Dashboard handler
    if (onPeriodChange) {
      onPeriodChange(newMonth, displayYear);
    }
    
    // Financial handlers
    if (onMonthChange) onMonthChange(newMonth);
    if (onFilterMonthChange) onFilterMonthChange(newMonth);
  };

  const handleYearChange = (value: string) => {
    const newYear = value === "all" ? "all" : parseInt(value);
    
    // Dashboard handler
    if (onPeriodChange) {
      onPeriodChange(displayMonth, newYear);
    }
    
    // Financial handlers
    if (onYearChange) onYearChange(newYear);
    if (onFilterYearChange) onFilterYearChange(newYear);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={displayMonth.toString()}
        onValueChange={handleMonthChange}
      >
        {/* ⚠️ Adicionado em 14/set/2026 (issue #99): este é o seletor de
            período REAL usado em Pagamentos/Financeiro/Dashboard -- os
            testes automatizados vinham mirando `PaymentFilters.tsx`
            ("payment-filters-month"), um componente antigo que não é mais
            usado em lugar nenhum. Sem nenhum id aqui, o teste nunca achava
            o campo e ficava girando até estourar o timeout. */}
        <SelectTrigger id="period-selector-month" className="w-[140px] h-9 text-xs bg-white shadow-sm border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <SelectValue placeholder="Mês" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all" className="text-xs">
              Todos os meses
            </SelectItem>
          )}
          {MONTHS.map((month, index) => (
            <SelectItem key={index + 1} value={(index + 1).toString()} className="text-xs">
              {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={displayYear.toString()}
        onValueChange={handleYearChange}
      >
        <SelectTrigger id="period-selector-year" className="w-[120px] h-9 text-xs bg-white shadow-sm border-gray-200">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all" className="text-xs">
              Todos os anos
            </SelectItem>
          )}
          {years.map((year) => (
            <SelectItem key={year} value={year.toString()} className="text-xs">
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});