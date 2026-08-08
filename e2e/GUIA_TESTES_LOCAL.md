# 🧪 Guia Completo - Executar Testes Localmente

Guia passo a passo para rodar os testes E2E no seu ambiente local.

> ℹ️ Revisado em 2026-08. Para uma referência mais enxuta ver `e2e/GUIA_RAPIDO.md`; para a lista completa de scripts, cobertura e tags ver `e2e/README.md`.

---

## 📋 Pré-requisitos

### 1. Node.js e npm
```bash
# Verificar versões
node --version  # Mínimo: v18.x
npm --version   # Mínimo: v9.x
```

### 2. Dependências Instaladas
```bash
# Na raiz do projeto
npm install
```

### 3. Variáveis de Ambiente

Crie um `.env.local` na raiz do projeto com credenciais de um projeto Supabase de **teste** (nunca produção — o `DatabaseHelper` cria e apaga dados via service role):

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-teste.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

---

## 🚀 Setup Inicial (Uma Vez)

### Passo 1: Instalar Browsers do Playwright
```bash
npx playwright install
```

Isso instala os navegadores necessários (Chromium, Firefox, WebKit).

### Passo 2: Verificar Instalação
```bash
npx playwright --version
```

---

## ▶️ Executar Testes

### Opção 1: Modo UI (Recomendado para Desenvolvimento)
```bash
npm run test:e2e:ui
```

**O que acontece:**
1. Abre interface gráfica do Playwright
2. Você pode selecionar quais testes rodar
3. Vê a execução em tempo real
4. Debug interativo disponível

### Opção 2: Modo Headless (CI/CD)
```bash
npm run test:e2e
```

**O que acontece:**
1. Testes rodam em background (sem abrir navegador)
2. Mais rápido
3. Ideal para integração contínua

### Opção 3: Modo Debug (Para Investigar Falhas)
```bash
npm run test:e2e:debug
```

**O que acontece:**
1. Abre navegador visível
2. Execução pausada em cada step
3. Inspector do Playwright disponível
4. Você pode interagir manualmente

---

## 🎯 Executar Testes Específicos

### Por Feature (Cucumber/BDD — não Playwright)

Arquivos `.feature` rodam via `cucumber-js`, não via `playwright test`:
```bash
# Apenas testes de cauções
npx cucumber-js --config e2e/cucumber.config.cjs e2e/features/10-caucoes.feature

# Apenas testes de autenticação
npx cucumber-js --config e2e/cucumber.config.cjs e2e/features/1-autenticacao.feature

# Apenas testes de permissões
npx cucumber-js --config e2e/cucumber.config.cjs e2e/features/2-permissoes-admin.feature
```

### Por Tag (specs `.spec.ts`)
```bash
# Apenas testes de smoke
npx playwright test --grep @smoke

# Apenas testes de segurança
npx playwright test --grep @security
```

### Por Projeto

`playwright.config.ts` define projetos por tag, não por navegador (`all-tests`, `api-tests`, `permissions`, `performance`, `security`, `smoke`, `regression`):
```bash
npx playwright test --project=smoke
npx playwright test --project=security
```

---

## 🔧 Resolver Problemas Comuns

### Problema 1: "Browser not found"

**Erro:**
```
Error: browserType.launch: Executable doesn't exist at /path/to/browser
```

**Solução:**
```bash
# Reinstalar browsers
npx playwright install --force
```

---

### Problema 2: "Timeout waiting for locator"

**Erro:**
```
TimeoutError: locator.click: Timeout 30000ms exceeded
```

**Causas comuns:**
1. Elemento não existe na página
2. Seletor CSS está incorreto
3. Página ainda está carregando

**Soluções:**
```bash
# 1. Rodar em modo debug para ver o que está acontecendo
npm run test:e2e:debug

# 2. Aumentar timeout no playwright.config.ts
timeout: 60000 // 60 segundos

# 3. Adicionar wait explícito no step
await page.waitForSelector('button:has-text("Login")');
```

---

### Problema 3: "Cannot find module"

**Erro:**
```
Error: Cannot find module '@playwright/test'
```

**Solução:**
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

---

### Problema 4: Testes passam localmente, mas falham no CI

