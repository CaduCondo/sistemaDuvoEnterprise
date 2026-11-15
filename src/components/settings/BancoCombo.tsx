// Combo de banco com busca: "0341 - Itaú Unibanco", em ordem de número.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { BANCOS_PRINCIPAIS, carregarBancos, rotuloDoBanco, type Banco } from "@/lib/bancos";

interface Props {
  id: string;
  value: string; // texto guardado, ex.: "0341 - Itaú Unibanco"
  onChange: (valor: string) => void;
  disabled?: boolean;
}

export function BancoCombo({ id, value, onChange, disabled }: Props) {
  const [aberto, setAberto] = useState(false);
  const [bancos, setBancos] = useState<Banco[]>(BANCOS_PRINCIPAIS);

  useEffect(() => {
    let vivo = true;
    carregarBancos().then((l) => vivo && setBancos(l));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <Popover open={aberto} onOpenChange={setAberto} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-11 w-full justify-between font-normal"
        >
          <span className="truncate">{value || "Selecione o banco..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite o número ou o nome..." />
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
            <CommandGroup>
              {/* Valor antigo (digitado à mão) que não está na lista continua visível. */}
              {value && !bancos.some((b) => rotuloDoBanco(b) === value) && (
                <CommandItem value={value} onSelect={() => setAberto(false)}>
                  {value} (valor atual)
                </CommandItem>
              )}
              {bancos.map((b) => (
                <CommandItem
                  key={b.codigo}
                  value={rotuloDoBanco(b)}
                  onSelect={() => {
                    onChange(rotuloDoBanco(b));
                    setAberto(false);
                  }}
                >
                  {rotuloDoBanco(b)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
