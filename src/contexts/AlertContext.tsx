import React, { createContext, useContext, useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { forceDialogCleanup } from "@/lib/forceCleanup";

type AlertType = "success" | "error" | "warning" | "info";

interface AlertOptions {
  title: string;
  description: string;
  type?: AlertType;
  onConfirm?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [alertData, setAlertData] = useState<AlertOptions>({
    title: "",
    description: "",
    type: "info",
  });

  // ✅ CAUSA RAIZ DO "TRAVAMENTO": este AlertDialog (Radix) e o Dialog do formulário
  // (ex: TenantFormDialog) são primitivas Radix independentes. Quando o Dialog do
  // formulário ainda está aberto no instante em que este AlertDialog abre, o Radix
  // "lembra" o body como bloqueado (pointer-events/scroll-lock) para restaurar depois.
  // Se o Dialog do formulário fechar ENQUANTO o AlertDialog ainda está aberto, e só
  // depois o usuário fechar o AlertDialog, o Radix restaura o body para o estado
  // "bloqueado" errado - deixando a página travada (nada clicável) até um F5.
  // A correção real é nunca deixar os dois modais abertos ao mesmo tempo: damos um
  // pequeno delay para o Dialog anterior terminar de fechar (animação ~200ms) antes
  // de abrir este.
  const showAlert = useCallback((options: AlertOptions) => {
    setAlertData(options);
    setTimeout(() => setOpen(true), 250);
  }, []);

  /**
   * ⚠️ DEFEITO CORRIGIDO EM 30/ago/2026 — "cliquei OK e a tela travou".
   *
   * Isto fazia `setOpen(false)` direto. Parece igual a fechar o alerta, mas
   * NÃO é: `onOpenChange` só dispara quando é o próprio Radix que fecha o
   * diálogo (Esc, clique fora). Fechando pelo estado, ele nunca é chamado --
   * e é dentro dele que mora a limpeza que destrava a página.
   *
   * Resultado: fechar com Esc funcionava, e fechar no botão OK -- que é o que
   * todo mundo faz -- deixava a página inteira sem responder até um F5.
   *
   * Agora o botão passa pelo mesmo caminho de qualquer outro fechamento.
   */
  const handleConfirm = () => {
    handleOpenChange(false);

    // Executar callback se existir
    if (alertData.onConfirm) {
      alertData.onConfirm();
    }
  };

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);

    if (!newOpen) {
      // ✅ Rede de segurança: se por algum motivo o Radix não restaurar o body a
      // tempo (ex: esse alerta fechou logo depois de outro diálogo/AlertDialog
      // fechar), a página trava sem nada clicável. forceDialogCleanup() faz uma
      // limpeza mais completa que só resetar o body (remove overlays e focus
      // guards órfãos, reseta pointer-events em qualquer elemento preso).
      setTimeout(() => {
        if (document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]').length === 0) {
          forceDialogCleanup();
        }
      }, 100);

      // Resetar data
      setAlertData({
        title: "",
        description: "",
        type: "info",
      });
    }
  }, []);

  const getIcon = () => {
    const iconClass = "h-6 w-6";
    switch (alertData.type) {
      case "success":
        return <CheckCircle2 className={`${iconClass} text-green-600`} />;
      case "error":
        return <XCircle className={`${iconClass} text-red-600`} />;
      case "warning":
        return <AlertCircle className={`${iconClass} text-yellow-600`} />;
      case "info":
      default:
        return <Info className={`${iconClass} text-blue-600`} />;
    }
  };

  const getBorderColor = () => {
    switch (alertData.type) {
      case "success":
        return "border-t-4 border-t-green-600";
      case "error":
        return "border-t-4 border-t-red-600";
      case "warning":
        return "border-t-4 border-t-yellow-600";
      case "info":
      default:
        return "border-t-4 border-t-blue-600";
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className={`max-w-md ${getBorderColor()}`}>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              {getIcon()}
              <AlertDialogTitle className="text-xl">{alertData.title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">
              {alertData.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={handleConfirm} className="w-full">
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}