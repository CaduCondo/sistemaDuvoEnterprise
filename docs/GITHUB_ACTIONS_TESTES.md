# 🧪 Testes Automatizados via GitHub Actions

## 📋 Visão Geral

O projeto possui **2 workflows independentes** que rodam em paralelo:

| Workflow | Arquivo | Função | Quando Roda |
|----------|---------|--------|-------------|
| **Sync** | `sync-from-vercel.yml` | Sincronizar código do Vercel de volta pro GitHub (herança de quando se usava o Softgen; hoje provavelmente não encontra nada pra sincronizar — ver [SETUP_GITHUB_AUTO_SYNC.md](./SETUP_GITHUB_AUTO_SYNC.md)) | 1x/dia às 20h OU manual |
| **E2E Tests** | `e2e-tests.yml` | Rodar testes automatizados | Push/PR OU manual |

**✅ NÃO CONFLITAM** - Podem rodar ao mesmo tempo sem problemas!

---

## 🎯 Como Funciona

### **Workflow de Testes E2E**

```
Push/PR → GitHub Actions → Build → Testes → Relatório
```

**Triggers automáticos:**
- ✅ Push para `main` ou `develop`
- ✅ Pull Request
- ✅ Manual (workflow_dispatch)

**O que faz:**
1. ✅ Faz checkout do código
2. ✅ Instala Node.js 18
3. ✅ Instala dependências (npm ci)
4. ✅ Instala browsers do Playwright
5. ✅ Faz build da aplicação
6. ✅ Roda testes E2E (npm run test:e2e)
7. ✅ Upload de relatórios e screenshots
8. ✅ Comenta resultado no PR (se for PR)

---

## ⚙️ Configuração Inicial

### **Passo 1: Configurar Secrets no GitHub**

Os testes precisam de **3 secrets** do Supabase:

1. Vá para o repositório no GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Clique em **"New repository secret"**
4. Adicione os 3 secrets:

| Nome do Secret | Onde Encontrar | Exemplo |
|----------------|----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | `eyJhbGc...` |

**⚠️ IMPORTANTE:**
- Use os valores do seu projeto Supabase
- `service_role` key é SECRETA - nunca commite no código!
- Copie e cole exatamente como aparecem no Supabase

---

### **Passo 2: Verificar Workflow**

1. Vá em **Actions** no repositório
2. Você deve ver **"E2E Tests"** na lista
3. Se estiver desabilitado:
   - Clique em **"I understand my workflows, enable them"**

---

### **Passo 3: Testar Manualmente (Opcional)**

1. Vá em **Actions** → **E2E Tests**
2. Clique em **"Run workflow"**
3. Branch: `main`
4. Clique em **"Run workflow"**
5. Aguarde 5-10 minutos
6. ✅ Veja o resultado!

---

## 🚀 Uso Diário

### **Automático (Recomendado)**

**Sem você fazer nada:**

```
git push origin main  →  Testes rodam automaticamente ✅
```

**Ou em Pull Requests:**

```
Criar PR  →  Testes rodam automaticamente ✅
           →  Comentário com resultado aparece no PR
```

---

### **Manual (Quando Necessário)**

**Rodar testes AGORA sem fazer push:**

1. GitHub → **Actions**
2. **E2E Tests** → **Run workflow**
3. Escolha a branch
4. **Run workflow**
5. ✅ Aguarde resultado (5-10 min)

---

## 📊 Visualizando Resultados

### **Ver Relatório de Testes:**

1. GitHub → **Actions**
2. Clique no run desejado
3. Na seção **Artifacts**:
   - 📊 **playwright-report** - Relatório HTML completo
   - 📸 **test-screenshots** - Screenshots de falhas (se houver)

4. Baixe o artifact
5. Extraia e abra `index.html` no navegador

---

### **Status dos Testes:**

```
✅ Testes passaram     - Build verde
❌ Testes falharam     - Build vermelho
🟡 Testes pulados      - Build amarelo
```

---

## 🔍 Estrutura dos Testes

### **Jobs do Workflow:**

#### **1. Job Principal (test)**

- Roda em: **Todos os pushes/PRs**
- Browser: **Chromium** (mais rápido)
- Duração: ~5-10 minutos
- Upload: Relatórios + screenshots de falhas

