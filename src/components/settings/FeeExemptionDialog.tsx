import { useState, useEffect } from "react";
import { Location } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface FeeExemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  onSave: (locationIds: string[]) => Promise<boolean>;
  getExemptions: () => Promise<string[]>;
  title?: string;
  description?: string;
}

export function FeeExemptionDialog({
  open,
  onOpenChange,
  locations,
  onSave,
  getExemptions,
  title = "Configurar Isenção de Taxa de Administração",
  description = "Selecione os locais que estão isentos da taxa de administração",
}: FeeExemptionDialogProps) {
  const { toast } = useToast();
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const loadExemptions = async () => {
      if (open && !hasLoaded) {
        setIsLoading(true);
        try {
          const exemptions = await getExemptions();
          setSelectedLocations(exemptions);
          setHasLoaded(true);
        } catch (error) {
          console.error("Erro ao carregar isenções:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar as isenções.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadExemptions();
  }, [open, hasLoaded, getExemptions, toast]);

  useEffect(() => {
    if (!open) {
      setHasLoaded(false);
    }
  }, [open]);

  // ⚠️ 06/out/2026 (achado pelo teste de isenção, CI #94): no primeiro
  // desenho do diálogo a lista já aparecia, ANTES de começar a buscar as
  // isenções salvas. Um clique nesse instante marcava o local e, logo em
  // seguida, a busca terminava e sobrescrevia a marcação -- o "Salvar"
  // gravava sem o local clicado. Agora a lista só aparece depois da busca.
  const carregando = isLoading || (open && !hasLoaded);

  const handleToggle = (locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await onSave(selectedLocations);
      if (success) {
        toast({
          title: "Sucesso",
          description: "Isenções salvas com sucesso!",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível salvar as isenções.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar isenções:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar as isenções.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            <br />
            <span className="text-amber-600 font-medium mt-2 block">
              ⚠️ Quando um local está isento, a taxa NÃO será cobrada dele, independente de quem recebeu o pagamento.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum local cadastrado.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {locations.map((location) => {
                const isExempt = selectedLocations.includes(location.id);
                return (
                  <div
                    key={location.id}
                    className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                      isExempt
                        ? "bg-amber-50 border-amber-200"
                        : "hover:bg-accent border-transparent"
                    }`}
                  >
                    <Checkbox
                      id={`location-${location.id}`}
                      checked={isExempt}
                      onCheckedChange={() => handleToggle(location.id)}
                    />
                    <Label
                      htmlFor={`location-${location.id}`}
                      className="text-sm font-normal cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <span>{location.name}</span>
                      {isExempt && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Isento
                        </span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || carregando}>
            {isSaving ? "Salvando..." : "Salvar Isenções"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}