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
    
    // ✅ LIMPEZA ULTRA-AGRESSIVA quando o dialog FECHA
    if (!newOpen) {
      console.log('🧹 [AlertContext] Dialog fechando - LIMPEZA ULTRA-AGRESSIVA');
      
      // ✅ FUNÇÃO: Forçar pointer-events: auto em TUDO
      const forceClickable = () => {
        console.log('🔧 [AlertContext] Forçando pointer-events: auto...');
        
        // Criar/atualizar estilo !important
        let style = document.getElementById('force-clickable');
        if (!style) {
          style = document.createElement('style');
          style.id = 'force-clickable';
          document.head.appendChild(style);
        }
        
        style.textContent = `
          html, html *, 
          body, body *, 
          #__next, #__next *,
          [data-radix-scroll-lock],
          [data-state="open"],
          [data-state="closed"],
          div, span, button, a, input, textarea, select {
            pointer-events: auto !important;
            overflow: visible !important;
          }
        `;
        
        // Forçar diretamente no body e html
        document.body.style.cssText = 'pointer-events: auto !important; overflow: visible !important;';
        document.documentElement.style.cssText = 'pointer-events: auto !important; overflow: visible !important;';
        
        console.log('✅ [AlertContext] Pointer-events forçado com !important');
      };
      
      // ✅ FUNÇÃO: Remover overlays
      const removeOverlays = () => {
        console.log('🧹 [AlertContext] Removendo overlays...');
        
        const overlays = document.querySelectorAll(
          '[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"], [role="alertdialog"]'
        );
        
        console.log(`🧹 [AlertContext] ${overlays.length} overlays encontrados`);
        
        overlays.forEach(overlay => {
          if (overlay.parentNode) {
            try {
              overlay.parentNode.removeChild(overlay);
            } catch (e) {
              console.warn('⚠️ Erro ao remover overlay:', e);
            }
          }
        });
        
        // Limpar atributos problemáticos
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('overflow-hidden', 'pointer-events-none');
        document.documentElement.removeAttribute('data-radix-scroll-lock');
        document.body.removeAttribute('data-radix-scroll-lock');
        
        // Remover aria-hidden
        const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');
        hiddenElements.forEach(el => {
          try {
            el.removeAttribute('aria-hidden');
          } catch (e) {
            console.warn('⚠️ Erro ao remover aria-hidden:', e);
          }
        });
        
        console.log('✅ [AlertContext] Overlays removidos');
      };
      
      // ✅ APLICAR IMEDIATAMENTE (0ms)
      forceClickable();
      removeOverlays();
      
      // ✅ FALLBACK 1: 50ms
      setTimeout(() => {
        console.log('🔧 [AlertContext] FALLBACK 50ms');
        forceClickable();
        removeOverlays();
      }, 50);
      
      // ✅ FALLBACK 2: 150ms
      setTimeout(() => {
        console.log('🔧 [AlertContext] FALLBACK 150ms');
        forceClickable();
        removeOverlays();
      }, 150);
      
      // ✅ FALLBACK 3: 300ms
      setTimeout(() => {
        console.log('🔧 [AlertContext] FALLBACK 300ms');
        forceClickable();
        removeOverlays();
      }, 300);
      
      // ✅ FALLBACK FINAL: 600ms
      setTimeout(() => {
        console.log('🔧 [AlertContext] FALLBACK FINAL 600ms');
        forceClickable();
        removeOverlays();
        
        // Remover o estilo !important após 2 segundos
        setTimeout(() => {
          const style = document.getElementById('force-clickable');
          if (style) {
            style.remove();
            console.log('✅ [AlertContext] Estilo !important removido');
          }
        }, 2000);
      }, 600);
      
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