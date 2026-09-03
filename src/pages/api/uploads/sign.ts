import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { exigirSessao } from "@/lib/apiAuth";
import { validateAttachmentMeta } from "@/lib/attachmentValidation";

/**
 * Autoriza o upload de um anexo (Locação, Recebimento de Aluguel,
 * Recebimento de Caução) -- issue #74.
 *
 * POR QUE ISTO EXISTE
 *
 * Até aqui o navegador subia o arquivo direto pro bucket `uploads` do
 * Supabase Storage, usando a chave pública (anon). Pra isso funcionar sem
 * login de verdade no Supabase (este sistema nunca usa `auth.uid()` -- ver
 * cabeçalho de src/pages/api/auth/login.ts), a policy de INSERT do bucket
 * tinha que ficar aberta pra qualquer um, logado ou não. Na prática:
 * qualquer pessoa que descobrisse a URL do Storage conseguia subir
 * qualquer arquivo pro bucket, sem precisar entrar no sistema.
 *
 * Esta rota resolve isso sem reescrever como o upload funciona: em vez do
 * navegador subir o arquivo direto, ele primeiro pede autorização aqui
 * (provando que tem uma sessão válida do nosso login -- exigirSessao). Se
 * autorizado, devolve um "link de upload assinado" do próprio Supabase
 * (createSignedUploadUrl) -- um token que vale só pra ESSE caminho
 * específico, por tempo limitado, e que funciona mesmo com a policy de
 * INSERT do bucket fechada pra todo mundo (é assim que o recurso do
 * Supabase foi pensado: o token substitui a policy pra esse upload).
 *
 * Os bytes do arquivo em si continuam indo direto do navegador pro
 * Supabase Storage (não passam por aqui) -- então não tem limite de
 * tamanho de corpo de requisição da função do Vercel no meio do caminho.
 *
 * Depois que essa rota estiver em produção e os 4 pontos de upload
 * migrados pra usá-la (ver src/lib/uploadAttachment.ts), a policy de
 * INSERT pública do bucket pode ser removida -- ela deixa de ser
 * necessária.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "uploads";

/**
 * Uma pasta por tela que sobe anexo hoje -- mesma organização que já
 * existia quando o upload era feito direto do navegador. Limitar a essas
 * três evita que a rota vire um jeito de escrever em qualquer caminho do
 * bucket.
 */
const PASTAS_PERMITIDAS = [
  "rental-attachments",
  "payment-attachments",
  "deposit-attachments",
] as const;
type PastaPermitida = (typeof PASTAS_PERMITIDAS)[number];

function servidorSupabase() {
  return createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

function nomeUnico(nomeOriginal: string): string {
  const extensao = nomeOriginal.split(".").pop() || "";
  const aleatorio = Math.random().toString(36).slice(2, 9);
  const base = `${Date.now()}_${aleatorio}`;
  return extensao ? `${base}.${extensao}` : base;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[uploads/sign] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  // Qualquer usuário logado pode anexar arquivo -- não é uma ação de admin.
  const sessao = exigirSessao(req, res);
  if (!sessao) return;

  const { folder, fileName, fileSize } = req.body ?? {};

  if (typeof folder !== "string" || !PASTAS_PERMITIDAS.includes(folder as PastaPermitida)) {
    return res.status(400).json({
      error: `Pasta inválida. Use uma de: ${PASTAS_PERMITIDAS.join(", ")}.`,
    });
  }
  if (typeof fileName !== "string" || !fileName.trim()) {
    return res.status(400).json({ error: "Informe o nome do arquivo." });
  }

  // Mesma regra de tamanho/extensão do navegador (src/lib/attachmentValidation.ts),
  // conferida de novo aqui -- a validação do navegador pode ser contornada
  // por quem chamar essa rota diretamente.
  const validacao = validateAttachmentMeta({
    name: fileName,
    size: typeof fileSize === "number" ? fileSize : 0,
  });
  if (!validacao.ok) {
    return res.status(400).json({ error: validacao.message });
  }

  const caminho = `${folder}/${nomeUnico(fileName)}`;
  const supabase = servidorSupabase();

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(caminho);

    if (error || !data) {
      console.error("[uploads/sign] Erro ao gerar link assinado:", error?.message);
      return res.status(500).json({ error: "Não foi possível autorizar o upload." });
    }

    const { data: urlPublica } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

    return res.status(200).json({
      path: caminho,
      token: data.token,
      publicUrl: urlPublica.publicUrl,
    });
  } catch (erro) {
    console.error("[uploads/sign] Erro inesperado:", erro);
    return res.status(500).json({ error: "Erro inesperado ao autorizar o upload." });
  }
}
