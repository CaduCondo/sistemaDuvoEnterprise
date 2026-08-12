# 🚀 Guia rápido — configurar o ambiente local e rodar os testes

## 1️⃣ Sincronizar seu repositório local com o GitHub

Abra o terminal do VS Code (Ctrl + `) e cole:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

✅ **O que isso faz?** Baixa a versão mais recente do GitHub e descarta qualquer mudança local não commitada.

⚠️ Só rode isso se não tiver nenhuma alteração local que queira manter — `git clean -fd` apaga arquivos não commitados.

---

## 2️⃣ Configurar as chaves do Supabase (só na primeira vez)

```bash
npm run setup:env
```

**🔑 Onde encontrar suas chaves:**
1. Acesse https://supabase.com/dashboard
2. Clique no projeto de **desenvolvimento** (nunca no de produção, para não misturar dados)
3. Vá em **Settings → API**
4. Copie e cole quando o assistente pedir: **Project URL**, **anon key**, **service_role key**

✅ O arquivo `.env.local` é criado automaticamente (nunca é commitado no Git).

---

## 3️⃣ Instalar dependências (só na primeira vez, ou quando o `package.json` mudar)

```bash
npm install
```

---

## 4️⃣ Rodar o sistema localmente

```bash
npm run dev
```

Acesse http://localhost:3000 no navegador.

---

## 5️⃣ Rodar os testes automatizados

```bash
npm run test:e2e          # todos os testes
npm run test:e2e:ui       # interface visual (mais fácil de acompanhar)
npm run test:e2e:debug    # modo debug, passo a passo
npm run test:e2e:headed   # roda com o navegador visível
```

Depois de rodar, ver o relatório:

```bash
npx playwright show-report
```

---

## 🆘 Problemas comuns

**"NEXT_PUBLIC_SUPABASE_URL é obrigatória"** → rode `npm run setup:env` de novo e confira se colou as chaves certas.

**"Cannot find module"** → rode `npm install` de novo.

**Testes falhando** → confirme que o servidor local está rodando (`npm run dev`) e que http://localhost:3000 carrega normalmente antes de rodar os testes.

---

## Precisa de ajuda?

Peça pro Claude (chat ou Claude Code) — ele pode ver os logs dos testes que falharam, ajustar configurações, criar novos testes e corrigir bugs encontrados.
