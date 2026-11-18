// Combo de banco com busca: "0341 - Itaú Unibanco", em ordem de número.
// Feito sem janelinha flutuante (Popover): dentro da tela de cadastro o campo
// de busca não aceitava clique. A lista abre aqui mesmo, embaixo do botão.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { BANCOS_PRINCIPAIS, carregarBancos, rotuloDoBanco, type Banco } from "@/lib/bancos";

interface Props {
  id: string;
  value: string; // texto guardado, ex.: "0341 - Itaú Unibanco"
  onChange: (valor: string) => void;
  disabled?: boolean;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BancoCombo({ id, value, onChange, disabled }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [bancos, setBancos] = useState<Banco[]>(BANCOS_PRINCIPAIS);
  const campoBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    carregarBancos().then((l) => vivo && setBancos(l));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (aberto) campoBusca.current?.focus();
  }, [aberto]);

  const termo = semAcento(busca.trim());
  const filtrados = termo ? bancos.filter((b) => semAcento(rotuloDoBanco(b)).includes(termo)) : bancos;

  return (
    <div className="space-y-2">
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => {
          setAberto((a) => !a);
          setBusca("");
        }}
        className="h-11 w-full justify-between font-normal"
      >
        <span className="truncate">{value || "Selecione o banco..."}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {aberto && (
        <div id={`${id}-lista`} className="rounded-md border bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={campoBusca}
              id={`${id}-busca`}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o número ou o nome..."
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtrados.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum banco encontrado.</p>
            )}
            {filtrados.map((b) => {
              const rotulo = rotuloDoBanco(b);
              return (
                <button
                  key={b.codigo}
                  type="button"
                  onClick={() => {
                    onChange(rotulo);
                    setAberto(false);
                  }}
                  className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${rotulo === value ? "opacity-100" : "opacity-0"}`} />
                  {rotulo}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
