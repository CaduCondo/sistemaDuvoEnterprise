import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(dateString).toLocaleDateString('pt-BR');
}

// Issue #35: a Descrição do Imóvel agora pode conter HTML simples (negrito/
// itálico/tamanho, ver RichTextEditor). Para lugares que precisam de texto
// puro (meta tags de SEO, por exemplo), remove as tags sem tentar renderizar.
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(div|p|br)[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
