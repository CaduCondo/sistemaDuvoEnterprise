import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { email, name, temporaryPassword } = req.body;

    if (!email || !temporaryPassword) {
      return res.status(400).json({
        success: false,
        error: "E-mail e senha temporária são obrigatórios",
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada");
      return res.status(500).json({
        success: false,
        error: "Configuração de e-mail não encontrada. Entre em contato com o suporte.",
      });
    }

    const { data, error } = await resend.emails.send({
      from: "D'Uvo Enterprise <noreply@duvoenterprise.com.br>",
      to: [email],
      subject: "🔐 Recuperação de Senha - D'Uvo Enterprise",
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
              <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Recuperação de Senha</h2>
              
              <p style="color: #475569; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                Olá${name ? ` <strong>${name}</strong>` : ""},
              </p>

              <p style="color: #475569; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                Você solicitou a recuperação de senha. Sua senha temporária é:
              </p>

              <!-- Password Box -->
              <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; margin: 0 0 24px; text-align: center;">
                <p style="color: #1e40af; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                  Senha Temporária
                </p>
                <p style="color: #1e293b; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                  ${temporaryPassword}
                </p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                <p style="color: #1e40af; margin: 0 0 12px; font-size: 14px; font-weight: 600;">
                  📋 Instruções:
                </p>
                <ol style="color: #475569; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                  <li>Acesse <a href="https://duvoenterprise.com.br" style="color: #2563eb; text-decoration: none;">duvoenterprise.com.br</a></li>
                  <li>Clique em <strong>"Gerenciador"</strong></li>
                  <li>Use seu e-mail e a senha temporária acima</li>
                  <li>O sistema vai solicitar que você crie uma nova senha</li>
                  <li>Escolha uma senha forte e segura</li>
                </ol>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
                  <strong>⚠️ Importante:</strong> Esta senha é temporária e deve ser alterada no primeiro acesso. Por segurança, não compartilhe esta senha com ninguém.
                </p>
              </div>

              <p style="color: #475569; margin: 0 0 8px; font-size: 14px; line-height: 1.6;">
                Se você não solicitou esta recuperação, ignore este e-mail.
              </p>

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

    console.log("E-mail de recuperação enviado com sucesso:", data);
    
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro na API de recuperação de senha:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar solicitação.",
    });
  }
}