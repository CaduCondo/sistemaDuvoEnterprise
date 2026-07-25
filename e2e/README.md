# Testes E2E com Playwright

Esta pasta contém os testes automatizados end-to-end (E2E) do sistema de gerenciamento de imóveis.

## 📁 Estrutura de Testes

```
e2e/
├── example.spec.ts       # 5 testes básicos da página de login
├── login.spec.ts         # 13 testes completos de autenticação
├── properties.spec.ts    # 14 testes CRUD de imóveis
├── tenants.spec.ts       # 15 testes CRUD de inquilinos
├── rentals.spec.ts       # 14 testes de gestão de locações
├── payments.spec.ts      # 13 testes de gestão de pagamentos
├── dashboard.spec.ts     # 11 testes do dashboard
└── README.md            # Este arquivo
```

**Total: 85 cenários de teste**

## 🎯 Cobertura de Testes

### ✅ Login (18 testes - ATIVOS)
- Interface completa
- Preenchimento de campos
- Toggle de senha
- Modal de recuperação de senha
- Validações de email
- Mensagens de erro

### ⏭️ Properties (14 testes - REQUEREM AUTH)
- CRUD completo
- Alternância de visualizações
- Filtros (busca, localização, status)
- Validações de campos
- Máscaras e formatação

### ⏭️ Tenants (15 testes - REQUEREM AUTH)
- CRUD completo
- Validação CPF/CNPJ
- Máscaras (telefone, RG, CEP)
- Busca automática de CEP
- Filtros e busca

### ⏭️ Rentals (14 testes - REQUEREM AUTH)
- Criação de locação
- Gestão de caução
- Parcelamento de caução
- Garagem e corretor parceiro
- Filtros por status

### ⏭️ Payments (13 testes - REQUEREM AUTH)
- Filtros por mês/ano
- Visualizações diferentes
- Gestão de recibos
- Cancelamento de pagamentos
- Busca e filtros

### ⏭️ Dashboard (11 testes - REQUEREM AUTH)
- Cards de métricas
- Gráficos
- Seleção de período
- Navegação

## 🚀 Como Executar

### 1. Executar com Interface Visual (recomendado)
```bash
npm run test:e2e:ui
```
- Interface gráfica interativa
- Veja os testes em tempo real
- Debug visual fácil
- Time-travel através das etapas

### 2. Executar Todos os Testes (headless)
```bash
npm run test:e2e
```
- Execução rápida em background
- Gera relatório HTML
- Ideal para CI/CD

### 3. Executar com Navegador Visível
```bash
npm run test:e2e:headed
```
- Ver o navegador em ação
- Debug visual
- Mais lento que headless

### 4. Debug Mode (step-by-step)
```bash
npm run test:e2e:debug
```
- Pausa em cada passo
- Console de debug
- Inspecionar elementos

## 📝 Executar Testes Específicos

### Por arquivo:
```bash
npx playwright test login.spec.ts
npx playwright test properties.spec.ts
```

### Por nome do teste:
```bash
npx playwright test -g "deve validar email"
npx playwright test -g "deve criar imóvel"
```

### Por tag/grupo:
```bash
npx playwright test --grep @smoke
npx playwright test --grep @critical
```

## 🔐 Testes que Requerem Autenticação

A maioria dos testes está marcada com `.skip` porque requer autenticação:
- properties.spec.ts (14 testes)
- tenants.spec.ts (15 testes)
- rentals.spec.ts (14 testes)
- payments.spec.ts (13 testes)
- dashboard.spec.ts (11 testes)

### Para Ativar Estes Testes:

**Opção 1: Remover `.skip` manualmente**
```typescript
// Antes
test.describe.skip('Página de Imóveis (requer auth)', () => {

// Depois
test.describe('Página de Imóveis (requer auth)', () => {
```

**Opção 2: Criar helper de autenticação**
```typescript
// e2e/helpers/auth.ts
export async function loginHelper(page, username, password) {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-submit-button').click();
  await page.waitForURL('**/dashboard');
}

// Usar nos testes:
import { loginHelper } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await loginHelper(page, 'seu-usuario@exemplo.com', 'SuaSenha123');
  await page.goto('/properties');
});
```

## 📊 Relatórios

