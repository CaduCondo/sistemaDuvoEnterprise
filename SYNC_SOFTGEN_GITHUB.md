# 🔄 Guia de Sincronização: Softgen → GitHub

## ⚡ NOVO: Sincronização Automática via GitHub Actions

**Agora você tem 2 opções:**

### 🤖 **Opção 1: AUTOMÁTICA (GitHub Actions) - RECOMENDADO**

✅ **Zero trabalho manual** - sincroniza 1x por dia automaticamente  
✅ **Ou sincronize com 1 clique** quando precisar  
✅ **Configuração inicial:** 5 minutos  

**[📚 Ver Guia de Configuração](./docs/SETUP_GITHUB_AUTO_SYNC.md)**

```
Você desenvolve → GitHub sincroniza sozinho 🚀
```

---

### 💻 **Opção 2: Manual (Script Local) - BACKUP**

⚡ 30 segundos por dia  
📦 Download ZIP + executar script  
🔧 Sem configuração necessária  

---

## 📋 Entendendo o Fluxo

### Como Funciona:

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   SOFTGEN   │ ──────> │ REPOSITÓRIO  │ ──────> │   GITHUB    │
│  (sandbox)  │  local  │    LOCAL     │  push   │  (remoto)   │
└─────────────┘         └──────────────┘         └─────────────┘
```

1. **Softgen** - Você faz alterações aqui (commits locais no sandbox)
2. **Repositório Local** - Clone do GitHub no seu computador
3. **GitHub** - Repositório remoto (código compartilhado)

---

## ⚡ Sincronização Rápida (Recomendado)

### Passo 1: Baixar do Softgen

1. No Softgen → **Settings** → **GitHub**
2. Clique em **"Download as ZIP"**
3. Salve o arquivo (ex: `sistemaDuvoEnterprise.zip`)

### Passo 2: Extrair e Substituir

```bash
# Navegue até a pasta do projeto
cd C:\Users\SeuUsuario\sistemaDuvoEnterprise

# Extraia o ZIP baixado sobre a pasta atual
# (Substituir todos os arquivos quando perguntado)
```

### Passo 3: Sincronizar com GitHub

**Windows:**
```cmd
# Execute o script de sincronização
scripts\sync-softgen-to-github.bat
```

**Linux/Mac:**
```bash
# Dê permissão de execução (primeira vez)
chmod +x scripts/sync-softgen-to-github.sh

# Execute o script
./scripts/sync-softgen-to-github.sh
```

### Pronto! ✅

O script vai:
- ✅ Adicionar todas as alterações
- ✅ Criar commit automaticamente
- ✅ Enviar para o GitHub
- ✅ Mostrar confirmação de sucesso

---

## 📅 Quando Sincronizar?

### Frequência Recomendada:

✅ **Diariamente** - Ao final do dia de trabalho
✅ **Após features importantes** - Quando completar uma funcionalidade
✅ **Antes de deploy** - Antes de publicar no Vercel
✅ **Semanalmente no mínimo** - Para não perder trabalho

### Sinais de que precisa sincronizar:

- ⚠️ Muitas alterações acumuladas no Softgen
- ⚠️ GitHub mostrando commits antigos
- ⚠️ Diferença grande entre Softgen e GitHub (como você notou)

---

## 🛠️ Sincronização Manual (Alternativa)

Se preferir fazer manualmente sem script:

```bash
# 1. Navegue até a pasta do projeto
cd C:\Users\SeuUsuario\sistemaDuvoEnterprise

# 2. Adicione todas as alterações
git add .

# 3. Crie um commit
git commit -m "feat: adicionar campos de inquilinos e corrigir dark mode"

# 4. Envie para o GitHub
git push origin main

# 5. Verifique se foi enviado
git log --oneline -5
```

---

## ❌ Resolvendo Problemas Comuns

### Problema 1: "Conflitos ao fazer push"

**Causa:** Alguém alterou o GitHub enquanto você trabalhava no Softgen

**Solução:**
```bash
# Baixe as alterações do GitHub
git pull origin main

