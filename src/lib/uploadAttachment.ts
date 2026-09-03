import { supabase } from "@/integrations/supabase/client";
import { getSessionToken } from "@/services/authService";
import { validateAttachmentFile } from "@/lib/attachmentValidation";

/**
 * Sobe um anexo (Locação, Recebimento de Aluguel, Recebimento de Caução)
 * pro Supabase Storage, com autorização do nosso próprio login -- issue
 * #74. Substitui o upload direto (`supabase.storage.from("uploads").upload(...)`,
 * que exigia a policy do bucket aberta pra qualquer um, logado ou não).
 *
 * Como funciona: primeiro pede autorização em /api/uploads/sign (que
 * confere a sessão e devolve um link de upload assinado, válido só pra
 * esse arquivo); depois sobe os bytes direto pro Supabase Storage com esse
 * link -- os bytes não passam pelo servidor do Next, só a autorização.
 */

export type AttachmentFolder =
  | "rental-attachments"
  | "payment-attachments"
  | "deposit-attachments";

export async function uploadAttachment(
  file: File,
  folder: AttachmentFolder
): Promise<string> {
  const validacao = validateAttachmentFile(file);
  if (!validacao.ok) {
    throw new Error(validacao.message);
  }

  const token = getSessionToken();
  const resposta = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ folder, fileName: file.name, fileSize: file.size }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}) as { error?: string });
    throw new Error(corpo.error || "Não foi possível autorizar o upload do arquivo.");
  }

  const { path, token: uploadToken, publicUrl } = await resposta.json();

  const { error } = await supabase.storage
    .from("uploads")
    .uploadToSignedUrl(path, uploadToken, file);

  if (error) {
    throw error;
  }

  return publicUrl as string;
}
