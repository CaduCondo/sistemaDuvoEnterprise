// Regras de exibição de anexo (ícone, se dá pra "Visualizar" e como) usadas em todo
// o sistema. Centralizado para a aparência ficar igual em qualquer tela.

export type AttachmentKind = "image" | "pdf" | "word" | "other";

export function getAttachmentKind(typeOrName: string): AttachmentKind {
  const value = (typeOrName || "").toLowerCase();

  if (value.startsWith("image/")) return "image";
  if (value === "application/pdf") return "pdf";
  if (
    value === "application/msword" ||
    value === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }

  // Nem sempre temos o MIME type (ex.: anexos antigos só com nome/URL) - nesse caso
  // tenta adivinhar pela extensão do arquivo.
  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(value)) return "image";
  if (/\.pdf(\?|$)/i.test(value)) return "pdf";
  if (/\.docx?(\?|$)/i.test(value)) return "word";

  return "other";
}

// Visualizador online da Microsoft: mostra o conteúdo do Word numa aba nova sem
// baixar. Só funciona se o link do arquivo for público e acessível pela internet.
export function getWordViewerUrl(url: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
}

export function normalizeAttachmentUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}
