import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Nome e assinatura que saem nos recibos.
 *
 * POR ENQUANTO (regra do Cadu, 18/nov/2026) é sempre a do locador cadastrado
 * (Configurações → Usuários → "Também é locador" + Assinatura). No futuro
 * será a do corretor que estiver logado e fazendo o recebimento -- aí é só
 * trocar a busca abaixo pelo usuário logado.
 *
 * Nada de assinatura "fixa" no código: se ninguém tiver assinatura
 * cadastrada, o recibo sai sem a imagem (só com a linha).
 */
export function useAssinaturaDoUsuario(): { nome: string; assinaturaUrl: string } {
  const [dados, setDados] = useState({ nome: "", assinaturaUrl: "" });

  useEffect(() => {
    let vivo = true;
    (supabase as any)
      .from("system_users")
      .select("name, signature_url")
      .eq("is_landlord", true)
      .eq("active", true)
      .not("signature_url", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .then(({ data }: any) => {
        const u = data?.[0];
        if (vivo && u?.signature_url) setDados({ nome: u.name || "", assinaturaUrl: u.signature_url });
      });
    return () => {
      vivo = false;
    };
  }, []);

  return dados;
}
