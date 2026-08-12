> ⚠️ **Nota (agosto/2026):** este documento descreve a Action `.github/workflows/sync-from-vercel.yml`,
> criada na época em que o Softgen publicava direto no Vercel (contornando o
> GitHub) e essa Action existia pra trazer essas mudanças de volta pro
> GitHub. O Softgen não é mais usado — hoje o desenvolvimento é feito direto
> em VS Code + Claude Code, com push pro GitHub primeiro, e o Vercel só
> publica a partir do GitHub. Ou seja, é bem provável que essa Action hoje
> nunca encontre nada pra sincronizar (o GitHub já tem tudo). Vale considerar
> desativá-la — só não fiz isso sozinho porque é uma mudança de infraestrutura
> e prefiro confirmar com você antes.

# 🔄 Configuração de Sincronização Automática Vercel → GitHub

## 📋 Objetivo

Sincronizar automaticamente o código do Vercel para o GitHub, caso alguma mudança chegue lá por um caminho que não passou pelo GitHub primeiro.

---

## 🎯 Como Funciona

```
Softgen → Publish (Vercel) → GitHub Action → Commit Automático no GitHub
```

**Fluxo completo:**
1. ✅ Você desenvolve no Softgen normalmente
2. ✅ Clica em "Publish" para fazer deploy no Vercel
3. ✅ GitHub Action detecta o deploy
4. ✅ Faz commit e push automático no GitHub
5. ✅ **Zero trabalho manual!**

---

## ⚙️ Configuração Inicial (5 minutos)

### **Passo 1: Ativar GitHub Actions**

1. Vá para o repositório no GitHub:
   ```
   https://github.com/CaduCondo/sistemaDuvoEnterprise
   ```

2. Clique em **"Actions"** (menu superior)

3. Se Actions estiver desabilitado:
   - Clique em **"I understand my workflows, enable them"**

4. Você verá o workflow **"Sync from Vercel (Auto)"**

---

### **Passo 2: Configurar Permissões de Escrita**

**CRÍTICO:** Actions precisa de permissão para fazer commits.

1. Vá em **Settings** do repositório

2. No menu lateral → **Actions** → **General**

3. Role até **"Workflow permissions"**

4. Selecione:
   ```
   ✅ Read and write permissions
   ```

5. Marque também:
   ```
   ✅ Allow GitHub Actions to create and approve pull requests
   ```

6. Clique em **Save**

---

### **Passo 3: Testar Sincronização Manual**

Antes de automatizar, teste manualmente:

1. Vá em **Actions** → **Sync from Vercel (Auto)**

2. Clique em **"Run workflow"**

3. Opções:
   - Branch: `main` (padrão)
   - Commit message: deixe vazio ou customize

4. Clique em **"Run workflow"**

5. Aguarde 10-30 segundos

6. ✅ Se tudo estiver correto, verá:
   ```
   ✅ Sincronização concluída com sucesso!
   📦 Commit: chore: sync from Softgen - 2026-07-29 20:45:32
   ```

---

## 🚀 Uso Diário (AUTOMÁTICO)

### **Opção 1: Sincronização Diária Automática (RECOMENDADO)**

O GitHub Action já está configurado para rodar **1x por dia às 23:00 UTC (20:00 BRT)**.

**Você não precisa fazer NADA!**

- ✅ Trabalhe normalmente no Softgen
- ✅ Todo dia às 20h (BRT) → commit automático no GitHub
- ✅ Se não houver mudanças → Action não faz commit

---

### **Opção 2: Sincronização Manual (Quando Precisar)**

Se quiser sincronizar AGORA (sem esperar o agendamento):

1. Vá em **Actions** → **Sync from Vercel (Auto)**
2. Clique em **"Run workflow"**
3. Deixe a mensagem padrão ou customize
4. Clique em **"Run workflow"**
5. ✅ Pronto em 30 segundos!

---

### **Opção 3: Após Deploy no Vercel (Futuro)**

**Para sincronizar automaticamente após clicar "Publish" no Softgen:**

Isso requer configurar webhook no Vercel (mais avançado):

1. No Vercel → Settings → Git → Webhooks
2. Adicionar webhook que chama a GitHub Action
3. Toda vez que fizer Publish → commit automático

**Nota:** Requer configuração adicional no Vercel (opcional).

---

## 📊 Monitoramento

### **Ver Histórico de Sincronizações:**

1. Vá em **Actions** no repositório
2. Veja todos os runs do workflow
3. Clique em qualquer run para ver detalhes:
   - ✅ Mudanças commitadas
   - 📝 Mensagem do commit
   - ⏱️ Duração (geralmente 10-30 seg)

---

## 🔧 Personalização

### **Mudar Horário da Sincronização Diária:**

Edite `.github/workflows/sync-from-vercel.yml`:

```yaml
schedule:
  # Executar às 23:00 UTC (20:00 BRT) - Mudar conforme necessário
  - cron: '0 23 * * *'
```

**Exemplos de cron:**
- `0 23 * * *` - 23:00 UTC (20:00 BRT) - Final do dia
- `0 12 * * *` - 12:00 UTC (09:00 BRT) - Meio do dia
- `0 3 * * *` - 03:00 UTC (00:00 BRT) - Madrugada
- `0 */6 * * *` - A cada 6 horas

---

## ❌ Resolução de Problemas

### **Erro: "Resource not accessible by integration"**

**Causa:** Falta permissão de escrita

**Solução:**
1. Settings → Actions → General
2. Workflow permissions → **Read and write permissions**
3. Salvar e tentar novamente

---

### **Action não está rodando automaticamente**

**Verifique:**
1. Actions estão habilitados? (Actions → Enable)
2. Workflow está na branch `main`?
3. Permissões configuradas corretamente?

---

### **Commits duplicados**

**Causa:** Action rodando várias vezes

**Solução:** 
- Action verifica se há mudanças antes de commitar
- Se repositório já estiver sincronizado → não faz commit
- Isso é normal e seguro

---

## 🎯 Resultado Final

**Depois da configuração inicial:**

```
✅ Sincronização diária automática (1x/dia)
✅ Sincronização manual quando necessário (1 clique)
✅ Zero trabalho manual no dia a dia
✅ GitHub sempre atualizado
```

**Seu workflow:**
1. Desenvolva no Softgen normalmente
2. Fim! O GitHub sincroniza sozinho! 🚀

---

## 📝 Notas Importantes

- ✅ Action só commita se houver mudanças
- ✅ Usa mensagens de commit padronizadas
- ✅ Não sobrescreve histórico (commits incrementais)
- ✅ Seguro para usar com deploy contínuo
- ✅ Funciona em paralelo com Vercel (sem conflitos)

---

## 📞 Suporte

Se tiver problemas:
1. Verifique o log da Action (clique no run)
2. Confirme permissões de escrita
3. Teste sincronização manual primeiro

**Tudo configurado? GitHub agora sincroniza automaticamente! 🎉**