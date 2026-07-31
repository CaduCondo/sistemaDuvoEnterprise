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

    // Usar anon key para chamar RPC (suficiente)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ [reset-password] Credenciais Supabase não configuradas");
      return res.status(500).json({
        success: false,
        error: "Configuração do servidor incorreta.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log("📝 [reset-password] Chamando função reset_user_password_by_token via RPC");
    console.log("📝 [reset-password] User ID:", decoded.userId);
    console.log("📝 [reset-password] Email:", decoded.email);

    // Chamar função SECURITY DEFINER que bypassa RLS
    const { data: result, error: rpcError } = await supabase.rpc(
      'reset_user_password_by_token',
      {
        p_user_id: decoded.userId,
        p_email: decoded.email,
        p_new_password: newPassword
      }
    );

    if (rpcError) {
      console.error("❌ [reset-password] Erro RPC:", rpcError);
      console.error("❌ [reset-password] Código:", rpcError.code);
      console.error("❌ [reset-password] Mensagem:", rpcError.message);
      console.error("❌ [reset-password] Detalhes:", rpcError.details);
      
      return res.status(500).json({
        success: false,
        error: "Erro ao processar redefinição de senha. Tente novamente.",
      });
    }

    console.log("📊 [reset-password] Resultado RPC:", result);
    console.log("📊 [reset-password] Tipo do resultado:", typeof result);
    console.log("📊 [reset-password] Resultado stringificado:", JSON.stringify(result));

    // A função retorna JSONB, que pode vir como objeto ou string
    let parsedResult: any;
    
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch (e) {
        console.error("❌ [reset-password] Erro ao parsear resultado:", e);
        return res.status(500).json({
          success: false,
          error: "Erro ao processar resposta do servidor.",
        });
      }
    } else {
      parsedResult = result;
    }

    console.log("📊 [reset-password] Resultado parseado:", parsedResult);

    // Verificar se a função retornou sucesso
    if (!parsedResult || typeof parsedResult !== 'object') {
      console.error("❌ [reset-password] Resultado RPC inválido:", parsedResult);
      return res.status(500).json({
        success: false,
        error: "Erro ao processar redefinição de senha.",
      });
    }

    if (!parsedResult.success) {
      console.error("❌ [reset-password] Função retornou erro:", parsedResult.error);
      return res.status(400).json({
        success: false,
        error: parsedResult.error || "Erro ao atualizar senha.",
      });
    }

    console.log("✅ [reset-password] Senha atualizada com sucesso via RPC");
    console.log("✅ [reset-password] Email:", decoded.email);
    
    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ [reset-password] Erro geral:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro interno ao processar solicitação.",
    });
  }
}