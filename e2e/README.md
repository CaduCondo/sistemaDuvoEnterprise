# Testes E2E — Duvo Enterprise

Suíte de testes automatizados end-to-end: **Playwright** (`.spec.ts`) e **Cucumber/Gherkin (BDD)** (`.feature`), cobrindo login, permissões por perfil, CRUD de imóveis/inquilinos, locações, cauções e pagamentos.

> ℹ️ **Revisão de 2026-08:** toda a suíte foi reconstruída contra a UI e o schema reais do sistema (não existe mais rota `/login` dedicada — o login é o dropdown "Gerenciador" na home pública `/`, ver `src/components/public/PublicHeader.tsx`). Arquivos antigos que ainda assumiam a UI anterior foram corrigidos; os que eram puramente duplicados/mortos (specs `.skip` na raiz de `e2e/`, apontando para uma rota `/login` inexistente) foram removidos.

## 📁 Estrutura

```
e2e/
├── features/                # Cenários Gherkin (BDD), em português
├── step-definitions/        # Implementação dos steps Gherkin
├── support/world.ts         # CustomWorld do Cucumber (fixtures, browser, DB)
├── pages/                   # Page Object Model (LoginPage, DashboardPage)
├── helpers/                 # DatabaseHelper (Supabase), auth.helper, global-setup/teardown
├── config/test.config.ts    # Credenciais e URLs de teste (lidas de .env.local)
├── tests/                   # Specs Playwright organizados por área
│   ├── auth/                # Login, recuperação de senha, troca obrigatória, tema, 3 tentativas
│   ├── users/                # CRUD de usuários do sistema
│   ├── permissions/          # Restrições por role (financeiro, etc.)
│   ├── api/                  # Testes de API (auth, users)
│   ├── smoke/                 # Fluxos críticos (@smoke)
│   ├── security/              # SQL injection, XSS, autorização (@security)
│   ├── performance/           # Tempo de carregamento (@performance)
│   ├── stress/                 # Requisições concorrentes (@stress)
│   ├── simple/                 # 3 specs mínimos de fumaça (login/criar imóvel/criar inquilino)
│   └── ui/                     # Testes de UI do login via Page Object
├── cucumber.config.cjs       # Config real do Cucumber (CommonJS)
├── tsconfig.json             # tsconfig isolado do e2e/ (module: commonjs)
└── reports/                  # Relatórios HTML/JSON gerados após execução
```

## ⚙️ Pré-requisitos

1. `npm install`
2. Um `.env.local` na raiz do projeto com credenciais reais de um projeto Supabase de teste:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   A `SUPABASE_SERVICE_ROLE_KEY` é usada pelo `DatabaseHelper` para criar/limpar dados de teste diretamente no banco (bypass de RLS) — **nunca use o Supabase do ambiente de produção para rodar os testes**, pois o `globalSetup` cria usuários e o `cleanupAllTestData` remove imóveis/inquilinos/locações criados durante a execução.
3. O app precisa conseguir subir localmente com `npm run dev` (o Playwright sobe o servidor automaticamente via `webServer`, ver `playwright.config.ts`).

## 🚀 Como Executar

### Playwright (specs `.spec.ts`)

```bash
npm run test:e2e            # todos os specs, headless
npm run test:e2e:ui         # interface visual interativa
npm run test:e2e:headed     # com navegador visível
npm run test:e2e:debug      # passo a passo
```

Por arquivo ou nome:
```bash
npx playwright test e2e/tests/auth/login-dropdown.spec.ts
npx playwright test -g "deve criar imóvel"
```

Por tag/projeto (ver `playwright.config.ts`):
```bash
npx playwright test --project=smoke        # grep: /@smoke/
npx playwright test --project=security      # grep: /@security/
npx playwright test --project=performance   # grep: /@performance/
npx playwright test --project=permissions   # grep: /@permissions/
npx playwright test --project=api-tests     # grep: /@api/
npx playwright test --project=all-tests     # roda TODOS os *.spec.ts, com ou sem tag (padrão)
```

> ⚠️ Antes de 2026-08 o projeto principal tinha `grep: /@ui/`, e como só 4 dos ~18 arquivos de teste tinham alguma tag, os outros 14 nunca eram executados por `npm run test:e2e` — nem em CI. Isso foi corrigido: o projeto `all-tests` roda `testMatch: /.*\.spec\.ts/` sem filtro de tag.

### Cucumber/BDD (cenários `.feature`)

```bash
npm run test:bdd            # roda todos os cenários Gherkin
npm run test:bdd:dry        # dry-run: só valida que todo step tem definição (sem abrir navegador)
```

Cenário/feature específica:
```bash
npx cucumber-js --config e2e/cucumber.config.cjs e2e/features/1-autenticacao.feature
npx cucumber-js --config e2e/cucumber.config.cjs e2e/features/5-imoveis-crud.feature:15
```

Rode sempre `test:bdd:dry` primeiro depois de editar `.feature`/step definitions — ele pega steps ambíguos ou não implementados em segundos, sem precisar subir o app.

## 🧪 O que a suíte cobre

### BDD (`e2e/features/*.feature`) — 114 cenários / ~975 steps

