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

    // Criar cliente Supabase para server-side com service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    console.log("🔍 [reset-password] Supabase URL configurada:", !!supabaseUrl);
    console.log("🔍 [reset-password] Service Role Key configurada:", !!supabaseServiceKey);
    console.log("🔍 [reset-password] User ID do token:", decoded.userId);
    console.log("🔍 [reset-password] Email do token:", decoded.email);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Credenciais Supabase não configuradas");
      return res.status(500).json({
        success: false,
        error: "Configuração do servidor incorreta.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o usuário existe primeiro
    console.log("🔍 [reset-password] Verificando se o usuário existe...");
    const { data: existingUser, error: fetchError } = await supabase
      .from("system_users")
      .select("id, email, name")
      .eq("id", decoded.userId)
      .eq("email", decoded.email)
      .single();

    if (fetchError) {
      console.error("❌ [reset-password] Erro ao buscar usuário:", fetchError);
      console.error("❌ [reset-password] Código do erro:", fetchError.code);
      console.error("❌ [reset-password] Mensagem:", fetchError.message);
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado. O link pode estar inválido.",
      });
    }

    if (!existingUser) {
      console.error("❌ [reset-password] Usuário não encontrado no banco");
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado. O link pode estar inválido.",
      });
    }

    console.log("✅ [reset-password] Usuário encontrado:", existingUser.email);

    // Atualizar senha no banco
    console.log("📝 [reset-password] Tentando atualizar senha no banco...");
    const { data: updateData, error: updateError } = await supabase
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
      .select();

    if (updateError) {
      console.error("❌ [reset-password] Erro ao atualizar senha:", updateError);
      console.error("❌ [reset-password] Código do erro:", updateError.code);
      console.error("❌ [reset-password] Mensagem:", updateError.message);
      console.error("❌ [reset-password] Detalhes:", updateError.details);
      console.error("❌ [reset-password] Hint:", updateError.hint);
      
      // Mensagens de erro mais específicas
      if (updateError.code === "42501") {
        return res.status(500).json({
          success: false,
          error: "Erro de permissão ao atualizar senha. Contate o suporte.",
        });
      }
      
      return res.status(500).json({
        success: false,
        error: `Erro ao atualizar senha: ${updateError.message}`,
      });
    }

    if (!updateData || updateData.length === 0) {
      console.error("❌ [reset-password] Nenhum registro foi atualizado");
      return res.status(500).json({
        success: false,
        error: "Não foi possível atualizar a senha. Tente novamente.",
      });
    }

    console.log("✅ [reset-password] Senha atualizada com sucesso");
    console.log("✅ [reset-password] Registros atualizados:", updateData.length);
    console.log("✅ [reset-password] Email:", decoded.email);
    
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro na API de reset de senha:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar solicitação.",
    });
  }
}