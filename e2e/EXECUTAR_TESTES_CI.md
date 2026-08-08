# 🚀 Executar Testes em CI/CD (GitHub Actions)

Este documento explica como os testes E2E são executados automaticamente no GitHub Actions.

> ℹ️ **Revisão de 2026-08:** o workflow tinha dois bugs que o deixavam efetivamente quebrado — path de relatório errado (`playwright-report/` em vez de `e2e/reports/playwright-report/`, conforme `playwright.config.ts`) e um job de matriz `chromium/firefox/webkit` usando `--project=<browser>`, quando `playwright.config.ts` nunca definiu projetos por navegador (só por tag, todos em Desktop Chrome). Ambos foram corrigidos — ver `.github/workflows/e2e-tests.yml`. O workflow agora também roda a suíte BDD (`npm run test:bdd`), que antes nunca era executada em CI.

---

## 📋 Workflows Configurados

### 1. **e2e-tests.yml** - Testes Principais

**Localização:** `.github/workflows/e2e-tests.yml`

**Gatilhos:**
- ✅ Push para `main` ou `develop`
- ✅ Pull Request para `main` ou `develop`
- ✅ Execução manual via UI do GitHub

**Jobs:**

#### Job 1: `test` (Sempre executa)
- Roda `npm run test:e2e` (Playwright, Chromium) e `npm run test:bdd` (Cucumber/BDD)
- Timeout: 60 minutos
- Gera relatório HTML em `e2e/reports/playwright-report/`
- Faz upload de screenshots de falhas
- Comenta resultado no PR automaticamente

#### Job 2: `test-tagged-projects` (Apenas em push para main)
- Roda os projetos por tag do Playwright (`smoke`, `security`, `permissions`, `performance`, `api-tests`, `regression`), todos em Chromium — cobertura adicional em cima do job `test` principal
- Timeout: 60 minutos
- Não roda em Firefox/WebKit — não existem projetos configurados para esses navegadores em `playwright.config.ts` (era o bug do job antigo `test-all-browsers`)

---

## 🔧 Configuração de Secrets

Para que os testes funcionem no GitHub Actions, você precisa configurar os seguintes **secrets**:

### Passo a Passo

1. Acesse o repositório no GitHub
2. Vá em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**
4. Adicione os seguintes secrets:

| Nome do Secret | Descrição | Onde encontrar |
|----------------|-----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (admin) | Supabase Dashboard → Settings → API |

**⚠️ IMPORTANTE:**
- Use as credenciais de um **ambiente de teste** dedicado
- **NUNCA** use credenciais de produção no CI/CD
- As chaves são secretas e não aparecerão nos logs

---

## 📊 Visualizar Resultados

### No GitHub Actions UI

1. Acesse o repositório no GitHub
2. Vá na aba **Actions**
3. Clique no workflow **E2E Tests**
4. Selecione uma execução específica
5. Veja o status de cada job

### Baixar Relatórios

Se os testes falharem, você pode baixar:

1. **Relatório HTML completo** (playwright-report)
   - Contém detalhes de todos os testes
   - Screenshots de cada passo
   - Logs de console e network

2. **Screenshots de falhas** (test-screenshots)
   - Apenas screenshots dos testes que falharam
   - Útil para debug rápido

**Como baixar:**
1. Na página da execução do workflow
2. Role até a seção **Artifacts**
3. Clique no artefato desejado para baixar

---

## 🧪 Executar Manualmente

Você pode disparar os testes manualmente sem fazer commit:

1. Acesse **Actions** no repositório
2. Selecione o workflow **E2E Tests**
3. Clique em **Run workflow**
4. Escolha a branch
5. Clique em **Run workflow**

---

## 📝 Comentários Automáticos em PRs

Quando você abre um Pull Request, o workflow:

1. Executa todos os testes automaticamente
2. Gera um comentário no PR com o resultado:
   - ✅ Se todos passaram
   - ❌ Se algum falhou (com link para detalhes)