| Feature | Cobertura |
|---|---|
| `1-autenticacao.feature` | Login (perfis admin/financeiro/corretor), recuperação de senha, logout |
| `2-permissoes-admin.feature` | Acesso total, gestão de usuários, edição de permissões |
| `3-permissoes-financeiro.feature` | Acesso restrito a Dashboard + Financeiro |
| `4-permissoes-gestao.feature` | Acesso a operações, bloqueio de Financeiro/Configurações |
| `5-imoveis-crud.feature` | CRUD de imóveis, filtros, validações |
| `6-inquilinos-crud.feature` | CRUD de inquilinos, CPF/CNPJ, busca de CEP |
| `7-locacoes-regras.feature` | Caução, parcelamento, corretor parceiro, geração de pagamentos |
| `8-pagamentos-calculos.feature` | Cálculos de taxa, recibos, filtros por mês/ano |
| `9-regressao-visual.feature` | Layout e responsividade não quebram entre páginas |
| `10-caucoes.feature` | Regras específicas de parcelas de caução |

Todos os dados usados nesses cenários (imóveis, inquilinos, locações, pagamentos) são criados diretamente no Supabase pelo `DatabaseHelper` (bypass de RLS via service role), e removidos ao final da execução por `cleanupAllTestData()`. Os 3 usuários de teste padrão (`admin`/`financeiro`/`corretor`, ver `e2e/config/test.config.ts`) são criados/reaproveitados a cada execução e **não** são removidos.

### Playwright (`e2e/tests/**/*.spec.ts`)

- **auth/**: dropdown de login, 3 tentativas + bloqueio de 30min, recuperação de senha, troca obrigatória de senha temporária, troca de tema
- **users/**: CRUD completo de usuários do sistema (`system_users`)
- **permissions/**: restrição de rotas por role
- **api/**: deprecado (2026-08) — testava `/api/auth/*` e `/api/users/*`, endpoints que nunca existiram no código (auth e gestão de usuários são 100% client-side, via chamadas diretas ao Supabase). Ver comentário no topo dos arquivos.
- **smoke/**: fluxos críticos ponta a ponta
- **security/**: SQL injection, XSS, cookies, bloqueio de rota sem autenticação, autorização por perfil
- **performance/**: tempo de carregamento de home/dashboard/imóveis
- **stress/**: requisições concorrentes contra `/api/health`
- **simple/**: 3 specs mínimos (login, criar imóvel, criar inquilino) — bons para verificação rápida de que o ambiente local está funcionando

## 📝 Convenções

### IDs de elementos

O padrão de IDs usado no app é `{page}-{section}-{element}` (ex.: `#property-value`, `#tenant-document`, `#dashboard-page`). Onde não há ID (menus, botões de ação), os testes usam `getByRole`/`getByText` — ver `e2e/pages/*.ts` e `e2e/step-definitions/common.steps.ts` para os padrões já validados contra a UI real antes de inventar um novo seletor.

### Gherkin

```gherkin
# language: pt
Funcionalidade: Autenticação de Usuários
  Cenário: Login com sucesso
    Dado que estou na página de login
    Quando preencho o campo "Usuário" com "admin@teste.com"
    E preencho o campo "Senha" com "Admin@123"
    E clico no botão "Entrar"
    Então devo ser redirecionado para "/dashboard"
```

Novos steps vão em `e2e/step-definitions/`; antes de criar um novo step, confira se `common.steps.ts` já cobre o caso — steps duplicados entre arquivos causam erro de "step ambíguo" no Cucumber.

## 📊 Relatórios

```bash
npx playwright show-report          # relatório HTML do Playwright (e2e/reports/playwright-report)
```

Cucumber gera `e2e/reports/cucumber-report.html` e `.json` quando configurado com o formatter apropriado.

## 🐛 Debugging

```bash
npx playwright show-trace           # trace do último teste que falhou
npx playwright codegen http://localhost:3000   # gravar interações e gerar código
```

## 🔧 Configuração

- **Playwright**: `playwright.config.ts` (raiz do repo) — timeout 60s/teste, expect 10s, `baseURL: http://localhost:3000`, sobe `npm run dev` automaticamente.
- **Cucumber**: `e2e/cucumber.config.cjs` (CommonJS — `defineConfig` não é exportado pelo `@cucumber/cucumber`, por isso a config é um objeto plano) + `e2e/tsconfig.json` isolado (`module: commonjs`, necessário porque o tsconfig raiz usa `esnext` e conflita com `ts-node`).

## ⚠️ Achados relevantes durante a revisão de 2026-08

- `authService.validatePassword` compara senha em texto puro (não usa bcrypt/hash) — ver aviso em `docs/AUTHENTICATION.md`. Os testes espelham esse comportamento real ao seedar usuários (`DatabaseHelper.ensureTestUser` grava a senha em texto puro), mas isso é uma vulnerabilidade real do app, fora do escopo desta revisão de testes.
- `src/contexts/AuthContext.tsx` redireciona usuários não autenticados para `/login`, mas não existe `src/pages/login.tsx` — o redirecionamento aponta para uma rota inexistente (404). O teste de segurança correspondente (`e2e/tests/security/auth-security.spec.ts`) verifica apenas que o acesso é bloqueado, não o conteúdo da página de destino.
