-- Adicionar colunas para edição de e-mail na tabela email_settings
ALTER TABLE email_settings
ADD COLUMN IF NOT EXISTS email_subject TEXT,
ADD COLUMN IF NOT EXISTS email_body TEXT,
ADD COLUMN IF NOT EXISTS available_variables TEXT[];

-- Atualizar com templates padrão
UPDATE email_settings SET 
  email_subject = 'Recupere sua senha - D''Uvo Enterprise',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>Você solicitou a recuperação de senha. Clique no botão abaixo para criar uma nova senha:</p><p><a href="{{link}}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 600;">🔐 Redefinir Minha Senha</a></p><p>Este link é válido por <strong>1 hora</strong>.</p>',
  available_variables = ARRAY['{{nome}}', '{{email}}', '{{link}}']
WHERE email_type = 'password_recovery';

UPDATE email_settings SET 
  email_subject = 'Bem-vindo(a) ao D''Uvo Enterprise! 🎉',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>Sua conta foi criada com sucesso!</p><p><strong>Dados de acesso:</strong></p><ul><li>E-mail: {{email}}</li><li>Senha temporária: <code>{{senha}}</code></li></ul><p>Acesse o sistema e crie sua nova senha.</p>',
  available_variables = ARRAY['{{nome}}', '{{email}}', '{{senha}}']
WHERE email_type = 'welcome_user';

UPDATE email_settings SET 
  email_subject = 'Bem-vindo(a) à D''Uvo Enterprise!',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>Você foi cadastrado como inquilino.</p><p>Em breve você receberá mais informações sobre sua locação.</p>',
  available_variables = ARRAY['{{nome}}', '{{email}}', '{{imovel}}']
WHERE email_type = 'welcome_tenant';

UPDATE email_settings SET 
  email_subject = '⚠️ Seu contrato vence em breve',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>O contrato do imóvel <strong>{{imovel}}</strong> vence em {{dias}} dias.</p><p>Data de vencimento: <strong>{{data_vencimento}}</strong></p><p>Entre em contato para renovação.</p>',
  available_variables = ARRAY['{{nome}}', '{{imovel}}', '{{dias}}', '{{data_vencimento}}']
WHERE email_type = 'contract_expiration';

UPDATE email_settings SET 
  email_subject = '💰 Lembrete de pagamento',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>Seu pagamento vence em {{dias}} dias.</p><ul><li>Imóvel: {{imovel}}</li><li>Valor: {{valor}}</li><li>Vencimento: {{data_vencimento}}</li></ul><p>Realize o pagamento até a data de vencimento.</p>',
  available_variables = ARRAY['{{nome}}', '{{imovel}}', '{{valor}}', '{{data_vencimento}}', '{{dias}}']
WHERE email_type = 'payment_reminder';

UPDATE email_settings SET 
  email_subject = '🚨 Pagamento em atraso',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>Identificamos que o pagamento referente ao imóvel <strong>{{imovel}}</strong> está em atraso.</p><ul><li>Valor: {{valor}}</li><li>Vencimento: {{data_vencimento}}</li><li>Dias em atraso: {{dias_atraso}}</li></ul><p>Por favor, regularize sua situação o quanto antes.</p>',
  available_variables = ARRAY['{{nome}}', '{{imovel}}', '{{valor}}', '{{data_vencimento}}', '{{dias_atraso}}']
WHERE email_type = 'payment_overdue';

UPDATE email_settings SET 
  email_subject = '✅ Pagamento confirmado',
  email_body = '<p>Olá <strong>{{nome}}</strong>,</p><p>Confirmamos o recebimento do seu pagamento!</p><ul><li>Imóvel: {{imovel}}</li><li>Valor: {{valor}}</li><li>Data do pagamento: {{data_pagamento}}</li></ul><p>Obrigado!</p>',
  available_variables = ARRAY['{{nome}}', '{{imovel}}', '{{valor}}', '{{data_pagamento}}']
WHERE email_type = 'payment_confirmed';