import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateAttachmentFile } from "@/lib/attachmentValidation";

interface AttachmentUploadButtonProps {
  id: string;
  onFilesSelected: (files: File[]) => void;
  onError: (message: string) => void;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
}

// Botão padronizado de "Escolher Arquivo" usado em todas as telas do sistema.
// Aceita qualquer tipo de arquivo (a validação de tamanho/segurança acontece aqui,
// centralizada em validateAttachmentFile).
export function AttachmentUploadButton({
  id,
  onFilesSelected,
  onError,
  multiple = false,
  disabled = false,
  label = "Escolher Arquivo",
}: AttachmentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois

    const validFiles: File[] = [];
    for (const file of files) {
      const result = validateAttachmentFile(file);
      if (!result.ok) {
        onError(result.message);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) onFilesSelected(validFiles);
  };

  return (
    <div className="w-full">
      <input
        id={id}
        ref={inputRef}
        type="file"
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-9"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Paperclip className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}