**Causas:**
1. Diferenças de timezone
2. Dados de teste não limpos
3. Race conditions

**Soluções:**
```bash
# 1. Forçar timezone UTC
TZ=UTC npm run test:e2e

# 2. Limpar banco antes dos testes
# Adicionar em global-setup.ts:
await cleanDatabase();

# 3. Adicionar waits estáveis
await page.waitForLoadState('networkidle');
```

---

## 📊 Relatórios de Teste

### Após Execução
```bash
# Abrir relatório HTML
npx playwright show-report
```

**O relatório mostra:**
- ✅ Testes que passaram
- ❌ Testes que falharam
- ⏱️ Tempo de execução
- 📸 Screenshots de falhas
- 🎬 Vídeos de execução (se habilitado)

### Configurar Relatório
```typescript
// playwright.config.ts
export default {
  reporter: [
    ['html', { open: 'never' }],  // Não abrir automaticamente
    ['list'],                       // Console output
    ['json', { outputFile: 'test-results.json' }]
  ]
}
```

---

## 🎥 Gravar Vídeos dos Testes

### Habilitar Gravação
```typescript
// playwright.config.ts
use: {
  video: 'on-first-retry', // Grava apenas em falhas
  // ou
  video: 'on',             // Grava sempre
}
```

### Vídeos Ficam em:
```
test-results/
  nome-do-teste/
    video.webm
```

---

## 📸 Screenshots Automáticos

### Configurar
```typescript
// playwright.config.ts
use: {
  screenshot: 'only-on-failure', // Apenas em falhas
  // ou
  screenshot: 'on',              // Sempre
}
```

### Screenshots Ficam em:
```
test-results/
  nome-do-teste/
    test-failed-1.png
```

---

## 🐛 Debug Avançado

### Playwright Inspector
```bash
# Abrir inspector
PWDEBUG=1 npm run test:e2e
```

**Recursos:**
- Pausar execução
- Step over/into
- Ver seletores em tempo real
- Console JavaScript
- Network inspector

### Console.log em Steps
```typescript
// Em qualquer step
console.log("Valor atual:", await page.textContent('.total'));
```

---

## ⚡ Performance

### Paralelizar Testes
```bash
# Rodar 4 workers em paralelo
npx playwright test --workers=4
```

### Desabilitar Paralelização (Debug)
```bash
# 1 worker por vez
npx playwright test --workers=1
```

---

## 📚 Estrutura de Arquivos de Teste

```
e2e/
├── features/               # Features em Gherkin
│   ├── 1-autenticacao.feature
│   ├── 10-caucoes.feature
│   └── ...
├── step-definitions/       # Implementação dos steps
│   ├── common.steps.ts
│   ├── deposits.steps.ts
│   └── ...
├── pages/                  # Page Objects
│   ├── LoginPage.ts
│   └── DashboardPage.ts
├── helpers/                # Helpers
│   ├── auth.helper.ts
│   ├── database.helper.ts
│   └── api.helper.ts
└── config/                 # Configuração
    └── test.config.ts
```

---

## ✅ Checklist Antes de Rodar Testes

- [ ] Node.js instalado (v18+)
- [ ] Dependências instaladas (`npm install`)
- [ ] Browsers do Playwright instalados
- [ ] `.env.local` configurado
- [ ] Banco de teste limpo
- [ ] Servidor de desenvolvimento rodando (se necessário)

---

## 🔗 Links Úteis

- [Documentação Playwright](https://playwright.dev/)
- [Documentação Cucumber](https://cucumber.io/docs/cucumber/)
- [Guia de Seletores](https://playwright.dev/docs/selectors)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

## 💡 Dicas Finais

1. **Sempre limpe dados de teste** após execução
2. **Use Page Objects** para reutilizar código
3. **Evite sleeps/waits fixos** - use `waitForSelector`
4. **Rode testes em modo headless no CI**
5. **Mantenha testes independentes** - cada teste deve poder rodar sozinho
6. **Use data-testid** para seletores estáveis
7. **Documente casos de teste complexos**
8. **Revise falhas no relatório HTML**

---

**Boa sorte com os testes! 🚀**