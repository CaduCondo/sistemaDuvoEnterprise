import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Upload, X, FileText, Image as ImageIcon, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Attachment } from "@/types";

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // ✅ CORREÇÃO: /api/upload gravava no disco local do servidor, que não persiste
      // em produção (Vercel). Agora sobe para o Supabase Storage, como já funciona no
      // recebimento de aluguel (ManagePaymentForm.tsx).
      const uploadPromises = Array.from(files).map(async (file) => {
        const extension = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
        const filePath = `rental-attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("uploads")
          .getPublicUrl(filePath);

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
      event.target.value = "";
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

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "contract":
        return "Contrato";
      case "deposit":
        return "Caução";
      default:
        return "Outro";
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "contract":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "deposit":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const isImage = (type: string) => type.startsWith("image/");
  const isPDF = (type: string) => type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Paperclip className="h-4 w-4 mr-2" />
          Anexos ({attachments.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anexos da Locação</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <div className="border-2 border-dashed rounded-lg p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="deposit">Caução</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-upload">Selecionar Arquivos</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {uploading && (
              <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                <Upload className="h-5 w-5 mr-2 animate-pulse" />
                <span className="text-sm text-muted-foreground">Fazendo upload...</span>
              </div>
            )}
          </div>

          {/* Attachments Grid */}
          {attachments.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold">Arquivos Anexados</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                  >
                    {/* Preview */}
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {isImage(attachment.type) ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                        />
                      ) : isPDF(attachment.type) ? (
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      ) : (
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate flex-1" title={attachment.name}>
                          {attachment.name}
                        </p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${getCategoryColor(
                            attachment.category
                          )}`}
                        >
                          {getCategoryLabel(attachment.category)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {new Date(attachment.uploadedAt).toLocaleDateString("pt-BR")}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(attachment.url, "_blank")}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Baixar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum anexo adicionado ainda</p>
              <p className="text-sm">Faça upload de contratos, comprovantes ou outros documentos</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}