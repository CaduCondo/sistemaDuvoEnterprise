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

    // Criar cliente Supabase para server-side com service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Credenciais Supabase não configuradas");
      return res.status(500).json({
        success: false,
        error: "Configuração do servidor incorreta.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Atualizar senha no banco
    const { error: updateError } = await supabase
      .from("system_users")
      .update({
        password_hash: newPassword,
        requires_password_change: false,
        temporary_password: false,
        login_attempts: 0,
        blocked_until: null,
      })
      .eq("id", decoded.userId)
      .eq("email", decoded.email);

    if (updateError) {
      console.error("Erro ao atualizar senha:", updateError);
      return res.status(500).json({
        success: false,
        error: "Erro ao atualizar senha. Tente novamente.",
      });
    }

    console.log("✅ Senha atualizada com sucesso para usuário:", decoded.email);
    
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro na API de reset de senha:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar solicitação.",
    });
  }
}