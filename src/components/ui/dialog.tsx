"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { isLightboxOpen } from "@/lib/lightboxState"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  preventClose?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, preventClose = false, onPointerDownOutside, onEscapeKeyDown, onInteractOutside, ...props }, ref) => {
  // Cleanup only body styles when component unmounts
  React.useEffect(() => {
    return () => {
      // Only reset body styles - let Radix handle its own cleanup
      setTimeout(() => {
        // Only reset if no other dialogs are open
        const openDialogs = document.querySelectorAll('[data-radix-dialog-content][data-state="open"]');
        if (openDialogs.length === 0) {
          document.body.style.pointerEvents = '';
          document.body.style.overflow = '';
          document.body.removeAttribute('data-scroll-locked');
        }
      }, 100);
    };
  }, []);

  const handlePreventClose = (e: Event) => {
    if (preventClose) {
      e.preventDefault();
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        onPointerDownOutside={(e) => {
          // ✅ CORREÇÃO CRÍTICA: o Lightbox (visualizador de imagem) abre num portal
          // fora da árvore desse Dialog. Sem isso, o Radix entende qualquer clique
          // dentro do Lightbox (inclusive o botão de fechar) como um "clique fora"
          // e fecha esse Dialog inteiro junto - perdendo o que o usuário estava
          // preenchendo no formulário. Enquanto o Lightbox estiver aberto, ignora
          // esse "clique fora".
          if (isLightboxOpen()) {
            e.preventDefault();
            return;
          }
          handlePreventClose(e);
          onPointerDownOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          // ✅ CORREÇÃO: mesma proteção já aplicada em onPointerDownOutside e
          // onInteractOutside acima, mas que faltava aqui. Sem isso, apertar Esc
          // para fechar o Lightbox também fechava esse Dialog por trás ao mesmo
          // tempo (os dois fechando no mesmo instante é a mesma causa raiz do
          // travamento de tela já documentado em AlertContext.tsx/RentalFormDialog.tsx
          // - o Radix perde a conta de quem deve liberar o scroll/pointer-events
          // do body). Enquanto o Lightbox estiver aberto, ignora o Esc aqui.
          if (isLightboxOpen()) {
            e.preventDefault();
            return;
          }
          handlePreventClose(e);
          onEscapeKeyDown?.(e);
        }}
        onInteractOutside={(e) => {
          if (isLightboxOpen()) {
            e.preventDefault();
            return;
          }
          handlePreventClose(e);
          onInteractOutside?.(e);
        }}
        onOpenAutoFocus={(e) => {
          // Prevent auto focus on open
          e.preventDefault();
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}