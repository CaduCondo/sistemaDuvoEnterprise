import type { NextApiRequest, NextApiResponse } from "next";

type RequestBody = {
  email: string;
  name: string;
  temporaryPassword: string;
};

type ResponseData = {
  success: boolean;
  message?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { email, name, temporaryPassword } = req.body as RequestBody;

    if (!email || !name || !temporaryPassword) {
      return res.status(400).json({ 
        success: false, 
        error: "Email, nome e senha temporária são obrigatórios" 
      });
    }

    // Verificar se a API Key do Resend está configurada
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY não configurada no .env.local");
      return res.status(500).json({ 
        success: false, 
        error: "Serviço de e-mail não configurado. Entre em contato com o administrador." 
      });
    }

    // Enviar e-mail usando Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "D'Uvo Enterprise <noreply@duvoenterprise.com.br>",
        to: [email],
        subject: "Recuperação de Senha - D'Uvo Enterprise",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
                .password-box { background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
                .password { font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 2px; font-family: 'Courier New', monospace; }
                .requirements { background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
                .requirements ul { margin: 10px 0; padding-left: 20px; }
                .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">🏢 D'Uvo Enterprise</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">Property Control System</p>
                </div>
                
                <div class="content">
                  <h2 style="color: #1e293b; margin-top: 0;">Olá ${name},</h2>
                  
                  <p>Você solicitou a recuperação de senha do sistema <strong>D'Uvo Enterprise</strong>.</p>
                  
                  <div class="password-box">
                    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Sua senha temporária:</p>
                    <div class="password">${temporaryPassword}</div>
                  </div>
                  
                  <p>
                    <strong>Acesse:</strong><br>
                    <a href="https://www.duvoenterprise.com.br" class="button">www.duvoenterprise.com.br</a>
                  </p>
                  
                  <div class="requirements">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">⚠️ IMPORTANTE:</p>
                    <p style="margin: 0;">Por segurança, você será <strong>obrigado a criar uma nova senha</strong> no primeiro acesso.</p>
                    
                    <p style="margin: 15px 0 5px 0; font-weight: bold;">Requisitos da nova senha:</p>
                    <ul style="margin: 5px 0;">
                      <li>Pelo menos 1 letra maiúscula</li>
                      <li>Pelo menos 1 letra minúscula</li>
                      <li>Pelo menos 1 número</li>
                      <li>Entre 6 e 12 caracteres</li>
                    </ul>
                  </div>
                  
                  <p style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; color: #991b1b;">
                    <strong>⚠️ Atenção:</strong> Se você <strong>não solicitou</strong> esta recuperação, entre em contato com o administrador imediatamente.
                  </p>
                  
                  <div class="footer">
                    <p>Atenciosamente,<br><strong>Equipe D'Uvo Enterprise</strong></p>
                    <p style="margin-top: 15px;">Desenvolvido por Carlos Uva</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Erro ao enviar e-mail via Resend:", errorData);
      
      return res.status(500).json({ 
        success: false, 
        error: "Erro ao enviar e-mail. Tente novamente em alguns instantes." 
      });
    }

    const data = await response.json();
    console.log("✅ E-mail enviado com sucesso via Resend:", data);

    return res.status(200).json({ 
      success: true, 
      message: "E-mail enviado com sucesso!" 
    });

  } catch (error) {
    console.error("❌ Erro inesperado ao enviar e-mail:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Erro ao processar solicitação. Tente novamente." 
    });
  }
}