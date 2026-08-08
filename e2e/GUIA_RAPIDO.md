# 🚀 Guia Rápido — Testes E2E

> ℹ️ Atualizado em 2026-08. Para detalhes completos (estrutura, cobertura, troubleshooting), ver `e2e/README.md`.

## 1️⃣ Setup (primeira vez)

```bash
npm install
npx playwright install
```

Crie um `.env.local` na raiz do projeto com credenciais de um projeto Supabase de **teste** (nunca produção):

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-teste.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Não é preciso criar usuários de teste manualmente — o `globalSetup` do Playwright (`e2e/helpers/global-setup.ts`) já roda `DatabaseHelper.ensureDefaultTestUsers()` automaticamente antes de qualquer execução, seedando os 3 perfis (admin/financeiro/corretor) definidos em `e2e/config/test.config.ts`.

## 2️⃣ Rodar

```bash
npm run test:e2e:ui     # Playwright, interface visual (recomendado)
npm run test:bdd        # Cucumber/Gherkin (BDD)
```

O Playwright sobe o servidor (`npm run dev`) automaticamente — não precisa rodar em outro terminal, a menos que você prefira reaproveitar um servidor já rodando (`reuseExistingServer` está habilitado fora de CI).

## ⚠️ Se der erro

**"Cannot find module"** → `npm install`
**"supabaseUrl is required" / variáveis undefined** → confira se `.env.local` existe na raiz e tem as 3 chaves do Supabase
**"Port 3000 already in use"** → `npx kill-port 3000` (ou mate o processo Node manualmente)
**Browsers do Playwright ausentes** → `npx playwright install`

## 📌 Comandos completos

Ver tabela de scripts, tags e troubleshooting detalhado em `e2e/README.md`.
