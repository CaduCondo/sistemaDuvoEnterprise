# 🚀 GUIA RÁPIDO - Rodar Testes no VSCode

## 📋 PASSO A PASSO (copie e cole cada comando)

### 1️⃣ Sincronizar seu repositório local com o GitHub/Softgen

Abra o terminal do VSCode (Ctrl + ') e cole estes 3 comandos:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

✅ **O que isso faz?** Baixa todas as alterações do Softgen e descarta qualquer mudança local

---

### 2️⃣ Configurar as chaves do Supabase (APENAS 1 VEZ)

Cole este comando no terminal:

```bash
npm run setup:env
```

O assistente vai te pedir 3 informações:

**🔑 Onde encontrar suas chaves:**
1. Acesse: https://supabase.com/dashboard
2. Clique no seu projeto
3. Vá em **Settings** → **API**
4. Copie e cole quando o assistente pedir:
   - **Project URL** (ex: https://xyz.supabase.co)
   - **anon key** (começa com eyJ...)
   - **service_role key** (começa com eyJ...)

✅ **Pronto!** O arquivo `.env.local` foi criado automaticamente

---

### 3️⃣ Instalar dependências (APENAS 1 VEZ)

```bash
npm install
```

---

### 4️⃣ Rodar os testes!

Escolha um destes comandos:

#### 🎯 Todos os testes (recomendado para começar)
```bash
npm run test:e2e
```

#### 🖥️ Interface visual (mais fácil de usar)
```bash
npm run test:e2e:ui
```

#### 🐛 Modo debug (para investigar problemas)
```bash
npm run test:e2e:debug
```

#### 👀 Ver navegador rodando (headed mode)
```bash
npm run test:e2e:headed
```

---

## 📊 Ver Relatórios de Testes

Depois de rodar os testes, veja o relatório:

```bash
npx playwright show-report
```

Abre no navegador com prints, vídeos e detalhes de cada teste!

---

## 🔄 Workflow Diário

**Toda vez que o Softgen fizer alterações:**

```bash
# 1. Sincronizar
git fetch origin && git reset --hard origin/main && git clean -fd

# 2. Instalar novas dependências (se houver)
npm install

# 3. Rodar testes
npm run test:e2e:ui
```

---

## 🆘 Problemas Comuns

### ❌ "NEXT_PUBLIC_SUPABASE_URL é obrigatória"
**Solução:** Rode novamente `npm run setup:env` e cole as chaves corretas

### ❌ "Cannot find module"
**Solução:** Rode `npm install` novamente

### ❌ Testes falhando
**Solução:** 
1. Verifique se o servidor está rodando: `npm run dev`
2. Acesse http://localhost:3000 no navegador
3. Se carregar, os testes devem funcionar

---

## 🎯 Atalho Útil (opcional)

Adicione isto ao seu terminal para ter um comando rápido:

**No Windows (PowerShell):**
Crie/edite o arquivo `$PROFILE` e adicione:
```powershell
function Sync-Softgen {
    git fetch origin
    git reset --hard origin/main
    git clean -fd
    Write-Host "✅ Sincronizado com Softgen!" -ForegroundColor Green
}
Set-Alias sync Sync-Softgen
```

**No Mac/Linux (Bash/Zsh):**
Adicione no `~/.bashrc` ou `~/.zshrc`:
```bash
alias sync="git fetch origin && git reset --hard origin/main && git clean -fd && echo '✅ Sincronizado!'"
```

Depois basta digitar:
```bash
sync
```

---

## 📞 Precisa de Ajuda?

Se tiver dúvidas, pergunte ao Softgen! Ele pode:
- Ver os logs dos testes que falharam
- Ajustar configurações
- Criar novos testes
- Corrigir bugs encontrados nos testes
- teste