# Resolva conflitos se houver (abra os arquivos marcados)
# Depois:
git add .
git commit -m "merge: resolver conflitos"
git push origin main
```

### Problema 2: "Autenticação falhou"

**Causa:** Token de acesso do GitHub expirado

**Solução:**
1. Vá em GitHub → Settings → Developer Settings → Personal Access Tokens
2. Gere um novo token com permissões de `repo`
3. Use o token como senha quando pedir autenticação

### Problema 3: "Muitos arquivos grandes"

**Causa:** Arquivos grandes ou node_modules sendo commitados

**Solução:**
```bash
# Verifique o .gitignore
cat .gitignore

# Remova node_modules se foi commitado por engano
git rm -r --cached node_modules
git commit -m "chore: remove node_modules"
```

---

## 📊 Verificando Sincronização

### Como saber se está sincronizado:

**No terminal:**
```bash
# Ver commits locais vs remotos
git log --oneline -10
git log origin/main --oneline -10

# Ver diferença entre local e remoto
git diff main origin/main
```

**No GitHub:**
1. Vá em: https://github.com/CaduCondo/sistemaDuvoEnterprise/commits/main
2. O commit mais recente deve ser o que você acabou de fazer
3. A data deve ser de hoje

---

## 🎯 Workflow Ideal (Dia a Dia)

### Desenvolvimento Diário:

```
MANHÃ:
1. Abrir Softgen
2. Fazer alterações e implementações
3. Testar no preview

TARDE:
4. Continuar desenvolvimento
5. Mais testes e refinamentos

NOITE (Antes de sair):
6. Download ZIP do Softgen
7. Extrair sobre repositório local
8. Rodar script: sync-softgen-to-github.bat
9. Verificar no GitHub que foi atualizado ✅
```

### A cada Feature Completa:

```
1. Completar implementação no Softgen
2. Testar tudo
3. Download ZIP
4. Sync com GitHub
5. Deploy no Vercel (via Publish)
```

---

## 🔐 Segurança e Backup

### Múltiplas Camadas de Proteção:

1. **Softgen** - Commits locais + Version History
2. **Repositório Local** - Clone Git no seu PC
3. **GitHub** - Backup remoto na nuvem
4. **Vercel** - Deploy de produção

**Recomendação:** Sincronize pelo menos 1x por dia para ter backup triplo!

---

## 📝 Convenção de Commits

Use mensagens claras nos commits:

```bash
# Bom ✅
git commit -m "feat: adicionar campos de profissão e renda mensal"
git commit -m "fix: corrigir visibilidade de tabelas em dark mode"
git commit -m "docs: atualizar documentação de inquilinos"

# Ruim ❌
git commit -m "alterações"
git commit -m "fix"
git commit -m "atualizações diversas"
```

**Prefixos recomendados:**
- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `style:` - Formatação, CSS
- `refactor:` - Refatoração de código
- `test:` - Testes
- `chore:` - Tarefas de manutenção

---

## ✅ Checklist de Sincronização

Antes de sincronizar, verifique:

- [ ] Todas as alterações testadas no Softgen
- [ ] Sem erros no check_for_errors
- [ ] Download ZIP completo (sem interrupções)
- [ ] Extraído na pasta correta do repositório
- [ ] Script executado sem erros
- [ ] Confirmação de push bem-sucedido
- [ ] Verificado no GitHub que apareceu

---

## 🆘 Suporte

Se tiver problemas:

1. **Verifique este guia** - A maioria dos problemas está documentada
2. **Git status** - Execute `git status` para ver o estado atual
3. **Git log** - Execute `git log --oneline -5` para ver commits recentes
4. **Contate suporte** - Se nada funcionar, peça ajuda

---

## 📌 Resumo Rápido

```bash
# ROTINA DIÁRIA (30 segundos):
1. Download ZIP do Softgen
2. Extrair sobre pasta local
3. Rodar: scripts\sync-softgen-to-github.bat
4. Pronto! ✅
```

**Mantenha isso como rotina e seu GitHub estará sempre atualizado!** 🚀