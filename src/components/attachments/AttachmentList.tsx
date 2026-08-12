import { useState } from "react";
import { FileText, Image as ImageIcon, Eye, Download, Trash2 } from "lucide-react";
import { Lightbox } from "@/components/Lightbox";
import { getAttachmentKind, getWordViewerUrl, normalizeAttachmentUrl } from "@/lib/attachmentDisplay";

export interface AttachmentListItem {
  id?: string;
  url: string;
  name: string;
  type?: string;
}

interface AttachmentListProps {
  attachments: AttachmentListItem[];
  isReadOnly?: boolean;
  onRemove?: (index: number) => void;
}

// Lista compacta e padronizada de anexos, usada em todas as telas do sistema
// (Locação, Recebimento de Aluguel, Recebimento de Caução). Uma linha por arquivo:
// ícone, nome, "Visualizar · Baixar" e lixeira (quando não for somente leitura).
export function AttachmentList({ attachments, isReadOnly, onRemove }: AttachmentListProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (attachments.length === 0) return null;

  const imageItems = attachments.filter((att) => getAttachmentKind(att.type || att.name) === "image");

  const openViewer = async (attachment: AttachmentListItem) => {
    const kind = getAttachmentKind(attachment.type || attachment.name);
    const normalizedUrl = normalizeAttachmentUrl(attachment.url);

    if (kind === "image") {
      const imgIndex = imageItems.findIndex((i) => i.url === attachment.url);
      setCurrentImageIndex(imgIndex >= 0 ? imgIndex : 0);
      setLightboxOpen(true);
      return;
    }

    // ✅ CORREÇÃO: mesmo caso do downloadAttachment - anexo antigo cujo arquivo já
    // não existe mais. Sem essa checagem, "Visualizar" abria uma aba nova só com
    // erro 404 (ou, no caso de Word, o visualizador da Microsoft tentando abrir um
    // link morto). Confere antes se o arquivo ainda existe.
    try {
      const check = await fetch(normalizedUrl, { method: "HEAD" });
      if (check.status === 404) {
        alert("Este anexo não está mais disponível (arquivo antigo perdido). Não é possível visualizar.");
        return;
      }
    } catch {
      // Falha ao checar (ex.: CORS) não significa que o arquivo não existe -
      // deixa seguir e tentar abrir normalmente.
    }

    const target = kind === "word" ? getWordViewerUrl(normalizedUrl) : normalizedUrl;
    const win = window.open(target, "_blank");
    if (!win) {
      alert("Não foi possível abrir o anexo. Verifique se o arquivo ainda existe.");
    }
  };

  const downloadAttachment = async (attachment: AttachmentListItem) => {
    const normalizedUrl = normalizeAttachmentUrl(attachment.url);

    // ✅ CORREÇÃO: window.open() apenas ABRE o arquivo (o navegador exibe imagem/PDF
    // em vez de baixar) - não força download de verdade. Baixa o conteúdo e cria um
    // link temporário com o nome real do arquivo, que sim força o download.
    try {
      const response = await fetch(normalizedUrl);

      // ✅ CORREÇÃO: anexo de locação antiga cujo arquivo já não existe mais
      // (era salvo no disco do servidor antes de migrarmos para o Supabase
      // Storage, e esse disco antigo foi perdido). Antes disso caía no catch
      // abaixo e abria uma aba nova só com a página de erro 404 - agora avisa
      // com uma mensagem clara em vez de abrir um link quebrado.
      if (response.status === 404) {
        alert("Este anexo não está mais disponível (arquivo antigo perdido). Não é possível baixar.");
        return;
      }

      if (!response.ok) throw new Error("Falha ao buscar o arquivo");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = attachment.name || "arquivo";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // ✅ console.warn (não console.error) de propósito: isso é um plano B já
      // esperado (ex.: bucket sem permissão de leitura direta), não uma falha
      // não tratada. Em Next.js dev, console.error com um objeto Error aciona a
      // tela vermelha de "Runtime Error" mesmo quando o código já se recupera
      // sozinho - o que assustava sem ser um bug de verdade.
      console.warn("Não foi possível baixar diretamente, abrindo em nova aba:", error);
      // Alternativa: abre em nova aba (funciona ainda que não force o download)
      const win = window.open(normalizedUrl, "_blank");
      if (!win) {
        alert("Não foi possível baixar o anexo. Verifique se o arquivo ainda existe.");
      }
    }
  };

  return (
    <div className="space-y-0.5">
      {attachments.map((attachment, index) => {
        const kind = getAttachmentKind(attachment.type || attachment.name);
        const Icon = kind === "image" ? ImageIcon : FileText;
        const iconColor =
          kind === "pdf" ? "text-red-500" : kind === "image" ? "text-blue-500" : "text-gray-500";

        return (
          <div
            key={attachment.id || `${attachment.url}-${index}`}
            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/60 transition-colors text-sm"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
              <span className="truncate" title={attachment.name}>
                {attachment.name || "Arquivo"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-xs whitespace-nowrap">
              {kind !== "other" && (
                <button
                  type="button"
                  onClick={() => openViewer(attachment)}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Visualizar
                </button>
              )}
              {kind !== "other" && <span className="text-muted-foreground">·</span>}
              <button
                type="button"
                onClick={() => downloadAttachment(attachment)}
                className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </button>
              {!isReadOnly && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="ml-1 text-destructive hover:opacity-70"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {imageItems.length > 0 && (
        <Lightbox
          images={imageItems.map((att) => ({ url: normalizeAttachmentUrl(att.url), alt: att.name }))}
          currentIndex={currentImageIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setCurrentImageIndex}
        />
      )}
    </div>
  );
}
