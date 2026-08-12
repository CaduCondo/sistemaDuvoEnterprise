# 🔐 Sistema de Autenticação - Documentação Completa

Este documento detalha o sistema completo de autenticação e gestão de usuários.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Login via Dropdown](#login-via-dropdown)
- [Sistema de 3 Tentativas](#sistema-de-3-tentativas)
- [Senha Temporária](#senha-temporária)
- [Troca Obrigatória de Senha](#troca-obrigatória-de-senha)
- [Recuperação de Senha](#recuperação-de-senha)
- [Gestão de Usuários](#gestão-de-usuários)
- [Sistema de Tema](#sistema-de-tema)
- [Segurança](#segurança)

---

## 🎯 Visão Geral

### Características Principais

- ✅ **Login via Dropdown** - Autenticação no header público (sem página dedicada)
- ✅ **3 Tentativas** - Bloqueio automático após 3 tentativas falhas
- ✅ **Senha Temporária** - Geração automática com regras de segurança
- ✅ **Troca Obrigatória** - Primeiro login força criação de nova senha
- ✅ **Recuperação** - Sistema de "Esqueci minha senha" com email
- ✅ **Tema Persistido** - Tema salvo por usuário no banco de dados
- ✅ **Validação em Tempo Real** - Feedback visual durante troca de senha

### Tecnologias

- **Backend:** Autenticação própria contra a tabela `system_users` no PostgreSQL
  (Supabase) — **não usa o Supabase Auth**. Ver `src/services/authService.ts`
  ("Local authentication service — uses ONLY system_users table, NO Supabase
  Auth integration").
- **Frontend:** React + TypeScript
- **Email:** Resend (produção) / Console (desenvolvimento)
- **Sessão:** objeto salvo em `localStorage` (`auth_session`/`auth_user`), com
  expiração de 24h verificada no cliente — não é um JWT assinado pelo servidor.
- **Armazenamento:** Database + localStorage (cache)

> ⚠️ **Atenção (débito técnico de segurança):** hoje `validatePassword()` em
> `authService.ts` faz comparação **direta de string** (`input === stored`),
> não hash bcrypt — apesar de `bcryptjs` estar entre as dependências do
> projeto. O comentário no código está marcado como `TEMPORARY`. Isso significa
> que a coluna `system_users.password_hash` armazena a senha em texto puro
> hoje. Recomenda-se migrar para hash bcrypt antes de qualquer uso em produção
> com dados reais.

---

## 🔑 Login via Dropdown

### Localização

**Componente:** `src/components/public/PublicHeader.tsx`

**Página:** Página inicial / Anúncios (`/`)

### Interface

```
┌──────────────────────────────────────────────┐
│  [Building Icon] D'Uvo Enterprise Corporation│
│                                  [Gerenciador]│
└──────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌────────────────────────────┐
                    │ D'Uvo Enterprise           │
                    │ Property Control System    │
                    ├────────────────────────────┤
                    │ Usuário ou Email           │
                    │ [___________________]      │
                    │                            │
                    │ Senha          [👁]        │
                    │ [___________________]      │
                    │                            │
                    │         [Esqueci minha senha]│
                    │                            │
                    │      [   Entrar   ]        │
                    │                            │
                    │ Desenvolvido por Carlos Uva│
                    └────────────────────────────┘
```

### Campos

1. **E-mail** (rótulo real do campo: "E-mail:")
   - O backend aceita busca por `username` OU `email` (ver `authService.ts`),
     mas o campo do formulário tem `type="email"`
   - Obrigatório (validação HTML5 nativa)
   - Placeholder: "email@exemplo.com"

2. **Senha**
   - Campo password
   - Toggle para mostrar/ocultar
   - Obrigatório
   - Placeholder: "Digite sua senha"

### Comportamento

**Ao clicar "Entrar":**

1. Validação de campos preenchidos
2. Limpa sessões antigas do localStorage
3. Chama `login()` do authService
4. Verifica bloqueio e tentativas
5. Valida credenciais
6. Verifica `requires_password_change`
7. Redireciona para destino apropriado

---

## 🚨 Sistema de 3 Tentativas

### Regras

| Tentativa | Mensagem | Ação |
|-----------|----------|------|
| 1ª falha | "Senha incorreta. Você tem mais 2 tentativas." | Incrementa contador |
| 2ª falha | "Senha incorreta. Você tem mais 1 tentativa." | Incrementa contador |
| 3ª falha | "Conta bloqueada temporariamente..." | Bloqueia por 30 min |

### Campos no Banco de Dados

```sql
-- Tabela: system_users

login_attempts INTEGER DEFAULT 0
  -- Contador de tentativas falhas consecutivas

blocked_until TIMESTAMP WITH TIME ZONE
  -- Data/hora até quando está bloqueado
  -- NULL = não bloqueado
```

### Lógica de Bloqueio

```typescript
// Verificar bloqueio antes de validar senha
if (user.blocked_until) {
  const blockedDate = new Date(user.blocked_until);
  const now = new Date();
  
  if (blockedDate > now) {
    const minutesLeft = Math.ceil((blockedDate.getTime() - now.getTime()) / 60000);
    throw new Error(
      `Conta bloqueada. Tente novamente em ${minutesLeft} minutos.`
    );
  }
}

// Validar senha
const isValid = validatePassword(password, user.password_hash);

if (!isValid) {
  // Incrementar tentativas
  const newAttempts = (user.login_attempts || 0) + 1;
  
  if (newAttempts >= 3) {
    // Bloquear por 30 minutos
    const blockUntil = new Date(Date.now() + 30 * 60000);
    await updateUser(user.id, {
      login_attempts: newAttempts,
      blocked_until: blockUntil.toISOString()
    });
    throw new Error("Conta bloqueada por 30 minutos");
  } else {
    // Apenas incrementar
    await updateUser(user.id, {
      login_attempts: newAttempts
    });
    const remaining = 3 - newAttempts;
    throw new Error(`Senha incorreta. ${remaining} tentativa(s) restante(s)`);
  }
}

// Senha correta - resetar tentativas
await updateUser(user.id, {
  login_attempts: 0,
  blocked_until: null
});
```

### Reset de Tentativas

**Tentativas são resetadas em:**

1. ✅ Login bem-sucedido
2. ✅ Reset de senha (admin)
3. ✅ Recuperação de senha (esqueci senha)
4. ✅ Expiração do bloqueio (após 30 minutos)

---

## 🔐 Senha Temporária

### Características

**Especificações da senha temporária:**

- ✅ 12 caracteres
- ✅ Pelo menos 1 letra maiúscula
- ✅ Pelo menos 1 letra minúscula
- ✅ Pelo menos 1 número
- ✅ Caracteres embaralhados aleatoriamente

**Exemplo:** `Ab3kT9mN2pQ1`

### Algoritmo de Geração

```typescript
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;
  
  let password = '';
  
  // Garantir pelo menos 1 de cada
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // Completar até 12 caracteres
  for (let i = 3; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
```

### Quando é Gerada

1. **Criação de usuário** (por admin)
2. **Reset de senha** (por admin)
3. **Recuperação de senha** (pelo próprio usuário)

### Marcadores no Banco

```sql
-- Tabela: system_users

requires_password_change BOOLEAN DEFAULT false
  -- Se true, força troca de senha no próximo login

temporary_password BOOLEAN DEFAULT false
  -- Se true, indica que senha atual é temporária
```

---

## 🔄 Troca Obrigatória de Senha

### Fluxo Completo

```
1. Usuário faz login com senha temporária
   ↓
2. Sistema detecta requires_password_change = true
   ↓
3. Dropdown exibe PasswordChangeDialog
   (ao invés de redirecionar para dashboard)
   ↓
4. Usuário cria nova senha com validação em tempo real
   ↓
5. Sistema valida e salva nova senha
   ↓
6. Marca requires_password_change = false
   ↓
7. Redireciona para Painel de Gestão
```

### Interface de Troca de Senha

**Componente:** `src/components/PasswordChangeDialog.tsx`

**Layout:**

```
┌────────────────────────────────────────────┐
│ Criar Nova Senha                           │
├────────────────────────────────────────────┤
│ Sua senha temporária expirou.              │
│ Crie uma nova senha segura.                │
│                                            │
│ Nova Senha                        [👁]     │
│ [_______________________________]          │
│                                            │
│ Requisitos:                                │
│ ✅ Pelo menos 1 letra maiúscula            │
│ ✅ Pelo menos 1 letra minúscula            │
│ ✅ Pelo menos 1 número                     │
│ ✅ No mínimo 6 caracteres                  │
│ ✅ No máximo 12 caracteres                 │
│                                            │
│ Confirmar Nova Senha              [👁]     │
│ [_______________________________]          │
│                                            │
│ ✅ As senhas precisam ser idênticas        │
│                                            │
│            [  Salvar Senha  ]              │
│                                            │
│ Após salvar, você será redirecionado      │
│ para o painel                              │
└────────────────────────────────────────────┘
```

### Validação em Tempo Real

**Estado inicial (nenhum requisito atendido):**

```
❌ Pelo menos 1 letra maiúscula
❌ Pelo menos 1 letra minúscula
❌ Pelo menos 1 número
❌ No mínimo 6 caracteres
❌ No máximo 12 caracteres
❌ As senhas precisam ser idênticas
```

**Conforme usuário digita:**

- Cada requisito muda de ❌ (vermelho) para ✅ (verde) quando atendido
- Validação instantânea a cada tecla digitada
- Validação "Senhas idênticas" ativa quando usuário sai do segundo campo (onBlur)

**Botão "Salvar Senha":**

- Desabilitado enquanto houver qualquer ❌ vermelho
- Habilitado apenas quando todos os ✅ estiverem verdes

### Código de Validação

```typescript
interface PasswordRequirements {
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  minLength: boolean;
  maxLength: boolean;
  passwordsMatch: boolean;
}

function validatePassword(
  password: string,
  confirmPassword: string
): PasswordRequirements {
  return {
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    minLength: password.length >= 6,
    maxLength: password.length <= 12,
    passwordsMatch: password === confirmPassword && password.length > 0
  };
}
```

---

## 📧 Recuperação de Senha

### Acesso

**Link:** "Esqueci minha senha" no dropdown de login

### Interface

```
┌────────────────────────────────────────────┐
│ [Mail Icon] Recuperar Senha                │
│ Digite seu e-mail para receber uma         │
│ senha temporária                           │
├────────────────────────────────────────────┤
│ E-mail                                     │
│ [_______________________________]          │
│                                            │
│ ℹ️ Você receberá:                          │
│   • Link: www.duvoenterprise.com.br        │
│   • Senha temporária de 12 caracteres      │
│   • Será obrigado a criar nova senha       │
│     no login                               │
│                                            │
│  [← Voltar]      [  Enviar Email  ]       │
│                                            │
│ Desenvolvido por Carlos Uva                │
└────────────────────────────────────────────┘
```

### Processo

```typescript
async function forgotPassword(email: string) {
  // 1. Verificar se email existe
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("E-mail não encontrado");
  }
  
  // 2. Gerar senha temporária
  const tempPassword = generateTemporaryPassword();
  
  // 3. Atualizar banco de dados
  await updateUser(user.id, {
    password_hash: tempPassword,
    requires_password_change: true,
    temporary_password: true,
    login_attempts: 0,
    blocked_until: null
  });
  
  // 4. Enviar email
  await sendRecoveryEmail({
    to: user.email,
    name: user.name,
    temporaryPassword: tempPassword
  });
  
  // 5. Retornar sucesso
  return { success: true };
}
```

### Template de Email

**Assunto:** Recuperação de Senha - D'Uvo Enterprise

**Corpo:**

```
Olá {NOME},

Você solicitou a recuperação de senha do sistema D'Uvo Enterprise.

Acesse: www.duvoenterprise.com.br
Sua nova senha temporária é: {SENHA_TEMPORARIA}

IMPORTANTE: Por segurança, você será obrigado a criar uma nova senha 
no primeiro acesso.

Requisitos da nova senha:
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número
- Entre 6 e 12 caracteres

Se você não solicitou esta recuperação, entre em contato com o 
administrador imediatamente.

Atenciosamente,
Equipe D'Uvo Enterprise
```

---

## 👥 Gestão de Usuários

### Tabela de Usuários

**Página:** Configurações → Aba Usuários

**Colunas:**

| Coluna | Descrição |
|--------|-----------|
| Nome | Nome completo do usuário |
| E-mail | Email de acesso |
| Perfil | Badge com o perfil (Admin/Corretor/Financeiro) |
| Status | Badge com bolinha colorida |
| Ações | Ícones: Resetar Senha 🔑, Excluir 🗑️ |

**Status exibidos:**

```
🔒 Bloqueado Temporariamente (Vermelho)
   └─ Mostra tempo restante: "Desbloqueio em X min"

🚫 Inativo (Cinza)
   └─ Desativado pelo administrador

✅ Ativo (Verde)
   └─ Usuário ativo e funcional
```

### Criar Usuário

**Botão:** "Adicionar Usuário" (canto superior direito)

**Dialog:**

```
┌────────────────────────────────────────────┐
│ Novo Usuário                               │
├────────────────────────────────────────────┤
│ Preencha os dados do novo usuário.         │
│ E-mail/Usuário deve ser únicos.            │
│                                            │
│ Nome Completo *                            │
│ [_______________________________]          │
│                                            │
│ E-mail / Usuário *                         │
│ [_______________________________]          │
│ ⚠️ E-mail inválido. Deve conter @          │
│                                            │
│ Telefone                                   │
│ [_______________________________]          │
│ ⚠️ Telefone inválido. Use (XX) XXXXX-XXXX │
│                                            │
│ Perfil *                                   │
│ [Selecione um perfil ▼]                   │
│                                            │
│ Status                                     │
│ [🟢 Ativado ▼]                             │
│                                            │
│  [Cancelar]      [  Criar Usuário  ]      │
└────────────────────────────────────────────┘
```

**Validações:**

1. **Nome Completo:**
   - Obrigatório
   - Mínimo 3 caracteres

2. **E-mail / Usuário:**
   - Obrigatório
   - Deve conter @
   - Deve ser único no sistema
   - Validação em tempo real
   - Mensagem de erro se inválido ou duplicado

3. **Telefone:**
   - Opcional
   - Máscara automática: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
   - Aceita apenas números
   - Validação: 10 ou 11 dígitos
   - Mensagem de erro se inválido

4. **Perfil:**
   - Obrigatório
   - Opções: Administrador, Corretor, Financeiro

5. **Status:**
   - Padrão: 🟢 Ativado
   - Opções: 🟢 Ativado, 🔴 Desativado

**Processo de criação:**

```typescript
async function createUser(data: UserFormData) {
  // 1. Validar dados
  validateUserData(data);
  
  // 2. Verificar unicidade de email
  const exists = await checkEmailExists(data.email);
  if (exists) {
    throw new Error("O E-mail/Usuário já existe no sistema");
  }
  
  // 3. Gerar senha temporária
  const tempPassword = generateTemporaryPassword();
  
  // 4. Criar usuário no banco
  const user = await insertUser({
    ...data,
    password_hash: tempPassword,
    requires_password_change: true,
    temporary_password: true
  });
  
  // 5. Enviar email de boas-vindas
  await sendWelcomeEmail({
    to: user.email,
    name: user.name,
    temporaryPassword: tempPassword
  });
  
  // 6. Exibir toast de sucesso
  toast({
    title: "Usuário criado!",
    description: "Email com senha temporária enviado com sucesso."
  });
  
  return user;
}
```

### Editar Usuário

**Ação:** Clicar na linha da tabela

**Dialog:** Similar ao de criação, mas:
- Título: "Editar Usuário"
- Campos preenchidos com dados atuais
- Botão: "Salvar Alterações"
- Campo senha não aparece (use Resetar Senha para isso)

### Resetar Senha

**Ação:** Clicar no ícone 🔑 na tabela

**Confirmação:** Não (executa diretamente)

**Processo:**

```typescript
async function resetUserPassword(userId: string) {
  // 1. Buscar dados do usuário
  const user = await getUserById(userId);
  
  // 2. Gerar senha temporária
  const tempPassword = generateTemporaryPassword();
  
  // 3. Atualizar banco de dados
  await updateUser(userId, {
    password_hash: tempPassword,
    requires_password_change: true,
    temporary_password: true,
    login_attempts: 0,
    blocked_until: null
  });
  
  // 4. Enviar email de reset
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    temporaryPassword: tempPassword
  });
  
  // 5. Exibir toast
  toast({
    title: "Senha resetada!",
    description: `Email enviado para ${user.email}`
  });
}
```

**Email de reset:**

```
Olá {NOME},

Sua senha foi resetada por um administrador.

Acesse: www.duvoenterprise.com.br
Sua nova senha temporária é: {SENHA_TEMPORARIA}

IMPORTANTE: Por segurança, você será obrigado a criar uma nova senha 
no primeiro acesso.

Requisitos da nova senha:
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número
- Entre 6 e 12 caracteres

Atenciosamente,
Equipe D'Uvo Enterprise
```

### Excluir Usuário

**Ação:** Clicar no ícone 🗑️ na tabela

**Confirmação:** Sim (dialog de confirmação)

**Dialog:**

```
┌────────────────────────────────────────────┐
│ Confirmar Exclusão                         │
├────────────────────────────────────────────┤
│ Tem certeza que deseja excluir o usuário   │
│ {NOME}?                                    │
│                                            │
│ Esta ação não pode ser desfeita.           │
│                                            │
│  [Cancelar]      [  Excluir  ]            │
└────────────────────────────────────────────┘
```

**Validações:**

- Apenas Admin pode excluir
- Não pode excluir usuário com permissões ativas
- Não pode excluir a si mesmo

---

## 🎨 Sistema de Tema

### Temas Disponíveis

- 🌞 **Light** - Tema claro
- 🌙 **Dark** - Tema escuro

### Armazenamento

**Banco de Dados:**
```sql
-- Tabela: system_users

theme TEXT
  -- 'light' ou 'dark'
  -- NULL = usa padrão do sistema (light)
```

**localStorage (cache):**
```typescript
localStorage.setItem('user-theme', 'dark');
```

### Fluxo de Carregamento

```
1. Página carrega
   ↓
2. Verifica localStorage (evita flash)
   ↓
3. Aplica tema do cache imediatamente
   ↓
4. Usuário faz login
   ↓
5. Carrega tema do banco de dados
   ↓
6. Se diferente do cache, atualiza
   ↓
7. Sincroniza localStorage com banco
```

### Troca de Tema

**Localização:** Menu do perfil (canto superior direito)

**Opções no menu:**

```
Se tema atual = Light:
  ┌────────────────────┐
  │ Editar Perfil      │
  │ Trocar Senha       │
  │ Trocar Tema (Dark) │ ← Mostra opção oposta
  │ Sair               │
  └────────────────────┘

Se tema atual = Dark:
  ┌────────────────────┐
  │ Editar Perfil      │
  │ Trocar Senha       │
  │ Trocar Tema (Light)│ ← Mostra opção oposta
  │ Sair               │
  └────────────────────┘
```

**Processo de troca:**

```typescript
async function toggleTheme(userId: string, currentTheme: string) {
  // 1. Determinar novo tema
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // 2. Atualizar banco de dados
  await updateUser(userId, { theme: newTheme });
  
  // 3. Atualizar localStorage
  localStorage.setItem('user-theme', newTheme);
  
  // 4. Aplicar na interface
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  
  // 5. Atualizar contexto
  setTheme(newTheme);
  
  return newTheme;
}
```

### Persistência Multi-Dispositivo

**Cenário:**

1. Usuário troca para Dark no Desktop
2. Tema é salvo no banco de dados
3. Faz login no Mobile
4. Sistema carrega Dark automaticamente
5. Mesma experiência em todos os dispositivos

---

## 🔒 Segurança

### Proteções Implementadas

1. **Bloqueio por Tentativas:**
   - 3 tentativas falhas = bloqueio de 30 minutos
   - Previne ataques de força bruta

2. **Senha Forte:**
   - Requisitos obrigatórios (maiúscula, minúscula, número)
   - Tamanho controlado (6-12 caracteres)

3. **Senha Temporária:**
   - Gerada aleatoriamente (alta entropia)
   - Forçada troca no primeiro uso

4. **Reset Seguro:**
   - Apenas via email do usuário
   - Invalida senha anterior imediatamente

5. **Armazenamento:**
   - ⚠️ Atualmente as senhas são comparadas em texto puro (ver aviso na seção
     "Tecnologias" acima) — a documentação anterior descrevia hashing, que
     ainda não está implementado no código atual
   - Sessão local em `localStorage`, com expiração de 24h verificada no cliente

### Vulnerabilidades Mitigadas

✅ **Força Bruta** - Bloqueio após 3 tentativas
✅ **Phishing** - Email apenas para endereço cadastrado
⚠️ **Session Hijacking** - sessão expira em 24h, mas não é um JWT assinado —
   é um objeto simples em `localStorage`
✅ **Password Reuse** - Senha temporária obriga troca
✅ **Weak Passwords** - Validação de requisitos
⚠️ **Senha em texto puro** - `password_hash` guarda a senha sem hash hoje
   (ver aviso acima); recomenda-se migrar para bcrypt

---

## 📱 Emails do Sistema

### Configuração Atual

**Desenvolvimento:** Console.log (simulação)
**Produção:** Resend API (recomendado)

### Configurar Resend

1. Criar conta em [resend.com](https://resend.com)
2. Obter API key
3. Adicionar em `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
4. Substituir console.log por chamadas à API

### Templates de Email

**1. Boas-vindas:**
```
Assunto: Bem-vindo ao D'Uvo Enterprise
Para: {EMAIL}

Olá {NOME},

Bem-vindo ao sistema D'Uvo Enterprise!

Acesse: www.duvoenterprise.com.br
Sua senha temporária é: {SENHA}

Por segurança, você será solicitado a criar uma nova senha no 
primeiro acesso.

Atenciosamente,
Equipe D'Uvo Enterprise
```

**2. Reset de Senha:**
```
Assunto: Senha Resetada - D'Uvo Enterprise
Para: {EMAIL}

Olá {NOME},

Sua senha foi resetada por um administrador.

Acesse: www.duvoenterprise.com.br
Sua nova senha temporária é: {SENHA}

IMPORTANTE: Você será obrigado a criar uma nova senha no próximo login.

Atenciosamente,
Equipe D'Uvo Enterprise
```

**3. Recuperação:**
```
Assunto: Recuperação de Senha - D'Uvo Enterprise
Para: {EMAIL}

Olá {NOME},

Você solicitou a recuperação de senha.

Acesse: www.duvoenterprise.com.br
Sua nova senha temporária é: {SENHA}

Se você não solicitou esta recuperação, entre em contato com o 
administrador imediatamente.

Atenciosamente,
Equipe D'Uvo Enterprise
```

---

## 🧪 Testes Recomendados

### Testes E2E (Playwright)

1. **Login bem-sucedido**
2. **Login com senha incorreta (3 tentativas)**
3. **Bloqueio após 3 tentativas**
4. **Recuperação de senha**
5. **Troca de senha obrigatória**
6. **Validação em tempo real**
7. **Troca de tema**
8. **Criação de usuário**
9. **Reset de senha por admin**
10. **Edição de usuário**

### Testes de API

1. **POST /api/auth/login** - Tentativas e bloqueio
2. **POST /api/auth/forgot-password** - Geração de senha
3. **POST /api/auth/change-password** - Validação
4. **POST /api/users** - Criação com validações
5. **PUT /api/users/:id** - Atualização
6. **POST /api/users/:id/reset-password** - Reset

---

**Documentos Relacionados:**
- [Regras de Negócio](REGRAS_DE_NEGOCIO.md)
- [Documentação de API](API_DOCUMENTATION.md)
- [Arquitetura do Sistema](ARCHITECTURE.md)