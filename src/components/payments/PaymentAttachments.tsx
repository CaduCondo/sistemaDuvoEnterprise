import { memo } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { AttachmentUploadButton } from "@/components/attachments/AttachmentUploadButton";
import { useAlert } from "@/contexts/AlertContext";

interface Attachment {
  url: string;
  name: string;
  description?: string;
  uploadProgress?: number;
}

interface PaymentAttachmentsProps {
  attachments: Attachment[];
  uploadingFile: boolean;
  uploadProgress: { [key: number]: number };
  isReadOnly: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, index: number) => Promise<void>;
  onRemoveAttachment: (index: number) => void;
  onAddAttachment: () => void;
}

// Bloco de Anexos padronizado (mesmo visual em Recebimento de Aluguel e de Caução):
// lista compacta (ícone, nome, Visualizar · Baixar, lixeira) + um botão de upload.
export const PaymentAttachments = memo(function PaymentAttachments({
  attachments,
  uploadingFile,
  uploadProgress,
  isReadOnly,
  onFileChange,
  onRemoveAttachment,
  onAddAttachment,
}: PaymentAttachmentsProps) {
  const { showAlert } = useAlert();
  const attachedFiles = attachments.filter((a) => a.url);

  // AttachmentUploadButton já valida tamanho/tipo perigoso antes de chamar aqui;
  // essa função só decide em qual "slot" o arquivo entra, reaproveitando o mesmo
  // fluxo de onFileChange(e, index) já usado no upload para o Supabase Storage.
  // Um arquivo por vez (o upload é assíncrono e os "slots" dependem do estado
  // anterior já ter sido atualizado).
  const handleFilesSelected = ([file]: File[]) => {
    if (!file) return;

    const index = attachments.findIndex((a) => !a.url);
    const targetIndex = index === -1 ? attachments.length : index;
    if (index === -1) onAddAttachment();

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const fakeEvent = {
      target: { files: dataTransfer.files, value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    setTimeout(() => onFileChange(fakeEvent, targetIndex), 0);
  };

  return (
    <div className="space-y-3">
      {!isReadOnly && (
        <AttachmentUploadButton
          id="payment-file-input"
          disabled={uploadingFile}
          onFilesSelected={handleFilesSelected}
          onError={(message) =>
            showAlert({ type: "error", title: "Não foi possível anexar", description: message })
          }
        />
      )}

      {attachedFiles.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 pt-2">
            <Paperclip className="h-3.5 w-3.5" />
            Arquivos Anexados ({attachedFiles.length})
          </p>
          <AttachmentList
            attachments={attachedFiles}
            // ✅ O X de remover fica sempre disponível, mesmo com o
            // recebimento já pago e travado (isReadOnly só esconde o botão
            // de anexar novo arquivo) - mesmo padrão da tela de Anexos da
            // Locação, que também deixa remover a qualquer momento.
            onRemove={(index) => {
              const original = attachments.indexOf(attachedFiles[index]);
              onRemoveAttachment(original === -1 ? index : original);
            }}
          />
        </div>
      )}

      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([key, progress]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Enviando... {progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
