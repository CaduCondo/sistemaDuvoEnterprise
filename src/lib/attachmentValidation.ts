// Regras de validação de anexo usadas em todo o sistema (Locação, Recebimento de
// Aluguel, Recebimento de Caução, etc.). Centralizado aqui para não precisar mudar
// em vários lugares toda vez que a regra mudar.

export const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_ATTACHMENT_SIZE_LABEL = "8MB";

// Qualquer tipo de arquivo é permitido (documento, planilha, imagem, etc.), exceto
// extensões que podem executar código no computador de quem abrir - isso é só uma
// proteção básica, não uma restrição de "tipo de documento".
export const BLOCKED_ATTACHMENT_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "scr", "msi", "vbs", "vbe",
  "js", "jse", "jar", "app", "apk", "sh", "ps1", "wsf",
];

export interface AttachmentValidationResult {
  ok: boolean;
  message?: string;
}

/**
 * Mesma regra de tamanho/extensão de validateAttachmentFile(), mas sem
 * depender do tipo `File` (só de nome + tamanho) -- para poder ser
 * reaproveitada tanto no navegador quanto numa rota de servidor (ver
 * src/pages/api/uploads/sign.ts, issue #74), sem duplicar a lista de
 * extensões bloqueadas em dois lugares.
 */
export function validateAttachmentMeta({
  name,
  size,
}: {
  name: string;
  size: number;
}): AttachmentValidationResult {
  if (size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false,
      message: `O arquivo "${name}" tem ${(size / 1024 / 1024).toFixed(2)}MB. O tamanho máximo permitido é ${MAX_ATTACHMENT_SIZE_LABEL}.`,
    };
  }

  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (BLOCKED_ATTACHMENT_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      message: `Arquivos ".${extension}" não são permitidos por segurança.`,
    };
  }

  return { ok: true };
}

export function validateAttachmentFile(file: File): AttachmentValidationResult {
  return validateAttachmentMeta({ name: file.name, size: file.size });
}