Após executar os testes, um relatório HTML é gerado automaticamente:

```bash
npx playwright show-report
```

O relatório mostra:
- ✅ Testes que passaram
- ❌ Testes que falharam
- ⏭️ Testes pulados
- 📸 Screenshots de falhas
- 🎬 Vídeos de execução (se configurado)
- 📋 Trace files para debug

## 🎬 Gravar Novos Testes

O Playwright tem um recurso incrível: **gerar testes automaticamente** enquanto você usa o app!

```bash
npx playwright codegen http://localhost:3000
```

Isso abre:
1. Um navegador para você usar o app normalmente
2. Uma janela com o código sendo gerado automaticamente
3. Copie e cole o código gerado nos arquivos de teste

## 🐛 Debugging

### Ver último teste que falhou:
```bash
npx playwright show-trace
```

### Pausar execução em breakpoints:
```typescript
test('meu teste', async ({ page }) => {
  await page.goto('/login');
  await page.pause(); // Pausa aqui
  await page.locator('#username').fill('teste');
});
```

### Inspecionar elementos:
```bash
npx playwright inspector
```

## 📋 Convenções de IDs

Todos os elementos interativos têm IDs no padrão:
```
{page}-{section}-{element}
```

Exemplos:
- `#login-submit-button`
- `#properties-new-button`
- `#tenant-name`
- `#rental-property`
- `#payment-filters-month`

## ✨ Melhores Práticas

1. **Use IDs em vez de classes ou XPath**
   ```typescript
   // ✅ Bom
   await page.locator('#login-submit-button').click();
   
   // ❌ Evite
   await page.locator('.btn.btn-primary').click();
   ```

2. **Aguarde elementos antes de interagir**
   ```typescript
   await expect(page.locator('#tenant-name')).toBeVisible();
   await page.locator('#tenant-name').fill('João');
   ```

3. **Use timeouts generosos para operações de rede**
   ```typescript
   await page.waitForTimeout(2000); // Aguardar API
   ```

4. **Limpe estado entre testes**
   ```typescript
   test.beforeEach(async ({ page }) => {
     // Resetar para estado inicial
   });
   ```

## 🔧 Configuração

Arquivo principal: `playwright.config.ts`

Principais configurações:
- **timeout**: 30 segundos por teste
- **expect timeout**: 5 segundos
- **navegadores**: Chromium (padrão), Firefox, Safari
- **viewport**: 1280x720
- **servidor local**: http://localhost:3000

## 📚 Recursos

