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
    
    // ✅ LIMPEZA IMEDIATA E AGRESSIVA quando o dialog FECHA
    if (!newOpen) {
      console.log('🧹 [AlertContext] Dialog fechando - limpeza IMEDIATA');
      
      // ✅ CRÍTICO: Forçar pointer-events: auto IMEDIATAMENTE via CSS !important
      const forceClickable = () => {
        // Criar estilo !important para forçar cliques
        let style = document.getElementById('force-clickable');
        if (!style) {
          style = document.createElement('style');
          style.id = 'force-clickable';
          document.head.appendChild(style);
        }
        
        style.textContent = `
          html, html *, body, body *, 
          [data-radix-scroll-lock],
          [data-state="open"],
          [data-state="closed"] {
            pointer-events: auto !important;
            overflow: visible !important;
          }
        `;
        
        console.log('✅ [AlertContext] Estilo !important aplicado');
      };
      
      // Aplicar IMEDIATAMENTE
      forceClickable();
      
      // Limpar overlays após 100ms (garantir que dialog começou a fechar)
      setTimeout(() => {
        console.log('🧹 [AlertContext] Limpando overlays (100ms)...');
        
        const overlays = document.querySelectorAll(
          '[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0'
        );
        
        console.log(`🧹 [AlertContext] ${overlays.length} overlays encontrados`);
        
        overlays.forEach(overlay => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        });
        
        // Restaurar body
        document.body.style.overflow = '';
        document.body.style.pointerEvents = 'auto';
        document.body.style.paddingRight = '';
        document.documentElement.style.pointerEvents = 'auto';
        
        // Remover classes
        document.body.classList.remove('overflow-hidden', 'pointer-events-none');
        
        // Remover atributos
        document.documentElement.removeAttribute('data-radix-scroll-lock');
        document.body.removeAttribute('data-radix-scroll-lock');
        
        // Remover aria-hidden
        const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');
        hiddenElements.forEach(el => el.removeAttribute('aria-hidden'));
        
        console.log('✅ [AlertContext] Limpeza concluída (100ms)');
      }, 100);
      
      // Fallback final após 500ms
      setTimeout(() => {
        console.log('🧹 [AlertContext] FALLBACK FINAL (500ms)...');
        forceClickable();
        
        // Remover TODOS os overlays sem exceção
        const allOverlays = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
        allOverlays.forEach(overlay => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        });
        
        console.log('✅ [AlertContext] FALLBACK FINAL concluído');
      }, 500);
      
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