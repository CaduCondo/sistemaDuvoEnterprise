/**
 * Segredo usado para assinar/conferir o link de "esqueci minha senha"
 * (modo antigo, por link -- ver send-password-recovery.ts e reset-password.ts).
 *
 * ⚠️ CORREÇÃO DE SEGURANÇA (03/set/2026, achado numa auditoria pedida pelo
 * Cadu): antes, as duas rotas tinham `process.env.JWT_SECRET || "duvo-
 * enterprise-secret-key-2024"` -- um texto fixo, visível pra qualquer um que
 * leia o repositório (que é público no GitHub). Se a variável JWT_SECRET não
 * estivesse configurada no ambiente (e não estava nem no .env.local local),
 * esse texto virava o segredo de verdade em produção -- e virou: qualquer
 * pessoa que soubesse esse texto (bastava ler o código-fonte público)
 * conseguia forjar, sozinha, um token válido de redefinição de senha para
 * QUALQUER usuário (só precisa saber o `userId` e o e-mail dele) e trocar a
 * senha de qualquer conta, inclusive admin, sem nunca receber o e-mail de
 * verdade.
 *
 * Agora: sem JWT_SECRET configurado, a rota falha com um erro claro (500) em
 * vez de usar um segredo público como se fosse seguro. Configure
 * JWT_SECRET (uma string longa e aleatória, ex.: gerada com
 * `openssl rand -hex 32`) no `.env.local` e nas variáveis de ambiente da
 * Vercel (Production e Preview).
 */
export function obterSegredoDeRecuperacaoDeSenha(): string {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error(
      "JWT_SECRET não está configurada. Defina essa variável de ambiente " +
      "(uma string longa e aleatória) antes de usar a recuperação de senha por link."
    );
  }
  return segredo;
}
