import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assinatura e nome de quem está LOGADO (quem fez o recebimento), para os
 * recibos (15/nov/2026). Se o usuário não tem assinatura cadastrada, volta o
 * padrão antigo (assinatura do Carlos), como era antes.
 */
const PADRAO = { nome: "Carlos Aparecido D'Uvo", assinaturaUrl: "/signature.png" };

export function useAssinaturaDoUsuario(): { nome: string; assinaturaUrl: string } {
  const { user } = useAuth();
  const [dados, setDados] = useState(PADRAO);

  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    (supabase as any)
      .from("system_users")
      .select("name, signature_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (vivo && data?.signature_url) {
          setDados({ nome: data.name || PADRAO.nome, assinaturaUrl: data.signature_url });
        }
      });
    return () => {
      vivo = false;
    };
  }, [user?.id]);

  return dados;
}