#### **2. Job Secundário (test-all-browsers)**

- Roda em: **Apenas pushes no main**
- Browsers: **Chromium, Firefox, Safari (WebKit)**
- Duração: ~15-20 minutos
- Garante compatibilidade cross-browser

---

## 🐛 Resolução de Problemas

### **Erro: "Missing required secrets"**

**Causa:** Secrets do Supabase não configurados

**Solução:**
1. Settings → Secrets and variables → Actions
2. Adicionar os 3 secrets (ver Passo 1)

---

### **Erro: "Build failed"**

**Causa:** Erro de build da aplicação

**Solução:**
1. Teste build localmente: `npm run build`
2. Corrija erros de compilação
3. Commit e push novamente

---

### **Erro: "Tests failed"**

**Causa:** Testes falhando

**Solução:**
1. Baixe o artifact `playwright-report`
2. Abra `index.html` para ver detalhes
3. Veja screenshots das falhas
4. Corrija os testes ou o código
5. Push novamente

---

### **Erro: "Timeout after 60 minutes"**

**Causa:** Testes demorando demais

**Solução:**
1. Otimize testes lentos
2. Ou aumente timeout no workflow:
   ```yaml
   timeout-minutes: 90  # Aumentar de 60 para 90
   ```

---

## 📝 Adicionando Novos Testes

### **Criar novo teste:**

```bash
# Criar arquivo de teste
e2e/tests/meu-novo-teste.spec.ts
```

**Teste será rodado automaticamente no próximo push!**

---

### **Testar localmente primeiro:**

```bash
# Rodar todos os testes
npm run test:e2e

# Rodar teste específico
npx playwright test meu-novo-teste.spec.ts

# Modo UI (interativo)
npx playwright test --ui
```

---

## 🎯 Boas Práticas

### **✅ DO (Faça):**

- ✅ Rode testes localmente antes de push
- ✅ Mantenha testes rápidos (< 30 seg cada)
- ✅ Use `data-testid` para seletores estáveis
- ✅ Teste fluxos críticos do sistema
- ✅ Adicione screenshots em falhas

### **❌ DON'T (Não Faça):**

- ❌ Commitar testes quebrados
- ❌ Ignorar testes falhando
- ❌ Usar seletores frágeis (ex: nth-child)
- ❌ Testes muito lentos (> 2 min)
- ❌ Dados hardcoded (use fixtures)

---

## 📊 Métricas de Testes

### **Cobertura Atual:**

- ✅ Autenticação (login, logout, senha)
- ✅ CRUD de Propriedades
- ✅ CRUD de Inquilinos
- ✅ CRUD de Locações
- ✅ Pagamentos
- ✅ Dashboard
- ✅ Permissões

### **Objetivo:**

- 🎯 **80%** de cobertura dos fluxos principais
- 🎯 **100%** de fluxos críticos (auth, pagamentos)
- 🎯 **< 15 min** tempo total de execução

---

## 🔄 Integração com Workflows

### **Ordem de Execução (Push para main):**

```
1. Push código → GitHub
2. Workflow Sync roda (se houver mudanças) - 30 seg
3. Workflow Tests roda em paralelo - 5-10 min
4. Build bem-sucedido → Ambos verdes ✅
```

**Ambos INDEPENDENTES - não conflitam!**

---

## 🎉 Próximos Passos

1. ✅ Configure os 3 secrets do Supabase
2. ✅ Teste workflow manualmente (Run workflow)
3. ✅ Faça um push para ver rodar automaticamente
4. ✅ Adicione badge de status no README (opcional)

### **Badge de Status (Opcional):**

Adicione no README.md:

```markdown
![E2E Tests](https://github.com/CaduCondo/sistemaDuvoEnterprise/workflows/E2E%20Tests/badge.svg)
```

---

## 📚 Documentação Adicional

- [Guia de Testes E2E](../e2e/README.md)
- [Comandos de Testes](../e2e/COMANDOS.md)
- [Setup Local](../e2e/SETUP_SIMPLES.md)
- [Playwright Docs](https://playwright.dev/)

---

**✅ Testes configurados e rodando automaticamente!** 🚀