# Setup de Testes E2E

> ℹ️ Consolidado em 2026-08 — ver **`e2e/GUIA_RAPIDO.md`** para o passo a passo atualizado (instalação, `.env.local`, primeira execução) e **`e2e/README.md`** para referência completa.

Resumo:

```bash
npm install
npx playwright install
# criar .env.local com NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
npm run test:e2e:ui
```

Os usuários de teste são seedados automaticamente pelo `globalSetup` do Playwright — não é necessário nenhum passo manual de "setup" além do `.env.local`.
