import { X, FileText, Image as ImageIcon, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/Lightbox";
import { useState } from "react";
import type { Attachment } from "@/types";

interface AttachmentViewerProps {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}

export function AttachmentViewer({ attachments, onRemove }: AttachmentViewerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const imageAttachments = attachments.filter(att => att.type.startsWith("image/"));

  const handleViewImage = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  // ✅ CORREÇÃO: Normalizar URL para garantir que funcione tanto com URLs relativas quanto absolutas
  const normalizeUrl = (url: string): string => {
    // Se já é uma URL completa (http/https), retorna como está
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    
    // Se começa com /, já é uma URL relativa válida
    if (url.startsWith("/")) {
      return url;
    }
    
    // Caso contrário, adiciona / no início
    return `/${url}`;
  };

  const isImage = (type: string) => type.startsWith("image/");
  const isPDF = (type: string) => type === "application/pdf";

  return (
    <div className="space-y-2">
      {attachments.map((attachment, index) => {
        const normalizedUrl = normalizeUrl(attachment.url);
        
        return (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {isImage(attachment.type) ? (
                  <ImageIcon className="h-5 w-5 text-blue-500" />
                ) : isPDF(attachment.type) ? (
                  <FileText className="h-5 w-5 text-red-500" />
                ) : (
                  <FileText className="h-5 w-5 text-gray-500" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={attachment.name}>
                  {attachment.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(attachment.uploadedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isImage(attachment.type) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const imageIndex = imageAttachments.findIndex(img => img.id === attachment.id);
                    handleViewImage(imageIndex);
                  }}
                  title="Visualizar"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  // ✅ CORREÇÃO: Tentar abrir em nova aba com URL normalizada
                  const newWindow = window.open(normalizedUrl, "_blank");
                  if (!newWindow) {
                    console.error("❌ Erro ao abrir anexo:", normalizedUrl);
                    alert("Não foi possível abrir o anexo. Verifique se o arquivo ainda existe.");
                  }
                }}
                title="Baixar/Abrir"
              >
                <Download className="h-4 w-4" />
              </Button>

              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(attachment.id)}
                  className="text-destructive hover:text-destructive"
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {imageAttachments.length > 0 && (
        <Lightbox
          images={imageAttachments.map(att => ({
            url: normalizeUrl(att.url),
            alt: att.name,
          }))}
          currentIndex={currentImageIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setCurrentImageIndex}
        />
      )}
    </div>
  );
}