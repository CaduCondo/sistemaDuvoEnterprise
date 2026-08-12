import { AttachmentList } from "@/components/attachments/AttachmentList";
import type { Attachment } from "@/types";

interface AttachmentViewerProps {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}

// Mantido como um wrapper fino sobre o componente padronizado (AttachmentList) para
// não precisar mudar quem já usa <AttachmentViewer attachments={...} onRemove={...} />.
export function AttachmentViewer({ attachments, onRemove }: AttachmentViewerProps) {
  return (
    <AttachmentList
      attachments={attachments}
      onRemove={onRemove ? (index) => onRemove(attachments[index].id) : undefined}
    />
  );
}
