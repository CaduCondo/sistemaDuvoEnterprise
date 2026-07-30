import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

type ResponseData = {
  success: boolean;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Token e nova senha são obrigatórios",
      });
    }

    // Validar token JWT
    const secret = process.env.JWT_SECRET || "duvo-enterprise-secret-key-2024";
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      console.error("❌ [reset-password] Erro ao validar token:", err);
      return res.status(401).json({
        success: false,
        error: "Link expirado ou inválido. Solicite um novo link de recuperação.",
      });
    }

    // Verificar tipo do token
    if (decoded.type !== "password_reset") {
      return res.status(401).json({
        success: false,
        error: "Token inválido.",
      });
    }

    console.log("✅ [reset-password] Token validado:", decoded.email);

    // Validar senha
    if (newPassword.length < 8 || newPassword.length > 12) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter entre 8 e 12 caracteres",
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: "A senha deve conter pelo menos uma letra maiúscula",
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: "A senha deve conter pelo menos uma letra minúscula",
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: "A senha deve conter pelo menos um número",
      });
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: "A senha deve conter pelo menos um caractere especial",
      });
    }

    console.log("✅ [reset-password] Senha validada");

    // Verificar se as variáveis de ambiente estão configuradas
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      console.error("❌ [reset-password] NEXT_PUBLIC_SUPABASE_URL não configurada");
      return res.status(500).json({
        success: false,
        error: "Configuração do servidor incorreta (URL).",
      });
    }

    if (!supabaseServiceKey) {
      console.error("❌ [reset-password] SUPABASE_SERVICE_ROLE_KEY não configurada");
      return res.status(500).json({
        success: false,
        error: "Configuração do servidor incorreta (Service Key não configurada). Contate o administrador.",
      });
    }

    console.log("✅ [reset-password] Credenciais Supabase configuradas");

    // Criar cliente com service role (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("📝 [reset-password] Atualizando senha para:", decoded.email);

    // Atualizar senha diretamente (service role bypassa RLS)
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("system_users")
      .update({
        password_hash: newPassword,
        requires_password_change: false,
        temporary_password: false,
        login_attempts: 0,
        blocked_until: null,
      })
      .eq("id", decoded.userId)
      .eq("email", decoded.email)
      .select("id, email");

    if (updateError) {
      console.error("❌ [reset-password] Erro ao atualizar:", updateError);
      return res.status(500).json({
        success: false,
        error: "Erro ao atualizar senha. Tente novamente.",
      });
    }

    if (!updateData || updateData.length === 0) {
      console.error("❌ [reset-password] Nenhum usuário atualizado");
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado ou link expirado.",
      });
    }

    console.log("✅ [reset-password] Senha atualizada com sucesso:", updateData[0].email);
    
    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ [reset-password] Erro geral:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro interno ao processar solicitação.",
    });
  }
}