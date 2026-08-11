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
  const isWord = (type: string) =>
    type === "application/msword" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Visualizador online da Microsoft: mostra o conteúdo do Word numa aba nova sem
  // baixar. Só funciona se o link do arquivo for público e acessível pela internet.
  const getWordViewerUrl = (url: string) =>
    `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;

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
              {/* Visualizar: imagem (lightbox), PDF (navegador exibe inline) e Word (visualizador online) */}
              {(isImage(attachment.type) || isPDF(attachment.type) || isWord(attachment.type)) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isImage(attachment.type)) {
                      const imageIndex = imageAttachments.findIndex(img => img.id === attachment.id);
                      handleViewImage(imageIndex);
                      return;
                    }

                    // PDF: navegador exibe o conteúdo em nova aba
                    // Word: visualizador online da Microsoft mostra o conteúdo em nova aba
                    const urlToOpen = isWord(attachment.type)
                      ? getWordViewerUrl(normalizedUrl)
                      : normalizedUrl;

                    const newWindow = window.open(urlToOpen, "_blank");
                    if (!newWindow) {
                      console.error("❌ Erro ao abrir anexo:", urlToOpen);
                      alert("Não foi possível abrir o anexo. Verifique se o arquivo ainda existe.");
                    }
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
                  // Baixar sempre disponível: alternativa caso o visualizador não funcione
                  // (ex.: link não é público) ou para tipos sem preview possível.
                  const newWindow = window.open(normalizedUrl, "_blank");
                  if (!newWindow) {
                    console.error("❌ Erro ao abrir anexo:", normalizedUrl);
                    alert("Não foi possível abrir o anexo. Verifique se o arquivo ainda existe.");
                  }
                }}
                title="Baixar"
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