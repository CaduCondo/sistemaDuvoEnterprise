// Regras de validação de anexo usadas em todo o sistema (Locação, Recebimento de
// Aluguel, Recebimento de Caução, etc.). Centralizado aqui para não precisar mudar
// em vários lugares toda vez que a regra mudar.

export const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_ATTACHMENT_SIZE_LABEL = "8MB";

// Qualquer tipo de arquivo é permitido (documento, planilha, imagem, etc.), exceto
// extensões que podem executar código no computador de quem abrir - isso é só uma
// proteção básica, não uma restrição de "tipo de documento".
const BLOCKED_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "scr", "msi", "vbs", "vbe",
  "js", "jse", "jar", "app", "apk", "sh", "ps1", "wsf",
];

export interface AttachmentValidationResult {
  ok: boolean;
  message?: string;
}

export function validateAttachmentFile(file: File): AttachmentValidationResult {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false,
      message: `O arquivo "${file.name}" tem ${(file.size / 1024 / 1024).toFixed(2)}MB. O tamanho máximo permitido é ${MAX_ATTACHMENT_SIZE_LABEL}.`,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      message: `Arquivos ".${extension}" não são permitidos por segurança.`,
    };
  }

  return { ok: true };
}
