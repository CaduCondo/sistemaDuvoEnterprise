import type { Property } from "@/types";

/**
 * Monta o identificador usado na URL pública do imóvel.
 * Usa o código curto e sequencial (ex: "0001") quando disponível;
 * cai para o UUID interno como fallback (imóveis antigos que ainda
 * não tenham o código, ou enquanto a migração não rodou).
 */
export function formatPublicCode(property: Pick<Property, "id" | "publicCode" | "public_code">): string {
  const code = property.publicCode ?? property.public_code;
  if (code === undefined || code === null) return property.id;
  return String(code).padStart(4, "0");
}
