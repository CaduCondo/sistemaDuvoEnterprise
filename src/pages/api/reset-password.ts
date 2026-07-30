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
      console.error("Erro ao validar token:", err);
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

    // Validar senha
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter no mínimo 8 caracteres",
      });
    }

    if (newPassword.length > 12) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter no máximo 12 caracteres",
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

    // Criar cliente Supabase com anon key (suficiente para chamar RPC)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    console.log("🔍 [reset-password] Supabase URL configurada:", !!supabaseUrl);
    console.log("🔍 [reset-password] User ID do token:", decoded.userId);
    console.log("🔍 [reset-password] Email do token:", decoded.email);
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Credenciais Supabase não configuradas");
      return res.status(500).json({
        success: false,
        error: "Configuração do servidor incorreta.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Chamar função RPC SECURITY DEFINER para resetar senha
    console.log("📝 [reset-password] Chamando função reset_user_password_by_token...");
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('reset_user_password_by_token', {
        p_user_id: decoded.userId,
        p_email: decoded.email,
        p_new_password: newPassword
      });

    if (rpcError) {
      console.error("❌ [reset-password] Erro ao chamar RPC:", rpcError);
      return res.status(500).json({
        success: false,
        error: "Erro ao processar redefinição de senha. Tente novamente.",
      });
    }

    console.log("📊 [reset-password] Resultado RPC:", rpcResult);

    // A função retorna um JSON com success e error/message
    if (!rpcResult || !rpcResult.success) {
      console.error("❌ [reset-password] Função retornou falha:", rpcResult?.error);
      return res.status(400).json({
        success: false,
        error: rpcResult?.error || "Erro ao atualizar senha.",
      });
    }

    console.log("✅ [reset-password] Senha atualizada com sucesso via RPC");
    console.log("✅ [reset-password] Email:", decoded.email);
    
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("❌ Erro na API de reset de senha:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar solicitação.",
    });
  }
}