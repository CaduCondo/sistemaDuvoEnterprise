# 🔒 GUIA COMPLETO DE POLÍTICAS RLS (Row-Level Security)

## 📋 ÍNDICE
1. [Introdução](#introdução)
2. [Tabelas e Políticas Atuais](#tabelas-e-políticas-atuais)
3. [Padrão de Políticas](#padrão-de-políticas)
4. [Checklist para Novas Tabelas](#checklist-para-novas-tabelas)
5. [Troubleshooting](#troubleshooting)
6. [Histórico de Correções](#histórico-de-correções)

---

## 🚨 LEIA ISTO ANTES DE TUDO — 30/ago/2026

**Este sistema NÃO usa o login do Supabase.** Ele tem login próprio
(`src/services/authService.ts` + `AuthContext`, usuário guardado no
navegador). Não existe `signInWithPassword` nem `getSession` em lugar nenhum
de `src/`.

Consequência prática, e ela é grave:

> Para o banco, **toda visita ao sistema é anônima**. `auth.uid()` é
> **sempre nulo**, para todo mundo, inclusive para o admin.

Portanto **qualquer política escrita com `auth.uid()` bloqueia 100% das
gravações** — não protege, apenas quebra a tela. O mesmo vale para
`auth.role()` e para políticas que consultam `system_users`.

⚠️ **Os exemplos mais abaixo neste guia usam `auth.uid() IS NOT NULL`. NÃO
COPIE.** Eles foram escritos assumindo o login do Supabase, que este sistema
não usa.

### O padrão correto neste sistema

O controle de acesso é feito **na tela** (o menu e as rotas só deixam o
perfil certo chegar na página). No banco, as tabelas do sistema ficam com a
trava (RLS) **desligada**:

```sql
ALTER TABLE public.minha_tabela DISABLE ROW LEVEL SECURITY;
```

Se a trava precisar ficar ligada por algum motivo, a política tem que ser
livre — nunca amarrada a `auth.uid()`:

```sql
CREATE POLICY "minha_tabela_livre" ON public.minha_tabela
  FOR ALL TO public USING (true) WITH CHECK (true);
```

**O preço disso, dito com todas as letras:** a proteção fica só no sistema,
não no banco. A chave pública do Supabase está no navegador de quem abre o
site, então quem souber usá-la alcança essas tabelas sem passar pela tela. É
uma dívida conhecida; consertar de verdade significa adotar o login do
Supabase, o que é um projeto à parte.

### O caso que gerou este aviso

Em 30/ago/2026 a tela **Configurações → Isenção de Taxa Admin** parou de
salvar em produção, com `new row violates row-level security policy`. A
tabela `admin_fee_exempt_locations` estava com a trava ligada e duas
políticas: uma de LEITURA livre e uma de GRAVAÇÃO exigindo estar em
`system_users` como admin.

Por isso o defeito enganava: **a tela abria certinha** (a leitura passava) e
**só quebrava ao salvar**. Duas tentativas de correção falharam porque
usaram justamente o `auth.uid() IS NOT NULL` recomendado neste guia. A
correção final foi desligar a trava, como já estava em DEV desde fevereiro.
Ver `docs/tickets/PROD-corrige-isencao-taxas-3.sql`.

Para varrer o banco atrás de outros casos iguais:
`docs/tickets/DIAG-rls-producao.sql`.

### Storage também tem policy, não só tabela — 03/set/2026 (issue #74)

O mesmo problema deste guia (chave anônima pública alcança direto o que a
policy deixar) vale para o bucket `uploads` do Supabase Storage, não só
para tabelas. Até 03/set/2026 a policy de INSERT do bucket era livre para
qualquer um (nem precisava estar logado no sistema) — corrigido trocando o
upload direto do navegador por uma rota de servidor que exige sessão válida
antes de autorizar o upload. Detalhe completo em
`docs/AUTHENTICATION.md`, seção "Upload de Anexos".

---

## 🎯 INTRODUÇÃO

**Row-Level Security (RLS)** é um recurso do PostgreSQL/Supabase que controla quais linhas (rows) de uma tabela cada usuário pode acessar.

### ⚠️ REGRA DE OURO:
```
Se uma tabela tem RLS habilitado MAS não tem políticas configuradas:
❌ TODAS as operações (SELECT, INSERT, UPDATE, DELETE) são BLOQUEADAS
❌ Sintoma: Dados "somem" da interface
❌ Erro: "new row violates row-level security policy"

✅ SOLUÇÃO: SEMPRE criar 4 políticas (SELECT, INSERT, UPDATE, DELETE) para cada tabela
```

---

## 📊 TABELAS E POLÍTICAS ATUAIS

### ✅ TABELAS PRINCIPAIS (100% Configuradas)

#### 1. **configs** (Configurações da Empresa)
```sql
✅ SELECT - Authenticated users can view configs
✅ INSERT - Authenticated users can create configs  
✅ UPDATE - Authenticated users can update configs
✅ DELETE - Authenticated users can delete configs

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
```

#### 2. **locations** (Locais/Condomínios)
```sql
✅ SELECT - Authenticated users can view locations
✅ INSERT - Authenticated users can create locations
✅ UPDATE - Authenticated users can update locations
✅ DELETE - Authenticated users can delete locations

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
```

#### 3. **payments** (Pagamentos)
```sql
✅ SELECT - Authenticated users can view payments
✅ INSERT - Authenticated users can create payments
✅ UPDATE - Authenticated users can update payments
✅ DELETE - Authenticated users can delete payments

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
Nota: Substituiu política genérica "Public Access"
```

#### 4. **properties** (Imóveis)
```sql
✅ SELECT - Authenticated users can view properties
✅ INSERT - Authenticated users can create properties
✅ UPDATE - Authenticated users can update properties
✅ DELETE - Authenticated users can delete properties

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
Nota: Substituiu política genérica "Public Access"
```

#### 5. **rentals** (Locações)
```sql
✅ SELECT - Authenticated users can view rentals
✅ INSERT - Authenticated users can create rentals
✅ UPDATE - Authenticated users can update rentals
✅ DELETE - Authenticated users can delete rentals

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
Nota: Substituiu política genérica "Public Access"
```

#### 6. **tenants** (Inquilinos)
```sql
✅ SELECT - Authenticated users can view tenants
✅ INSERT - Authenticated users can create tenants
✅ UPDATE - Authenticated users can update tenants
✅ DELETE - Authenticated users can delete tenants

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
Nota: Substituiu política genérica "Public Access"
```

#### 7. **system_users** (Usuários do Sistema)
```sql
✅ SELECT - Authenticated users can view system_users
✅ INSERT - Authenticated users can create system_users
✅ UPDATE - Authenticated users can update system_users
✅ DELETE - Authenticated users can delete system_users

Status: ✅ COMPLETO (4 políticas)
Última Atualização: 2026-01-18
Nota: Substituiu política genérica "Public Access"
```

#### 8. **role_menu_permissions** (Permissões de Menu)
```sql
✅ SELECT - Authenticated users can view permissions
✅ UPDATE - Authenticated users can update permissions

Status: ✅ COMPLETO (2 políticas)
Nota: Apenas SELECT e UPDATE necessários (dados pré-populados)
```

#### 9. **user_location_permissions** (Permissões de Locais)
```sql
✅ SELECT - Authenticated users can view user_location_permissions
✅ INSERT - Authenticated users can create user_location_permissions
✅ DELETE - Authenticated users can delete user_location_permissions

Status: ✅ COMPLETO (3 políticas)
Nota: Não precisa de UPDATE (delete + insert para alterar)
```

---

## 🎨 PADRÃO DE POLÍTICAS

### Template Padrão (Copiar/Colar para Novas Tabelas)

```sql
-- ============================================
-- RLS POLICIES FOR: your_table_name
-- ============================================

-- 1. SELECT Policy (Visualização)
CREATE POLICY "Authenticated users can view your_table_name"
ON your_table_name
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- 2. INSERT Policy (Criação)
CREATE POLICY "Authenticated users can create your_table_name"
ON your_table_name
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. UPDATE Policy (Atualização)
CREATE POLICY "Authenticated users can update your_table_name"
ON your_table_name
FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. DELETE Policy (Deleção)
CREATE POLICY "Authenticated users can delete your_table_name"
ON your_table_name
FOR DELETE
TO public
USING (auth.uid() IS NOT NULL);

-- Habilitar RLS (se ainda não estiver)
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;
```

### ✅ O que essa política faz:

```
auth.uid() IS NOT NULL = Usuário está autenticado (logado)

✅ Permite: Todas as operações CRUD para usuários logados
❌ Bloqueia: Usuários não autenticados (anônimos)
✅ Flexível: Admin, Corretor, Financeiro têm acesso
✅ Seguro: Requer autenticação básica
```

---

## 📝 CHECKLIST PARA NOVAS TABELAS

Sempre que criar uma nova tabela, siga este checklist:

### ✅ Passo 1: Criar Tabela
```sql
CREATE TABLE my_new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### ✅ Passo 2: Habilitar RLS
```sql
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;
```

### ✅ Passo 3: Criar Políticas (TODAS AS 4!)
```sql
-- Copiar template acima e substituir "your_table_name" por "my_new_table"
```

### ✅ Passo 4: Verificar
```sql
-- Testar SELECT
SELECT * FROM my_new_table;

-- Testar INSERT
INSERT INTO my_new_table (name) VALUES ('Test');

-- Testar UPDATE
UPDATE my_new_table SET name = 'Updated' WHERE id = '...';

-- Testar DELETE
DELETE FROM my_new_table WHERE id = '...';
```

### ✅ Passo 5: Documentar
```markdown
Adicionar na seção "Tabelas e Políticas Atuais" deste documento
```

---

## 🔧 TROUBLESHOOTING

### ❌ Problema 1: "Dados sumiram da interface"
```
Causa: Tabela tem RLS habilitado mas sem políticas
Solução: Criar 4 políticas (SELECT, INSERT, UPDATE, DELETE)
Comando rápido:
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  -- Verificar quais tabelas não têm políticas
```

### ❌ Problema 2: "new row violates row-level security policy"
```
Causa: Tentando INSERT/UPDATE mas não tem política WITH CHECK
Solução: Criar política com WITH CHECK (auth.uid() IS NOT NULL)
```

### ❌ Problema 3: "permission denied for table"
```
Causa: RLS não está habilitado OU políticas muito restritivas
Solução: 
  1. Verificar: SELECT relrowsecurity FROM pg_class WHERE relname = 'table_name';
  2. Habilitar: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
  3. Criar políticas permissivas
```

### ✅ Comando de Diagnóstico Rápido
```sql
-- Ver todas as tabelas e suas políticas
SELECT 
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY policy_count ASC;

-- ⚠️ Se policy_count < 4 E rls_enabled = true → PROBLEMA!
```

---

## 📜 HISTÓRICO DE CORREÇÕES

### 🔴 2026-01-18 - Correção Massiva de RLS
**Problema:** Múltiplas tabelas com RLS habilitado mas sem políticas

**Tabelas Corrigidas:**
- ✅ configs (4 políticas criadas)
- ✅ locations (4 políticas criadas)
- ✅ payments (políticas específicas substituíram "Public Access")
- ✅ properties (políticas específicas substituíram "Public Access")
- ✅ rentals (políticas específicas substituíram "Public Access")
- ✅ tenants (políticas específicas substituíram "Public Access")
- ✅ system_users (políticas específicas substituíram "Public Access")

**Migrações Criadas:**
- 20260118073507_migration_e5600ffd.sql (configs)
- 20260118074124_migration_33e4d908.sql (locations)
- 20260118074800_migration_13aa6d5d.sql (payments)
- 20260118074811_migration_44882b2a.sql (properties)
- 20260118074822_migration_bdf04a98.sql (rentals)
- 20260118074832_migration_04fafcc3.sql (tenants)
- 20260118074842_migration_f2aa482a.sql (system_users)

**Resultado:**
- ✅ Sistema 100% funcional
- ✅ Sem mais erros de RLS
- ✅ Todas as tabelas principais protegidas
- ✅ Documentação completa criada

---

## 🎯 RESUMO EXECUTIVO

### Status Atual: ✅ TODAS AS TABELAS PRINCIPAIS PROTEGIDAS

```
┌─────────────────────────────────────────────────────┐
│  🔒 STATUS DAS POLÍTICAS RLS                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ configs                    - 4 políticas        │
│  ✅ locations                  - 4 políticas        │
│  ✅ payments                   - 4 políticas        │
│  ✅ properties                 - 4 políticas        │
│  ✅ rentals                    - 4 políticas        │
│  ✅ tenants                    - 4 políticas        │
│  ✅ system_users               - 4 políticas        │
│  ✅ role_menu_permissions      - 2 políticas        │
│  ✅ user_location_permissions  - 3 políticas        │
│                                                     │
│  📊 TOTAL: 9 tabelas | 33 políticas                │
│                                                     │
│  🎯 COBERTURA: 100% das tabelas principais          │
│  🔒 SEGURANÇA: Autenticação obrigatória             │
│  ✅ STATUS: Sistema completamente funcional         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 🚀 Próximos Passos

1. ✅ **Ao criar nova tabela**: Seguir checklist acima
2. ✅ **Ao encontrar erro RLS**: Consultar troubleshooting
3. ✅ **Ao fazer migrações**: Sempre incluir políticas RLS
4. ✅ **Documentação**: Manter este arquivo atualizado

---

**Última Atualização:** 2026-08-12
**Versão:** 1.0  
**Status:** ✅ ATIVO E FUNCIONAL