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

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: "E-mail e nome são obrigatórios",
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada");
      return res.status(500).json({
        success: false,
        error: "Configuração de e-mail não encontrada.",
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://duvoenterprise.com.br";
    const loginUrl = `${baseUrl}/?action=login`;

    // Log em DEV
    if (process.env.NODE_ENV === "development") {
      console.log("📧 ========================================");
      console.log("📧 E-MAIL DE BOAS-VINDAS (DEV)");
      console.log("📧 ========================================");
      console.log("📧 Para:", email);
      console.log("📧 Nome:", name);
      console.log("📧 Senha Temporária:", temporaryPassword || "N/A");
      console.log("📧 ========================================");
    }

    // Enviar e-mail via Resend
    const { data, error } = await resend.emails.send({
      from: "D'Uvo Enterprise <noreply@duvoenterprise.com.br>",
      to: [email],
      subject: "👋 Bem-vindo(a) ao D'Uvo Enterprise!",
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
              <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Bem-vindo(a), ${name}! 🎉</h2>
              
              <p style="color: #475569; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                É um prazer tê-lo(a) conosco! Sua conta foi criada com sucesso e você já pode começar a usar o sistema de gestão de imóveis.
              </p>

              ${temporaryPassword ? `
              <!-- Credenciais -->
              <div style="background-color: #f1f5f9; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <p style="color: #1e293b; margin: 0 0 12px; font-size: 14px; font-weight: 600;">
                  🔑 Suas credenciais de acesso:
                </p>
                <div style="background-color: white; border-radius: 8px; padding: 12px; margin: 0 0 8px;">
                  <p style="color: #64748b; margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                    E-mail
                  </p>
                  <p style="color: #1e293b; margin: 0; font-size: 15px; font-weight: 600; font-family: monospace;">
                    ${email}
                  </p>
                </div>
                <div style="background-color: white; border-radius: 8px; padding: 12px;">
                  <p style="color: #64748b; margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Senha Temporária
                  </p>
                  <p style="color: #1e293b; margin: 0; font-size: 15px; font-weight: 600; font-family: monospace;">
                    ${temporaryPassword}
                  </p>
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #92400e; margin: 0 0 8px; font-size: 13px; font-weight: 600;">
                  ⚠️ Importante:
                </p>
                <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                  <li>No primeiro acesso, você será solicitado a <strong>criar uma nova senha</strong></li>
                  <li>Escolha uma senha <strong>forte e segura</strong></li>
                  <li>Não compartilhe suas credenciais com ninguém</li>
                </ul>
              </div>
              ` : `
              <div style="background-color: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #166534; margin: 0; font-size: 13px; line-height: 1.6;">
                  ✅ Sua conta está pronta! Use seu e-mail cadastrado para fazer login.
                </p>
              </div>
              `}

              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 32px;">
                <a href="${loginUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                  🚀 Acessar o Sistema
                </a>
              </div>

              <!-- Features -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <p style="color: #1e293b; margin: 0 0 12px; font-size: 14px; font-weight: 600;">
                  📋 O que você pode fazer:
                </p>
                <ul style="color: #475569; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                  <li>Gerenciar imóveis e inquilinos</li>
                  <li>Controlar pagamentos e cauções</li>
                  <li>Acompanhar contratos e vencimentos</li>
                  <li>Gerar relatórios financeiros</li>
                  <li>E muito mais!</li>
                </ul>
              </div>

              <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.6;">
                Caso tenha alguma dúvida ou precise de suporte, estamos à disposição!
              </p>

              <p style="color: #475569; margin: 16px 0 0; font-size: 14px; line-height: 1.6;">
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
        error: "Erro ao enviar e-mail. Tente novamente.",
      });
    }

    console.log("E-mail de boas-vindas enviado com sucesso:", data);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro na API de boas-vindas:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar solicitação.",
    });
  }
}