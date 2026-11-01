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

// Diálogos do Radix ficam na tela com data-state="closed" enquanto fazem a
// animação de fechar, e só depois somem.
const SELETOR_FECHANDO = '[role="dialog"][data-state="closed"], [role="alertdialog"][data-state="closed"]';
const SELETOR_QUALQUER = '[role="dialog"], [role="alertdialog"]';
const SELETOR_ABERTO = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function abrirQuandoNadaEstiverFechando(abrir: () => void) {
  const inicio = Date.now();
  const conferir = () => {
    const passou = Date.now() - inicio;
    const fechando = document.querySelectorAll(SELETOR_FECHANDO).length > 0;
    // Mínimo de 250ms (o formulário pode ainda nem ter começado a fechar no
    // instante em que o aviso é pedido) e máximo de 1,5s.
    if ((passou >= 250 && !fechando) || passou >= 1500) {
      // Se não sobrou diálogo aberto nenhum e o body ficou travado, destrava
      // ANTES de abrir -- senão o aviso memoriza o body travado.
      if (document.querySelectorAll(SELETOR_ABERTO).length === 0 && document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
      abrir();
      return;
    }
    setTimeout(conferir, 50);
  };
  setTimeout(conferir, 50);
}

function limparQuandoTudoFechar() {
  const inicio = Date.now();
  const conferir = () => {
    const sobrouAberto = document.querySelectorAll(SELETOR_ABERTO).length > 0;
    if (sobrouAberto) return; // outro diálogo abriu: ele cuida do body
    const sobrouAlgum = document.querySelectorAll(SELETOR_QUALQUER).length > 0;
    if (!sobrouAlgum) {
      forceDialogCleanup();
      return;
    }
    if (Date.now() - inicio < 2000) setTimeout(conferir, 100);
    else forceDialogCleanup();
  };
  setTimeout(conferir, 100);
}

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
  //
  // ⚠️ REFEITO EM 01/nov/2026 — o "esperar 250ms" não bastava. Em tela pesada
  // (Imóveis com 140+ linhas, ou o CI do GitHub, mais lento) o formulário
  // ainda estava no meio da animação de fechar quando o aviso abria. O aviso
  // então "memorizava" o body como travado (pointer-events: none) e, ao
  // fechar, devolvia o body travado -- tela sem aceitar clique até um F5.
  // Visto em produção ao criar imóvel e no smoke do run #115 (caução).
  // Agora esperamos de verdade: o aviso só abre quando nenhum diálogo está
  // mais no meio de fechar (no máximo 1,5s, para nunca sumir o aviso).
  const showAlert = useCallback((options: AlertOptions) => {
    setAlertData(options);
    abrirQuandoNadaEstiverFechando(() => setOpen(true));
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
      // (01/nov/2026) Antes era UMA conferência aos 100ms -- cedo demais: o
      // Radix só devolve o body quando o aviso termina de sumir (animação),
      // e se ele devolvesse "travado" depois disso, ninguém mais arrumava.
      // Agora confere até o aviso sumir de vez (no máximo 2s).
      limparQuandoTudoFechar();

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