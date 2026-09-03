import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { Attachment } from "@/types";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { AttachmentUploadButton } from "@/components/attachments/AttachmentUploadButton";

interface RentalAttachmentsDialogProps {
  rentalId: string;
  attachments: Attachment[];
  onAttachmentsUpdate: () => void;
}

export function RentalAttachmentsDialog({ rentalId, attachments = [], onAttachmentsUpdate }: RentalAttachmentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<"contract" | "deposit" | "other">("other");
  const { toast } = useToast();

  const handleFilesSelected = async (files: File[]) => {
    setUploading(true);

    try {
      // ✅ CORREÇÃO (issue #74, 03/set/2026): upload passa por /api/uploads/sign,
      // que exige estar logado -- antes ia direto pro Storage com a policy pública
      // aberta pra qualquer um. Ver src/lib/uploadAttachment.ts.
      const uploadPromises = files.map(async (file) => {
        const publicUrl = await uploadAttachment(file, "rental-attachments");

        return {
          id: crypto.randomUUID(),
          name: file.name,
          url: publicUrl,
          type: file.type,
          category,
          uploadedAt: new Date().toISOString(),
        } as Attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      const updatedAttachments = [...attachments, ...newAttachments];

      const { error } = await supabase
        .from("rentals")
        .update({ attachments: updatedAttachments as any })
        .eq("id", rentalId);

      if (error) throw error;

      toast({
        title: "Anexos adicionados",
        description: `${newAttachments.length} arquivo(s) anexado(s) com sucesso.`,
      });

      onAttachmentsUpdate();
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro ao fazer upload",
        description: "Não foi possível anexar os arquivos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const updatedAttachments = attachments.filter((att) => att.id !== attachmentId);

      const { error } = await supabase
        .from("rentals")
        .update({ attachments: updatedAttachments as any })
        .eq("id", rentalId);

      if (error) throw error;

      toast({
        title: "Anexo removido",
        description: "Anexo removido com sucesso.",
      });

      onAttachmentsUpdate();
    } catch (error) {
      console.error("Erro ao remover anexo:", error);
      toast({
        title: "Erro ao remover anexo",
        description: "Não foi possível remover o anexo.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Paperclip className="h-4 w-4 mr-2" />
          Anexos ({attachments.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anexos da Locação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 w-40">
              <Label htmlFor="category" className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                <SelectTrigger id="category" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contrato</SelectItem>
                  <SelectItem value="deposit">Caução</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <AttachmentUploadButton
                id="rental-attachments-file-input"
                multiple
                disabled={uploading}
                onFilesSelected={handleFilesSelected}
                onError={(message) =>
                  toast({ title: "Arquivo não permitido", description: message, variant: "destructive" })
                }
              />
            </div>
          </div>

          {uploading && (
            <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <Upload className="h-4 w-4 animate-pulse" />
              Fazendo upload...
            </div>
          )}

          {attachments.length > 0 ? (
            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground pt-2">
                Arquivos Anexados ({attachments.length})
              </p>
              <AttachmentList
                attachments={attachments}
                onRemove={(index) => handleDeleteAttachment(attachments[index].id)}
              />
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum anexo adicionado ainda</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
