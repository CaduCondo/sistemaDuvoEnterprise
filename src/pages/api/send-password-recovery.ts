import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import jwt from "jsonwebtoken";

const resend = new Resend(process.env.RESEND_API_KEY);

type ResponseData = {
  success: boolean;
  error?: string;
  resetLink?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const { email, userId, name } = req.body;

    if (!email || !userId) {
      return res.status(400).json({
        success: false,
        error: "E-mail e ID do usuário são obrigatórios",
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada");
      return res.status(500).json({
        success: false,
        error: "Configuração de e-mail não encontrada. Entre em contato com o suporte.",
      });
    }

    const secret = process.env.JWT_SECRET || "duvo-enterprise-secret-key-2024";
    const token = jwt.sign(
      { userId, email, type: "password_reset" },
      secret,
      { expiresIn: "1h" }
    );

    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost:3000";
    
    const isDevelopment = host.includes("localhost") || host.includes("127.0.0.1");
    
    const baseUrl = isDevelopment 
      ? `http://${host}`
      : `https://${host}`;
    
    const resetLink = `${baseUrl}/redefinir-senha?token=${token}`;

    if (process.env.NODE_ENV === "development") {
      console.log("📧 ========================================");
      console.log("📧 LINK DE REDEFINIÇÃO GERADO (DEV)");
      console.log("📧 ========================================");
      console.log("📧 Para:", email);
      console.log("📧 Nome:", name || "N/A");
      console.log("📧 Link:", resetLink);
      console.log("📧 ⏱️ Válido por: 1 hora");
      console.log("📧 ========================================");
    }

    const { data, error } = await resend.emails.send({
      from: "D'Uvo Enterprise <noreply@duvoenterprise.com.br>",
      to: [email],
      subject: "🔐 Redefinição de Senha - D'Uvo Enterprise",
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding: 40px 20px; text-align: center;">
              <div style="background-color: white; width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">D'Uvo Enterprise</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 14px;">Property Control System</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Redefinição de Senha</h2>
              
              <p style="color: #475569; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                Olá${name ? ` <strong>${name}</strong>` : ""},
              </p>

              <p style="color: #475569; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 32px;">
                <a href="${resetLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                  🔐 Redefinir Minha Senha
                </a>
              </div>

              <p style="color: #64748b; margin: 0 0 16px; font-size: 13px; text-align: center;">
                Ou copie e cole este link no seu navegador:
              </p>

              <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin: 0 0 24px; word-break: break-all;">
                <a href="${resetLink}" style="color: #2563eb; text-decoration: none; font-size: 12px;">
                  ${resetLink}
                </a>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #92400e; margin: 0 0 8px; font-size: 13px; font-weight: 600;">
                  ⚠️ Importante:
                </p>
                <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                  <li>Este link é válido por <strong>1 hora</strong></li>
                  <li>Use-o apenas uma vez para criar sua nova senha</li>
                  <li>Não compartilhe este link com ninguém</li>
                </ul>
              </div>

              <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #475569; margin: 0; font-size: 13px; line-height: 1.6;">
                  Se você <strong>não solicitou</strong> esta redefinição, ignore este e-mail. Sua senha permanecerá inalterada.
                </p>
              </div>

              <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.6;">
                Atenciosamente,<br>
                <strong>Equipe D'Uvo Enterprise</strong>
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; margin: 0 0 8px; font-size: 12px;">
                © ${new Date().getFullYear()} D'Uvo Enterprise Corporation. Todos os direitos reservados.
              </p>
              <p style="color: #94a3b8; margin: 0; font-size: 11px;">
                Desenvolvido por Carlos Uva
              </p>
            </div>

          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Erro ao enviar e-mail via Resend:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao enviar e-mail. Tente novamente em alguns instantes.",
      });
    }

    console.log("E-mail de redefinição enviado com sucesso:", data);
    
    const response: ResponseData = { success: true };
    if (process.env.NODE_ENV === "development") {
      response.resetLink = resetLink;
    }
    
    return res.status(200).json(response);

  } catch (error) {
    console.error("Erro na API de redefinição de senha:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar solicitação.",
    });
  }
}