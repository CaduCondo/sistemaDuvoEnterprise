import { useEffect, useState } from "react";
import {
  identifySupabaseEnvironment,
  isProductionHostname,
} from "@/config/environment";

/**
 * Tarja de aviso exibida quando o site abre conectado ao banco de dados errado.
 *
 * Existe por causa do incidente de 21/ago/2026: o site de producao ficou
 * apontando para o banco de DEV e nada na tela avisava. Usuarios acharam que
 * estavam mexendo no sistema real e as alteracoes foram parar no banco de teste.
 *
 * A trava do build (`scripts/check-supabase-env.js`) impede que um deploy assim
 * seja publicado. Esta tarja e a segunda linha de defesa: se por qualquer motivo
 * o erro escapar (deploy antigo em cache, configuracao alterada por fora), fica
 * visivel na hora, em vez de silencioso.
 *
 * Usa estilo inline de proposito: um aviso de seguranca nao pode depender de o
 * CSS do sistema ter carregado corretamente.
 */
export function EnvironmentWarningBanner() {
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    // So roda no navegador: window.location nao existe durante a renderizacao
    // no servidor, e checar la causaria diferenca de conteudo na hidratacao.
    const ambienteDoBanco = identifySupabaseEnvironment(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    const siteDeProducao = isProductionHostname(window.location.hostname);

    if (siteDeProducao && ambienteDoBanco !== "production") {
      setMensagem(
        ambienteDoBanco === "development"
          ? "ATENÇÃO: este site está conectado ao banco de DESENVOLVIMENTO. Nada que você alterar aqui será salvo no sistema real. Não continue — avise o responsável."
          : "ATENÇÃO: este site está conectado a um banco de dados NÃO RECONHECIDO. Não altere nada até que isso seja verificado."
      );
      return;
    }

    if (!siteDeProducao && ambienteDoBanco === "production") {
      setMensagem(
        "ATENÇÃO: este ambiente de teste está conectado ao banco de PRODUÇÃO. Qualquer alteração feita aqui muda os dados reais dos clientes."
      );
    }
  }, []);

  if (!mensagem) return null;

  return (
    <div
      role="alert"
      data-testid="environment-warning-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 99999,
        width: "100%",
        backgroundColor: "#b91c1c",
        color: "#ffffff",
        padding: "12px 16px",
        fontSize: "15px",
        fontWeight: 700,
        lineHeight: 1.4,
        textAlign: "center",
        borderBottom: "3px solid #7f1d1d",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}
    >
      ⚠️ {mensagem}
    </div>
  );
}

export default EnvironmentWarningBanner;