- [Documentação Playwright](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Selectors Guide](https://playwright.dev/docs/selectors)

---

**Pronto para começar!** 🚀

Execute `npm run test:e2e:ui` e veja a mágica acontecer!

---

# Testes E2E com Playwright + Cucumber (Gherkin)

Sistema profissional de testes automatizados usando **Cucumber + Gherkin**, **Page Object Model**, e **testes de API/Database**.

## 🏗️ Arquitetura

```
e2e/
├── features/                      # Arquivos Gherkin (.feature)
│   ├── 1-autenticacao.feature
│   ├── 2-permissoes-admin.feature
│   ├── 3-permissoes-financeiro.feature
│   ├── 4-permissoes-gestao.feature
│   ├── 5-imoveis-crud.feature
│   ├── 6-inquilinos-crud.feature
│   ├── 7-locacoes-regras.feature
│   ├── 8-pagamentos-calculos.feature
│   └── 9-regressao-visual.feature
├── step-definitions/              # Implementação dos steps
│   ├── common.steps.ts
│   ├── login.steps.ts
│   └── ...
├── pages/                         # Page Object Model
├── helpers/                       # Helpers (Auth, API, DB)
├── config/                        # Configurações
└── reports/                       # Relatórios HTML/JSON
```

## 🎯 Cobertura de Testes Gherkin

### 📝 Features Implementadas:

1. **Autenticação** (7 cenários)
   - Login com diferentes perfis
   - Recuperação de senha
   - Logout

2. **Permissões Admin** (8 cenários)
   - Acesso a todos os menus
   - Gerenciar usuários
   - Editar permissões

3. **Permissões Financeiro** (7 cenários + 5 exemplos)
   - Acesso limitado (Dashboard + Financeiro)
   - Bloqueio de outras páginas

4. **Permissões Gestão** (6 cenários)
   - Acesso a operações
   - Bloqueio de Financeiro e Configurações

5. **Imóveis CRUD** (12 cenários)
   - Criar, editar, deletar
   - Filtros e validações
   - Alternância de visualização

6. **Inquilinos CRUD** (10 cenários)
   - CPF/CNPJ com máscaras
   - Busca de CEP
   - Validações

7. **Locações - Regras de Negócio** (8 cenários)
   - Caução e parcelamento
   - Geração automática de pagamentos
   - Encerramento antecipado

8. **Pagamentos - Cálculos** (10 cenários)
   - Cálculos de taxa
   - Recibos
   - Filtros

9. **Regressão Visual** (8 cenários)
   - Garantir que mudanças em uma página não afetam outras
   - Layout consistente
   - Responsividade

**Total: ~60 cenários em Gherkin**

## 🚀 Como Executar

### Executar testes Gherkin:
```bash
npm run test:cucumber
```

### Com navegador visível:
```bash
npm run test:cucumber:headed
```

### Gerar relatório HTML:
```bash
npm run test:cucumber:report
```

### Executar feature específica:
```bash
npx cucumber-js e2e/features/1-autenticacao.feature
```

### Executar cenário específico (por linha):
```bash
npx cucumber-js e2e/features/2-permissoes-admin.feature:15
```

## 📝 Exemplo de Gherkin

```gherkin
# language: pt
Funcionalidade: Autenticação de Usuários
  Como um usuário do sistema
  Quero fazer login com minhas credenciais
  Para acessar o sistema

  Cenário: Login com sucesso
    Dado que estou na página de login
    Quando preencho o campo "Usuário" com "admin@teste.com"
    E preencho o campo "Senha" com "Admin@123"
    E clico no botão "Entrar"
    Então devo ser redirecionado para "/dashboard"
```

## 🔧 Criar Novos Testes Gherkin

### 1. Criar arquivo .feature:
```gherkin
# e2e/features/minha-feature.feature
# language: pt
Funcionalidade: Minha Nova Funcionalidade
  
  Cenário: Meu cenário
    Dado que ...
    Quando ...
    Então ...
```

### 2. Implementar steps (se necessário):
```typescript
// e2e/step-definitions/minha-feature.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';

Given('que estou...', async function() {
  // implementação
});
```

### 3. Executar:
```bash
npm run test:cucumber
```

## 📊 Relatórios

Após executar, veja:
- `e2e/reports/cucumber-report.html` - Relatório visual
- `e2e/reports/cucumber-report.json` - Dados JSON

## ✨ Vantagens do Gherkin

1. ✅ **Linguagem natural** - Qualquer um pode ler
2. ✅ **Documentação viva** - Os testes SÃO a documentação
3. ✅ **Reutilização** - Steps são reutilizáveis entre cenários
4. ✅ **Colaboração** - PO, QA e Dev falam a mesma língua
5. ✅ **Manutenção** - Alterar comportamento = alterar o Gherkin

---

**Continua válido:**
- Testes Playwright antigos em `e2e/*.spec.ts`
- Execute com `npm run test:e2e`

**Novidade:**
- Testes Gherkin em `e2e/features/*.feature`
- Execute com `npm run test:cucumber`

## 📋 Testes Disponíveis

### ✅ Testes de Autenticação

#### Login via Dropdown (`tests/auth/login-dropdown.spec.ts`)
- ✅ Abrir dropdown de login no header público
- ✅ Preencher credenciais e fazer login
- ✅ Verificar redirecionamento para dashboard
- ✅ Verificar carregamento do tema do usuário
- ✅ Validar comportamento de mostrar/ocultar senha
- ✅ Testar link "Esqueci minha senha"

#### Sistema de 3 Tentativas (`tests/auth/three-attempts.spec.ts`)
- ✅ Primeira tentativa falha: "Você tem mais 2 tentativas"
- ✅ Segunda tentativa falha: "Você tem mais 1 tentativa"
- ✅ Terceira tentativa falha: Bloqueio por 30 minutos
- ✅ Verificar impossibilidade de login quando bloqueado
- ✅ Verificar reset de tentativas após login bem-sucedido

#### Recuperação de Senha (`tests/auth/password-recovery.spec.ts`)
- ✅ Abrir tela de recuperação no dropdown
- ✅ Preencher email e solicitar recuperação
- ✅ Verificar mensagem de sucesso
- ✅ Validar email inválido/não encontrado
- ✅ Verificar reset de bloqueio após recuperação

#### Troca Obrigatória de Senha (`tests/auth/password-change-required.spec.ts`)
- ✅ Detectar senha temporária no primeiro login
- ✅ Exibir tela de troca de senha no dropdown
- ✅ Validação em tempo real (maiúscula, minúscula, número, tamanho)
- ✅ Feedback visual (❌ vermelho → ✅ verde)
- ✅ Validar senhas idênticas (onBlur do segundo campo)
- ✅ Desabilitar botão quando requisitos não atendidos
- ✅ Salvar nova senha e redirecionar para dashboard

#### Sistema de Tema (`tests/auth/theme-switching.spec.ts`)
- ✅ Carregar tema do banco no login
- ✅ Mostrar opção de tema oposto no menu
- ✅ Trocar de light para dark
- ✅ Trocar de dark para light
- ✅ Persistir tema após logout e login
- ✅ Manter tema em diferentes dispositivos
- ✅ Aplicar tema imediatamente sem reload

### 👥 Testes de Gestão de Usuários

#### CRUD de Usuários (`tests/users/users-management.spec.ts`)
- ✅ Exibir tabela de usuários
- ✅ Abrir dialog de criação
- ✅ Validar email com @
- ✅ Aplicar máscara no telefone
- ✅ Validar telefone (10 ou 11 dígitos)
- ✅ Criar novo usuário com sucesso
- ✅ Impedir criação com email duplicado
- ✅ Abrir edição ao clicar na linha
- ✅ Resetar senha do usuário
- ✅ Excluir usuário com confirmação
- ✅ Alternar status Ativado/Desativado
- ✅ Exibir status correto na tabela

### 🔌 Testes de API

#### API de Autenticação (`tests/api/auth.api.spec.ts`)

**POST /api/auth/login**
- ✅ Login com credenciais válidas
- ✅ Erro com credenciais inválidas
- ✅ Incrementar tentativas após senha incorreta
- ✅ Bloquear após 3 tentativas
- ✅ Retornar erro quando conta bloqueada
- ✅ Resetar tentativas após login bem-sucedido
- ✅ Retornar requires_password_change para senha temporária

**POST /api/auth/forgot-password**
- ✅ Gerar senha temporária para email válido
- ✅ Erro para email não encontrado
- ✅ Resetar tentativas e bloqueio
- ✅ Marcar requires_password_change como true

**POST /api/auth/change-password**
- ✅ Aceitar senha válida
- ✅ Rejeitar senha sem maiúscula
- ✅ Rejeitar senha sem minúscula
- ✅ Rejeitar senha sem número
- ✅ Rejeitar senha com menos de 6 caracteres
- ✅ Rejeitar senha com mais de 12 caracteres
- ✅ Marcar requires_password_change como false

#### API de Usuários (`tests/api/users.api.spec.ts`)

**GET /api/users**
- ✅ Listar todos os usuários
- ✅ Retornar 401 sem autenticação

**POST /api/users**
- ✅ Criar usuário com dados válidos
- ✅ Rejeitar email duplicado
- ✅ Rejeitar email sem @
- ✅ Rejeitar telefone inválido
- ✅ Aceitar telefone fixo (10 dígitos)
- ✅ Aceitar telefone celular (11 dígitos)
- ✅ Criar usuário ativado por padrão

**PUT /api/users/:id**
- ✅ Atualizar dados do usuário
- ✅ Alterar status ativo/inativo
- ✅ Atualizar tema do usuário
- ✅ Rejeitar tema inválido

**POST /api/users/:id/reset-password**
- ✅ Resetar senha do usuário
- ✅ Marcar requires_password_change após reset
- ✅ Resetar tentativas de login

**DELETE /api/users/:id**
- ✅ Excluir usuário
- ✅ Retornar 404 ao buscar usuário excluído
- ✅ Retornar 403 sem permissão de admin