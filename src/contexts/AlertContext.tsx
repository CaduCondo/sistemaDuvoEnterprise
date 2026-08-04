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

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertData(options);
    setOpen(true);
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    
    // Executar callback se existir
    if (alertData.onConfirm) {
      alertData.onConfirm();
    }
  };

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    
    // ✅ CORREÇÃO CRÍTICA: Limpeza quando o dialog FECHA
    if (!newOpen) {
      // ✅ LIMPEZA IMEDIATA (0ms) - executar ASSIM QUE começar a fechar
      const cleanupOverlays = () => {
        console.log('🧹 [AlertContext] Iniciando limpeza de overlays...');
        
        // ✅ CRÍTICO: NÃO remover o AlertDialog que está fechando - remover apenas outros overlays
        const currentAlertDialog = document.querySelector('[role="alertdialog"]');
        
        const overlays = document.querySelectorAll(
          '[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"]'
        );
        
        console.log(`🧹 [AlertContext] ${overlays.length} overlays encontrados`);
        
        overlays.forEach(overlay => {
          // ✅ NÃO remover o AlertDialog que está fechando e seus overlays diretos
          if (overlay !== currentAlertDialog && 
              !currentAlertDialog?.contains(overlay) &&
              overlay.parentNode) {
            console.log('🧹 [AlertContext] Removendo overlay:', overlay.className);
            overlay.parentNode.removeChild(overlay);
          }
        });
        
        // ✅ CRÍTICO: Forçar pointer-events: auto IMEDIATAMENTE em TUDO
        document.body.style.overflow = '';
        document.body.style.pointerEvents = 'auto';
        document.body.style.paddingRight = '';
        
        // Forçar pointer-events em TODOS os elementos
        document.documentElement.style.pointerEvents = 'auto';
        
        // Forçar pointer-events: auto em todos os filhos diretos do body
        const bodyChildren = document.body.children;
        for (let i = 0; i < bodyChildren.length; i++) {
          const child = bodyChildren[i] as HTMLElement;
          child.style.pointerEvents = 'auto';
        }
        
        // Remover classes de modal que podem estar presas
        document.body.classList.remove('overflow-hidden', 'pointer-events-none');
        
        // Garantir que data-radix-* attributes são removidos
        document.documentElement.removeAttribute('data-radix-scroll-lock');
        document.body.removeAttribute('data-radix-scroll-lock');
        
        // Remover aria-hidden de TODOS os elementos EXCETO o AlertDialog que está fechando
        const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');
        hiddenElements.forEach(el => {
          if (el !== currentAlertDialog && !currentAlertDialog?.contains(el)) {
            el.removeAttribute('aria-hidden');
          }
        });
        
        console.log('✅ [AlertContext] Limpeza concluída');
      };
      
      // LIMPEZA 1: IMEDIATA (0ms)
      cleanupOverlays();
      
      // LIMPEZA 2: FALLBACK 300ms (AlertDialog já deve ter fechado)
      setTimeout(() => {
        console.log('🧹 [AlertContext] FALLBACK 300ms - Segunda limpeza...');
        cleanupOverlays();
        
        // ✅ CRÍTICO: Forçar pointer-events com !important via CSS
        const style = document.createElement('style');
        style.id = 'force-pointer-events';
        style.textContent = `
          body, body *, html, html * {
            pointer-events: auto !important;
          }
        `;
        
        // Remover estilo antigo se existir
        const oldStyle = document.getElementById('force-pointer-events');
        if (oldStyle) oldStyle.remove();
        
        document.head.appendChild(style);
        
        console.log('✅ [AlertContext] Pointer-events forçado com !important');
        
        // Remover após 2 segundos
        setTimeout(() => {
          const forceStyle = document.getElementById('force-pointer-events');
          if (forceStyle) forceStyle.remove();
          console.log('✅ [AlertContext] Estilo !important removido');
        }, 2000);
      }, 300);
      
      // LIMPEZA 3: FALLBACK FINAL 1000ms (garantia máxima)
      setTimeout(() => {
        console.log('🧹 [AlertContext] FALLBACK 1000ms - Limpeza final...');
        
        // Remover TODOS os overlays sem exceção
        const allOverlays = document.querySelectorAll(
          '[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"], [role="alertdialog"]'
        );
        
        allOverlays.forEach(overlay => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        });
        
        // Forçar limpeza de TODOS os atributos problemáticos
        document.body.style.overflow = '';
        document.body.style.pointerEvents = 'auto';
        document.body.style.paddingRight = '';
        document.documentElement.style.pointerEvents = 'auto';
        document.body.classList.remove('overflow-hidden', 'pointer-events-none');
        document.documentElement.removeAttribute('data-radix-scroll-lock');
        document.body.removeAttribute('data-radix-scroll-lock');
        
        console.log('✅ [AlertContext] Limpeza final concluída');
      }, 1000);
      
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