**Exemplo de comentário:**

```
## 🧪 Resultado dos Testes E2E

✅ Testes executados com sucesso!

📊 Ver relatório completo
```

---

## 🔍 Estrutura do Workflow

### Etapas Executadas

```yaml
1. Checkout código
   ↓
2. Setup Node.js 18
   ↓
3. Instalar dependências (npm ci)
   ↓
4. Instalar browsers do Playwright
   ↓
5. Build da aplicação (npm run build)
   ↓
6. Rodar testes E2E (npm run test:e2e)
   ↓
7. Upload de artefatos (relatórios e screenshots)
   ↓
8. Comentar resultado no PR (se aplicável)
```

### Tempo Médio de Execução

- **Job test (Chromium):** ~10-15 minutos
- **Job test-all-browsers (3 navegadores):** ~25-35 minutos

---

## 🚨 Debugging de Falhas

### Passo 1: Verificar Logs

1. Acesse a execução falhada no GitHub Actions
2. Clique no job que falhou
3. Expanda o step "Rodar testes E2E"
4. Analise os logs de erro

### Passo 2: Baixar Relatório HTML

1. Baixe o artefato `playwright-report`
2. Extraia o arquivo ZIP
3. Abra `index.html` no navegador
4. Navegue pelos testes falhados
5. Veja screenshots e traces

### Passo 3: Reproduzir Localmente

```bash
# Usar as mesmas variáveis de ambiente do CI (.env.local funciona também)
export NEXT_PUBLIC_SUPABASE_URL="sua-url-de-teste"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-de-teste"
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-service-role"

# Feature Gherkin (Cucumber, não Playwright):
npx cucumber-js --config e2e/cucumber.config.cjs e2e/features/10-caucoes.feature

# Spec Playwright específico:
npx playwright test e2e/tests/smoke/critical-flows.spec.ts

# Ou rodar em modo debug
npm run test:e2e:debug
```

---

## 📈 Métricas e Status

### Status Badge

Adicione ao README.md para mostrar o status dos testes:

```markdown
[![E2E Tests](https://github.com/SEU-USUARIO/SEU-REPO/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/SEU-USUARIO/SEU-REPO/actions/workflows/e2e-tests.yml)
```

---

## 🔄 Otimizações

### Cache de Dependências

O workflow usa cache automático do npm (`cache: 'npm'`) para acelerar instalações.

### Paralelização

O job `test-all-browsers` roda em paralelo usando matriz do GitHub Actions.

### Artefatos com Retenção

Relatórios são mantidos por 30 dias para análise histórica.

---

## 🛠️ Personalização

### Alterar Browsers Testados

Edite a matriz em `.github/workflows/e2e-tests.yml`:

```yaml
strategy:
  matrix:
    browser: [chromium, firefox]  # Removeu webkit
```

### Alterar Timeout

```yaml
jobs:
  test:
    timeout-minutes: 30  # Reduzido de 60 para 30
```

### Executar Apenas em Main

```yaml
on:
  push:
    branches: [ main ]  # Removeu develop
```

---

## 📞 Troubleshooting

### Problema: "Secret not found"

**Solução:** Verifique se os secrets estão configurados corretamente em Settings → Secrets

### Problema: "Browser executable not found"

**Solução:** O workflow já instala browsers automaticamente. Se falhar, tente:
```yaml
- name: Instalar browsers
  run: npx playwright install --with-deps
```

### Problema: Testes passam localmente mas falham no CI

**Causas comuns:**
1. Diferenças de timezone (força UTC no CI)
2. Dados de teste não limpos
3. Race conditions

**Solução:** Use waits estáveis e limpe dados antes dos testes.

---

## 📚 Links Úteis

- [Documentação GitHub Actions](https://docs.github.com/en/actions)
- [Playwright CI/CD Guide](https://playwright.dev/docs/ci)
- [Debugging in CI](https://playwright.dev/docs/ci#debugging-on-ci)

---

**Boa sorte com os testes automatizados! 🚀**