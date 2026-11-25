import { Calendar, ChevronDown } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOMES_DOS_MESES, alternarMes, alternarTodos, rotuloDoCombo, todosMarcados } from "@/lib/mesesFinanceiro";

interface MonthMultiSelectProps {
  selectedMonths: number[];
  onChange: (months: number[]) => void;
}

/**
 * Combo de meses com checkbox (issue #137, Financeiro). O primeiro item é
 * "Marcar todos" e vira "Desmarcar todos" quando os 12 estão marcados.
 * Mantém o id `period-selector-month` do seletor antigo.
 */
export const MonthMultiSelect = memo(function MonthMultiSelect({ selectedMonths, onChange }: MonthMultiSelectProps) {
  const todos = todosMarcados(selectedMonths);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="period-selector-month"
          type="button"
          variant="outline"
          className="w-[160px] h-9 text-xs bg-white shadow-sm border-gray-200 justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Calendar className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
            <span className="truncate">{rotuloDoCombo(selectedMonths)}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-1" align="start">
        <button
          type="button"
          id="period-month-toggle-all"
          className="w-full text-left text-xs font-semibold px-2 py-2 rounded hover:bg-slate-100"
          onClick={() => onChange(alternarTodos(selectedMonths))}
        >
          {todos ? "Desmarcar todos" : "Marcar todos"}
        </button>
        <div className="my-1 h-px bg-slate-200" />
        {NOMES_DOS_MESES.map((nome, i) => {
          const mes = i + 1;
          const id = `period-month-${mes}`;
          return (
            <label
              key={mes}
              htmlFor={id}
              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer hover:bg-slate-100"
            >
              <Checkbox
                id={id}
                checked={selectedMonths.includes(mes)}
                onCheckedChange={() => onChange(alternarMes(selectedMonths, mes))}
              />
              <span className="capitalize">{nome}</span>
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
});
