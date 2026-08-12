# 🚀 Guia de Deploy

Este documento detalha como fazer o deploy do sistema em produção.

---

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Configuração do Supabase](#configuração-do-supabase)
- [Deploy na Vercel](#deploy-na-vercel)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Configurações de Produção](#configurações-de-produção)
- [Monitoramento](#monitoramento)
- [Backup e Recuperação](#backup-e-recuperação)

---

## 📦 Pré-requisitos

### Contas Necessárias

1. **Conta Supabase** (gratuita disponível)
   - Acesse: https://supabase.com
   - Crie um projeto novo

2. **Conta Vercel** (gratuita disponível)
   - Acesse: https://vercel.com
   - Conecte com seu GitHub

3. **Conta GitHub** (para CI/CD)
   - Repositório do projeto deve estar no GitHub

---

## 🗄️ Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse o Supabase Dashboard
2. Clique em "New Project"
3. Preencha:
   - **Name**: sistemaDuvoEnterprise
   - **Database Password**: Gere uma senha forte (guarde-a!)
   - **Region**: Escolha a mais próxima (South America - São Paulo recomendado)
   - **Pricing Plan**: Free (ou Pro se necessário)

### 2. Executar Migrações

**Via SQL Editor (Recomendado para produção):**

1. Acesse **SQL Editor** no Supabase Dashboard
2. Execute os arquivos de migration em ordem cronológica:

```bash
# Ordem de execução:
supabase/migrations/20260115100545_migration_18896768.sql  # Tabelas base
supabase/migrations/20260115170856_migration_7b1b59df.sql  # Campos adicionais
supabase/migrations/20260115210624_migration_4322d879.sql  # Índices
supabase/migrations/20260115220912_migration_dbd9d2a7.sql  # RLS
# ... todos os demais arquivos em ordem de timestamp
```

3. Copie o conteúdo de cada arquivo
4. Cole no SQL Editor
5. Clique em "Run"
6. Aguarde confirmação de sucesso
7. Repita para todos os arquivos

**Verificação:**
```sql
-- Verificar se todas as tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Deve retornar:
-- admin_fee_exemptions
-- location_expenses
-- locations
-- payments
-- properties
-- rentals
-- system_users
-- tenants
-- user_location_permissions
```

### 3. Configurar Storage

1. Acesse **Storage** no Supabase Dashboard
2. Crie os buckets:

**Bucket: property-images**
```
Name: property-images
Public: true (para visualização pública)
File size limit: 5 MB
Allowed MIME types: image/jpeg, image/png, image/webp
```

**RLS Policy para property-images:**
```sql
-- Permitir visualização pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- Permitir upload autenticado
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images' 
  AND auth.role() = 'authenticated'
);
```

**Bucket: documents**
```
Name: documents
Public: false (privado)
File size limit: 10 MB
Allowed MIME types: application/pdf, image/jpeg, image/png
```

**RLS Policy para documents:**
```sql
-- Apenas usuários autenticados
CREATE POLICY "Authenticated Access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);
```

### 4. Configurar Authentication

1. Acesse **Authentication** → **Providers**
2. Configure **Email/Password**:
   - ✅ Enable Email provider
   - ✅ Confirm email: DESABILITADO (para desenvolvimento) ou HABILITADO (produção)
   - ✅ Secure email change: HABILITADO

3. Configure **Email Templates** (opcional):
   - Personalize templates de confirmação
   - Adicione logo da empresa
   - Ajuste textos

4. Configure **Site URL**:
```
Site URL: https://seu-dominio.vercel.app
```

5. Configure **Redirect URLs**:
```
https://seu-dominio.vercel.app/**
https://seu-dominio.vercel.app/auth/callback
```

### 5. Criar Usuário Admin Inicial

**Via SQL Editor:**
```sql
-- 1. Criar usuário no auth.users (substitua valores)
INSERT INTO auth.users (
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  'admin@exemplo.com',
  crypt('senha-segura-aqui', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- 2. Criar registro em system_users
INSERT INTO system_users (user_id, name, email, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@exemplo.com'),
  'Administrador',
  'admin@exemplo.com',
  'admin'
);

-- 3. Criar localização padrão
INSERT INTO locations (name, admin_fee_percentage)
VALUES ('São Paulo', 10.00);

-- 4. Dar permissão ao admin para todas as localizações
INSERT INTO user_location_permissions (user_id, location_id)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'admin@exemplo.com'),
  id
FROM locations;
```

### 6. Obter Credenciais

1. Acesse **Settings** → **API**
2. Copie:
   - **Project URL**: `https://abc123.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: (NÃO use no frontend!)

---

## ☁️ Deploy na Vercel

### 1. Conectar Repositório

1. Acesse https://vercel.com/new
2. Importe seu repositório GitHub
3. Configure o projeto:

```
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 2. Configurar Variáveis de Ambiente

**Environment Variables:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upload (opcional - para limitar tamanho)
NEXT_PUBLIC_MAX_FILE_SIZE=10485760

# Environment
NODE_ENV=production
```

**IMPORTANTE:**
- ✅ Configure para **Production**, **Preview** e **Development**
- ✅ NUNCA exponha `service_role_key` no frontend
- ✅ Guarde credenciais em local seguro (1Password, Bitwarden, etc.)

### 3. Deploy

1. Clique em **Deploy**
2. Aguarde o build (2-5 minutos)
3. Acesse a URL gerada: `https://seu-projeto.vercel.app`

### 4. Configurar Domínio Personalizado (Opcional)

1. Acesse **Settings** → **Domains**
2. Adicione seu domínio:
   - `www.seusite.com.br`
   - `seusite.com.br`
3. Configure DNS no seu provedor:

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.21.21
```

4. Aguarde propagação DNS (até 48h)

---

## 🔐 Variáveis de Ambiente

### Produção (.env.production)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upload
NEXT_PUBLIC_MAX_FILE_SIZE=10485760

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Sentry (opcional)
SENTRY_DSN=https://abc123@sentry.io/123456
```

### Desenvolvimento (.env.local)

```bash
# Supabase (use projeto de desenvolvimento)
NEXT_PUBLIC_SUPABASE_URL=https://dev-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upload
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

---

## ⚙️ Configurações de Produção

### Next.js Config

**next.config.mjs:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Imagens otimizadas
  images: {
    domains: [
      'seu-projeto.supabase.co',
      'images.unsplash.com',
    ],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Headers de segurança
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Vercel Config

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

---

## 📊 Monitoramento

### Vercel Analytics

1. Acesse **Analytics** no Vercel Dashboard
2. Visualize:
   - **Page Views**: Páginas mais visitadas
   - **Performance**: Core Web Vitals
   - **Errors**: Erros de runtime

### Supabase Monitoring

1. Acesse **Database** → **Logs**
2. Monitore:
   - **Query Performance**: Queries lentas
   - **Connection Pool**: Uso de conexões
   - **Errors**: Erros de SQL

3. Configure **Alertas**:
   - CPU > 80%
   - Storage > 90%
   - Connection pool > 80%

### Sentry (Opcional)

**Instalação:**
```bash
npm install @sentry/nextjs
```

**Configuração (sentry.client.config.js):**
```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

---

## 💾 Backup e Recuperação

### Backup Automático (Supabase)

**Supabase faz backup automático diário (plano Free):**
- Retenção: 7 dias
- Backup completo do banco de dados
- Sem custo adicional

**Para backup manual:**
1. Acesse **Database** → **Backups**
2. Clique em **Create Backup**
3. Aguarde conclusão
4. Download do backup (formato SQL)

### Backup Local (Script)

**scripts/backup-db.sh:**
```bash
#!/bin/bash

# Configuração
SUPABASE_PROJECT_ID="seu-projeto"
OUTPUT_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório
mkdir -p $OUTPUT_DIR

# Fazer backup via API
curl -X GET \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/backups" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  > "${OUTPUT_DIR}/backup_${DATE}.json"

echo "✅ Backup criado: backup_${DATE}.json"
```

### Restauração

**Via Supabase Dashboard:**
1. Acesse **Database** → **Backups**
2. Selecione o backup desejado
3. Clique em **Restore**
4. Confirme (⚠️ ISSO VAI SOBRESCREVER O BANCO ATUAL)

**Via SQL (manual):**
```bash
# 1. Fazer dump do backup
psql $DATABASE_URL < backup.sql

# 2. Verificar restauração
psql $DATABASE_URL -c "SELECT COUNT(*) FROM properties;"
```

---

## 🔧 Troubleshooting

### Erro: "Failed to connect to Supabase"

**Causa:** Credenciais incorretas ou expiradas

**Solução:**
1. Verifique se `NEXT_PUBLIC_SUPABASE_URL` está correto
2. Regenere `NEXT_PUBLIC_SUPABASE_ANON_KEY` no Supabase Dashboard
3. Atualize variáveis de ambiente na Vercel
4. Faça redeploy

---

### Erro: "RLS policy violation"

**Causa:** Permissões insuficientes no banco

**Solução:**
```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'properties';

-- Adicionar política se necessário
CREATE POLICY "Users can view properties"
ON properties FOR SELECT
USING (auth.role() = 'authenticated');
```

---

### Build falha na Vercel

**Causa:** Erro de TypeScript ou dependências

**Solução:**
1. Rode localmente: `npm run build`
2. Corrija erros de TypeScript
3. Verifique `package.json` (todas as deps instaladas)
4. Commit e push novamente

---

### Imagens não carregam

**Causa:** Domínio não configurado em `next.config.mjs`

**Solução:**
```javascript
// next.config.mjs
images: {
  domains: [
    'seu-projeto.supabase.co',
    'images.unsplash.com',
  ],
}
```

---

## 📈 Otimizações de Produção

### 1. Caching

**Configurar cache de queries:**
```typescript
// src/services/cacheService.ts
const cache = new Map();

export function getCachedData(key: string, ttl: number = 300000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
}

export function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}
```

### 2. CDN (Vercel Edge Network)

Vercel automaticamente usa CDN global. Para otimizar:

```typescript
// pages/_app.tsx
export const config = {
  unstable_runtimeJS: false, // Remove JS desnecessário
};
```

### 3. Compressão

**Vercel faz automaticamente:**
- ✅ Gzip
- ✅ Brotli
- ✅ Minificação

### 4. Database Indexes

**Verificar índices necessários:**
```sql
-- Índices recomendados para produção
CREATE INDEX IF NOT EXISTS idx_payments_rental_status 
ON payments(rental_id, status);

CREATE INDEX IF NOT EXISTS idx_properties_location_status 
ON properties(location_id, status);

CREATE INDEX IF NOT EXISTS idx_rentals_dates 
ON rentals(start_date, end_date) WHERE status = 'active';
```

---

## 🔒 Checklist de Segurança

Antes de ir para produção:

- [ ] **Credenciais seguras**: Senhas fortes e únicas
- [ ] **HTTPS habilitado**: Vercel faz automaticamente
- [ ] **RLS habilitado**: Todas as tabelas com Row Level Security
- [ ] **Confirmação de email**: Habilitada no Supabase Auth
- [ ] **Rate limiting**: Configurado no Supabase (API)
- [ ] **CORS configurado**: Apenas domínios permitidos
- [ ] **Variáveis de ambiente**: Não commitadas no Git
- [ ] **Backup automático**: Verificado e testado
- [ ] **Monitoramento**: Sentry ou similar configurado
- [ ] **SSL/TLS**: Certificado válido (Vercel faz automaticamente)

---

## 📚 Recursos Adicionais

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Discord**: https://discord.supabase.com

---

## 🆘 Suporte

Para problemas de deploy:

1. **Vercel Support**: https://vercel.com/support
2. **Supabase Support**: support@supabase.io
3. **Documentação do projeto**: Veja outros arquivos em `/docs`

---

**Próximos documentos:**
- [Arquitetura do Sistema](ARCHITECTURE.md)
- [Regras de Negócio](REGRAS_DE_NEGOCIO.md)
- [Documentação de API](API_DOCUMENTATION.md)
- [Esquema do Banco de Dados](DATABASE_SCHEMA.md)