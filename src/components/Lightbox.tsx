import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { setLightboxOpen } from "@/lib/lightboxState";

export interface LightboxProps {
  images: Array<{ url: string; alt: string }>;
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, currentIndex, isOpen, onClose, onNavigate }: LightboxProps) {
  const handlePrevious = useCallback(() => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onNavigate(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onNavigate(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  // ✅ CORREÇÃO CRÍTICA: avisa o Dialog (tela de fundo, ex.: Registrar Recebimento)
  // que o Lightbox está aberto. O src/components/ui/dialog.tsx usa esse aviso
  // para NÃO se fechar quando o usuário clica em algo dentro do Lightbox (que
  // vive num portal fora da árvore do Dialog, então o Radix normalmente
  // confundiria esse clique com um "clique fora" e fecharia a tela de fundo).
  useEffect(() => {
    setLightboxOpen(isOpen);
    return () => setLightboxOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrevious, handleNext]);

  // ✅ CORREÇÃO: rede de segurança contra a página "congelar" depois de fechar o
  // Lightbox dentro de uma tela com Dialog/AlertDialog (mesma causa raiz já
  // documentada em AlertContext.tsx e RentalFormDialog.tsx: como o Lightbox é um
  // portal fora do controle do Radix, fechá-lo pode deixar o body preso em
  // "bloqueado" quando o Radix tenta restaurar o scroll/pointer-events depois).
  // Se não sobrar nenhum modal aberto na página, libera o body manualmente.
  useEffect(() => {
    if (isOpen) return;

    const timer = setTimeout(() => {
      if (
        document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')
          .length === 0
      ) {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
        document.body.removeAttribute("data-scroll-locked");
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  // ✅ CORREÇÃO: renderizado via portal direto no <body>. Sem isso, quando o
  // Lightbox abre dentro de uma tela com Dialog (ex.: Registrar Recebimento), a
  // animação do Dialog aplica um CSS "transform" no elemento pai - e isso muda a
  // referência do "position: fixed" (deixa de ser a tela toda e passa a ser
  // relativo ao Dialog), fazendo a imagem abrir presa lá no topo do formulário em
  // vez de centralizada na tela.
  // ✅ CORREÇÃO CRÍTICA: como o Lightbox é um portal fora da árvore do Dialog do
  // Radix (ex.: tela de Registrar Recebimento), o Radix detecta qualquer clique
  // dentro do Lightbox como um "clique fora" do Dialog - e fecha o Dialog inteiro
  // junto (era possível perder os dados do formulário só de fechar a imagem!).
  // Bloqueando a propagação do clique aqui, o Radix nunca chega a "ver" esse
  // clique, então o Dialog por trás continua aberto normalmente.
  const stopBubbling = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      // ✅ CORREÇÃO: pointer-events-auto explícito. Quando o Lightbox abre dentro de
      // uma tela com Dialog aberto (ex.: Registrar Recebimento), o Radix bloqueia
      // clique no resto da página inteira (só a área do Dialog pode receber
      // clique) - e como o Lightbox é renderizado num portal direto no <body>
      // (fora da área do Dialog), ele herdava esse bloqueio e ficava com a imagem
      // visível mas nenhum clique (X, setas) fazia efeito, travando a navegação.
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center pointer-events-auto"
      onPointerDown={stopBubbling}
      onMouseDown={stopBubbling}
      onClick={stopBubbling}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {images.length > 1 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={handleNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center">
        <img
          src={currentImage.url}
          alt={currentImage.alt}
          className="max-w-full max-h-[85vh] object-contain"
        />
        
        {images.length > 1 && (
          <div className="mt-4 text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}