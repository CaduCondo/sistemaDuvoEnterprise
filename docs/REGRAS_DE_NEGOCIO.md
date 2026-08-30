# 📋 Documentação Completa - Sistema de Gestão de Locações

## 📑 Índice

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Autenticação e Permissões](#autenticação-e-permissões)
3. [Dashboard](#dashboard)
4. [Locais](#locais)
5. [Imóveis](#imóveis)
6. [Inquilinos](#inquilinos)
7. [Locações](#locações)
8. [Pagamentos/Recebimentos](#pagamentosrecebimentos)
9. [Financeiro](#financeiro)
10. [Configurações](#configurações)
11. [Página Pública de Imóveis](#página-pública-de-imóveis)
12. [Fluxos Completos](#fluxos-completos)
13. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)

---

## 🌐 Visão Geral do Sistema

### Objetivo
Sistema completo de gestão de locações de imóveis com controle de:
- Cadastro de imóveis, inquilinos e locações
- Gestão de pagamentos e inadimplência
- Controle financeiro com taxas e despesas
- Sistema de permissões por perfil de usuário
- Relatórios e análises gerenciais
- Página pública para divulgação de imóveis disponíveis

### Tecnologias Principais
- **Frontend**: Next.js 15.5 (Page Router), React 18, TypeScript
- **UI**: Tailwind CSS v3, Shadcn/UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Autenticação**: Supabase Auth (email/senha)

### Comportamento Padrão das Telas (NOVO — Agosto/2026)
Nenhuma tela/formulário do sistema fecha mais sozinha ao clicar fora dela ou
apertar Esc (antes isso apagava o que estava sendo preenchido em Novo
Imóvel, Novo Inquilino, Recebimentos, etc). Agora só fecha pelo "X" ou pelos
botões da própria tela (Cancelar, Criar, Salvar...). Padrão alterado em
`src/components/ui/dialog.tsx`, vale para todas as telas do sistema.

### Estrutura de Navegação
```
├── Login (página pública)
├── Dashboard (página inicial após login)
├── Imóveis
│   └── Detalhes do Imóvel [id]
├── Inquilinos
│   └── Detalhes do Inquilino [id]
├── Locações
│   └── Detalhes da Locação [id]
├── Pagamentos/Recebimentos
│   └── Gerenciar Pagamento [id]
├── Financeiro
│   ├── Detalhamento de Locações
│   └── Detalhamento de Cauções (Admin only)
├── Configurações
│   ├── Configurações Gerais
│   ├── Usuários
│   └── Permissões
└── Página Pública (/locations/[id])
```

---

## 🔐 Autenticação e Gestão de Usuários

### Sistema de Autenticação

#### Login via Dropdown no Header Público

**Localização:** Header da página pública de anúncios (página inicial)

**Características:**
- ✅ Login através de dropdown no header (página `/login` foi removida)
- ✅ Campos: Usuário/Email e Senha
- ✅ Toggle para mostrar/ocultar senha
- ✅ Link "Esqueci minha senha"
- ✅ Sistema de 3 tentativas com bloqueio automático

#### Sistema de 3 Tentativas

**Regra de Bloqueio:**

1. **1ª tentativa falha:** "Senha incorreta. Você tem mais 2 tentativas."
2. **2ª tentativa falha:** "Senha incorreta. Você tem mais 1 tentativa."
3. **3ª tentativa falha:** Conta bloqueada por 30 minutos

**Mensagem de bloqueio:**
```
"Conta bloqueada temporariamente por muitas tentativas falhas. 
Tente novamente em 30 minutos."
```

**Campos no banco (`system_users`):**
- `login_attempts` (INTEGER) - Contador de tentativas
- `blocked_until` (TIMESTAMP) - Data/hora do desbloqueio

**Reset automático:**
- Tentativas resetadas para 0 após login bem-sucedido
- Bloqueio expira automaticamente após 30 minutos

### Senha Temporária e Troca Obrigatória

#### Geração de Senha Temporária

**Quando é gerada:**
1. Ao criar novo usuário
2. Ao resetar senha de usuário existente
3. Ao recuperar senha esquecida

**Características da senha temporária:**
- ✅ 12 caracteres
- ✅ Pelo menos 1 letra maiúscula
- ✅ Pelo menos 1 letra minúscula
- ✅ Pelo menos 1 número
- ✅ Caracteres embaralhados aleatoriamente

**Exemplo:** `Ab3kT9mN2pQ1`

#### Troca Obrigatória no Primeiro Login

**Fluxo:**

1. Usuário faz login com senha temporária
2. Sistema detecta `requires_password_change = true`
3. Dropdown exibe tela de troca de senha (ao invés de redirecionar)
4. Usuário cria nova senha com validação em tempo real
5. Após salvar, acessa o sistema normalmente

**Validação Visual em Tempo Real:**

Requisitos exibidos abaixo do campo de senha:

| Requisito | Não Atendido | Atendido |
|-----------|--------------|----------|
| Pelo menos 1 maiúscula | ❌ Vermelho | ✅ Verde |
| Pelo menos 1 minúscula | ❌ Vermelho | ✅ Verde |
| Pelo menos 1 número | ❌ Vermelho | ✅ Verde |
| No mínimo 6 caracteres | ❌ Vermelho | ✅ Verde |
| No máximo 12 caracteres | ❌ Vermelho | ✅ Verde |
| Senhas são idênticas | ❌ Vermelho | ✅ Verde |

**Regra de validação "Senhas idênticas":**
- Fica verde quando usuário sai do segundo campo (onBlur)
- Ou quando clica no botão "Salvar Senha"

**Campos no banco:**
- `requires_password_change` (BOOLEAN) - Se precisa trocar
- `temporary_password` (BOOLEAN) - Se senha atual é temporária

### Recuperação de Senha

**Acesso:** Link "Esqueci minha senha" no dropdown de login

**Fluxo:**

1. Usuário clica em "Esqueci minha senha"
2. Dropdown exibe tela de recuperação
3. Usuário digita seu email
4. Sistema valida se email existe
5. Gera senha temporária automaticamente
6. Envia email com instruções
7. Reseta tentativas de login e remove bloqueio
8. Marca `requires_password_change = true`

**Email de recuperação contém:**
- Saudação com nome do usuário
- Link: www.duvoenterprise.com.br
- Senha temporária (12 caracteres)
- Aviso sobre troca obrigatória
- Requisitos da nova senha

**Segurança:**
- Senha anterior é invalidada imediatamente
- Contador de tentativas resetado para 0
- Bloqueio removido (se existir)

### Gestão de Usuários

#### Criação de Usuário

**Campos Obrigatórios:**
- ✅ Nome Completo (mínimo 3 caracteres)
- ✅ E-mail / Usuário (único no sistema, deve conter @)
- ✅ Perfil (Admin, Corretor, Financeiro)

**Campos Opcionais:**
- Telefone (com máscara: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX)

**Campo Status:**
- 🟢 Ativado (padrão)
- 🔴 Desativado

**Processo de criação:**

1. Admin preenche formulário
2. Sistema valida unicidade de email/usuário
3. Gera senha temporária automaticamente
4. Cria usuário com `requires_password_change = true`
5. Envia email de boas-vindas com senha temporária
6. Exibe toast de confirmação

**Email de boas-vindas contém:**
- Saudação com nome do usuário
- Link: www.duvoenterprise.com.br
- Senha temporária
- Aviso sobre troca obrigatória no primeiro acesso

**Validações:**

1. **Email/Usuário:**
   - Deve conter @
   - Deve ser único
   - Mensagem de erro: "O E-mail/Usuário já existe no sistema"

2. **Telefone:**
   - Máscara: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
   - Aceita apenas números
   - 10 dígitos (fixo) ou 11 dígitos (celular)
   - Mensagem de erro: "Telefone inválido. Use (XX) XXXXX-XXXX ou (XX) XXXX-XXXX"

#### Edição de Usuário

**Ação:** Clicar na linha da tabela de usuários

**Campos editáveis:**
- Nome Completo
- E-mail / Usuário
- Telefone
- Perfil
- Status (Ativado/Desativado)

**Não é possível editar:**
- Senha (use "Resetar Senha" para isso)

#### Resetar Senha de Usuário

**Ação:** Clicar no ícone 🔑 (chave) na tabela de usuários

**Processo:**

1. Admin clica no ícone de resetar senha
2. Sistema gera senha temporária automaticamente
3. Atualiza banco de dados:
   - Nova senha
   - `requires_password_change = true`
   - `temporary_password = true`
   - `login_attempts = 0`
   - `blocked_until = null`
4. Envia email informando sobre reset
5. Exibe toast: "Senha resetada com sucesso! Email enviado para [email]"

**Email de reset contém:**
- Aviso que senha foi resetada por um administrador
- Nova senha temporária
- Obrigatoriedade de troca no próximo login
- Requisitos da nova senha

#### Exclusão de Usuário

**Ação:** Clicar no ícone 🗑️ (lixeira) na tabela de usuários

**Regras:**
- Confirmação obrigatória
- Apenas Admin pode excluir usuários
- Não é possível excluir usuário ativo com permissões ativas

### Sistema de Tema por Usuário

**Campo no banco:** `theme` em `system_users`

**Valores:**
- `light` - Tema claro
- `dark` - Tema escuro

**Funcionalidade:**

1. **No Login:**
   - Sistema carrega tema salvo do usuário
   - Aplica automaticamente na interface

2. **Troca de Tema:**
   - Acesso: Menu do perfil → "Trocar Tema (Light/Dark)"
   - Menu mostra opção oposta ao tema atual:
     * Se está em Dark → "Trocar Tema (Light)"
     * Se está em Light → "Trocar Tema (Dark)"
   - Ao clicar:
     1. Atualiza tema no banco de dados
     2. Aplica mudança imediatamente
     3. Persiste na sessão local

3. **Persistência:**
   - Tema é salvo no banco de dados
   - Carregado automaticamente no próximo login
   - Compartilhado entre dispositivos

**Implementação técnica:**
- Context API para estado global
- LocalStorage para cache (evita flash)
- Classe CSS no `<html>` para aplicação global

### Tabela de Usuários

**Colunas:**
- Nome
- E-mail
- Perfil (badge: Administrador, Corretor, Financeiro)
- Status (badge com bolinha verde/vermelha)

**Status exibidos:**

| Status | Badge | Ícone | Descrição |
|--------|-------|-------|-----------|
| Bloqueado Temporariamente | 🔴 Vermelho | 🔒 | Bloqueado por tentativas (mostra tempo restante) |
| Inativo | ⚪ Cinza | 🚫 | Desativado pelo admin |
| Ativo | 🟢 Verde | ✅ | Usuário ativo |

**Ações (ícones diretos):**
- 🔑 Resetar Senha (azul)
- 🗑️ Excluir (vermelho)

**Interação:**
- Clicar na linha: abre edição
- Clicar nos ícones: executa ação específica

### Emails do Sistema

**Importante:** Atualmente os emails estão sendo simulados no console (desenvolvimento)

**Produção:**
- Serviço recomendado: **Resend**
- Plano gratuito: 3.000 emails/mês
- Após 3.000: $1 por 1.000 emails
- Integração: variável `RESEND_API_KEY`

**Tipos de email:**

1. **Boas-vindas (novo usuário)**
   - Trigger: Criação de usuário
   - Conteúdo: senha temporária + link de acesso

2. **Reset de senha (admin)**
   - Trigger: Admin resetar senha
   - Conteúdo: nova senha temporária + aviso de admin

3. **Recuperação de senha (usuário)**
   - Trigger: "Esqueci minha senha"
   - Conteúdo: senha temporária + instruções

---

## 🔐 Autenticação e Permissões

### Sistema de Autenticação

**Método de Login**
- Email + senha
- Sessão persistida via Supabase Auth
- Redirecionamento automático para login se não autenticado

**Recuperação de Senha**
- Link de recuperação enviado por email
- Configurado no Supabase Auth

### Perfis de Usuário (Roles)

#### 1. Admin (Administrador)
- **Acesso Total**: Todas as páginas e funcionalidades
- **Dados**: Visualiza e edita todos os dados do sistema
- **Configurações**: Pode alterar taxas, criar usuários, atribuir permissões
- **Financeiro**: Acesso completo aos 2 relatórios (Locações + Cauções)
- **Isenções**: Pode criar isenções de taxa por local
- **Despesas**: Gerencia despesas de locais

#### 2. Broker (Corretor)
- **Acesso**: Dashboard, Imóveis, Inquilinos, Locações, Pagamentos, Financeiro
- **Dados**: Visualiza e edita todos os dados
- **Configurações**: Apenas visualização (não pode alterar taxas ou criar usuários)
- **Financeiro**: Acesso completo aos 2 relatórios
- **Limitações**: Não pode criar/editar usuários, não pode alterar taxas

#### 3. Financial (Financeiro)
- **Acesso**: Dashboard, Financeiro (apenas aba Locações)
- **Dados**: Visualiza apenas locais permitidos em `user_location_permissions`
- **KPIs**: Calculados apenas com dados dos locais permitidos
- **Configurações**: Sem acesso
- **Restrição**: Não vê aba "Cauções", não pode criar/editar dados

#### 4. User (Futuro)
- Acesso básico para inquilinos consultarem seus pagamentos (não implementado)

### Matriz de Permissões por Página

| Página | Admin | Broker | Financial | User |
|--------|-------|--------|-----------|------|
| Dashboard | ✅ Tudo | ✅ Tudo | ✅ Filtrado | ❌ |
| Imóveis | ✅ CRUD | ✅ CRUD | ❌ | ❌ |
| Inquilinos | ✅ CRUD | ✅ CRUD | ❌ | ❌ |
| Locações | ✅ CRUD | ✅ CRUD | ❌ | ❌ |
| Pagamentos | ✅ CRUD | ✅ CRUD | ❌ | ❌ |
| Financeiro - Locações | ✅ Tudo | ✅ Tudo | ✅ Filtrado | ❌ |
| Financeiro - Cauções | ✅ Tudo | ✅ Tudo | ❌ | ❌ |
| Configurações | ✅ CRUD | 👁️ View | ❌ | ❌ |

### Permissões por Local

**Tabela**: `user_location_permissions`

**Funcionalidade**:
- Permite associar usuários `financial` a locais específicos
- Usuários só visualizam dados dos locais permitidos
- Admin/Broker veem todos os locais automaticamente

**Exemplo**:
```
Usuário Financial: João
Locais Permitidos: ACÁCIAS, BAMBUÍ
Resultado: João só vê imóveis, locações e pagamentos desses 2 locais
```

---

## 🏠 Dashboard

### Objetivo
Página inicial com visão geral consolidada do negócio e métricas em tempo real.

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  Bem-vindo, [Nome do Usuário]                           │
│  Seletor de Período: [Mês] [Ano]  [Filtrar]           │
├─────────────────────────────────────────────────────────┤
│  CARDS DE IMÓVEIS                                       │
│  [Total] [Disponíveis] [Alugados] [Taxa Ocupação]      │
├─────────────────────────────────────────────────────────┤
│  CARDS DE CONTRATOS                                     │
│  [Ativos] [A Vencer 30d] [Inquilinos] [Inadimplência]  │
├─────────────────────────────────────────────────────────┤
│  CARDS FINANCEIROS                                      │
│  [Atraso] [Esperada] [Bruta] [Taxas] [Líquida]        │
├─────────────────────────────────────────────────────────┤
│  GRÁFICOS                                               │
│  [Ocupação Mensal] [Receita Mensal]                    │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Seletor de Período
- **Padrão**: Mês/ano atual
- **Funcionalidade**: Filtrar dados exibidos no dashboard
- **Componentes afetados**: Todos os cards e gráficos
- **Persistência**: Não persiste entre sessões

#### 2. Cards de Visão Geral dos Imóveis

**2.1 Total de Imóveis**
- Conta todos os imóveis cadastrados no sistema
- Não considera status (ativo/inativo)
- Query: `COUNT(*) FROM properties`

**2.2 Imóveis Disponíveis**
- Imóveis sem locação ativa
- Cálculo: Total de imóveis - Imóveis com locação ativa
- Query: `properties WHERE availability = 'available'`

**2.3 Imóveis Alugados**
- Imóveis com pelo menos uma locação ativa
- Status da locação: `is_active = true`
- Query: `COUNT(DISTINCT property_id) FROM rentals WHERE is_active = true`

**2.4 Taxa de Ocupação**
- Fórmula: `(Imóveis Alugados / Total de Imóveis) × 100`
- Exibição: Percentual com 1 casa decimal
- Indicador visual: Progress bar com cores:
  - Verde: >= 80%
  - Amarelo: 50-79%
  - Vermelho: < 50%

#### 3. Cards de Contratos e Pagamentos

**3.1 Contratos Ativos**
- Locações com status `is_active = true`
- Conta apenas locações vigentes
- Query: `COUNT(*) FROM rentals WHERE is_active = true`

**3.2 Contratos a Vencer (30 dias)**
- Locações ativas com `end_date` entre hoje e hoje + 30 dias
- Alerta para renovações necessárias
- Cor: Amarelo (alerta)
- Query: `WHERE is_active = true AND end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`

**3.3 Total de Inquilinos**
- Conta todos os inquilinos cadastrados
- Não considera status
- Query: `COUNT(*) FROM tenants`

**3.4 Taxa de Inadimplência**
- Fórmula: `(Pagamentos Atrasados / Total de Pagamentos do Período) × 100`
- Considera apenas pagamentos do período selecionado
- Status considerado: `overdue`
- Cor: Vermelho se > 0%

#### 4. Cards de Resumo Financeiro

**4.1 Total em Atraso**
- Soma de `expected_amount` de todos os pagamentos com status `overdue`
- Período: Todo o histórico (não filtrado por mês/ano)
- Cor: Vermelho (alerta)
- Query: `SUM(expected_amount) WHERE status = 'overdue'`

**4.2 Receita Esperada**
- Soma de `expected_amount` de todos os pagamentos do período selecionado
- Inclui todos os status: pending, paid, overdue, partial
- Cor: Azul
- Query: `SUM(expected_amount) WHERE reference_month = X AND reference_year = Y`

**4.3 Receita Bruta**
- Soma de `paid_amount` de pagamentos com status `paid` ou `partial`
- Período filtrado por mês/ano selecionado
- Cor: Verde
- Query: `SUM(paid_amount) WHERE status IN ('paid', 'partial')`

**4.4 Taxas e Contas**
- Soma de:
  - Taxa de Administração: `(Receita Bruta × percentual_taxa_admin) / 100`
  - Taxa de Gerenciamento: `(Receita Bruta × percentual_taxa_gerenciamento) / 100`
  - Despesas de Locais: Soma de `amount` da tabela `location_expenses`
- **Exceção**: Imóveis com isenção de taxa não entram no cálculo
- Cor: Laranja
- Query complexa com LEFT JOIN em `user_fee_exemptions`

**4.5 Receita Líquida**
- Fórmula: `Receita Bruta - Taxas e Contas`
- Valor final após todas as deduções
- Cor: Verde escuro
- Este é o valor real disponível para repasse ao proprietário

#### 5. Gráficos Analíticos

**5.1 Gráfico de Ocupação Mensal**
- **Tipo**: Gráfico de linha
- **Eixo X**: Meses do ano selecionado (Jan a Dez)
- **Eixo Y**: Percentual de ocupação (0-100%)
- **Cálculo mensal**: `(Locações ativas no mês / Total de imóveis) × 100`
- **Cor da linha**: Azul
- **Área sob a linha**: Gradiente azul transparente

**5.2 Gráfico de Receita Mensal**
- **Tipo**: Gráfico de barras agrupadas
- **Eixo X**: Meses do ano selecionado
- **Eixo Y**: Valor em R$
- **Série 1 (Azul)**: Receita esperada
- **Série 2 (Verde)**: Receita recebida
- **Dados**: Agrupados por `reference_month` e `reference_year`
- **Legenda**: Exibida no topo

### Filtros para Financial
- Todos os dados são automaticamente filtrados pelos locais permitidos
- KPIs calculados apenas com dados dos locais autorizados
- Gráficos mostram apenas dados dos locais permitidos

---

## 📍 Locais

### Objetivo
Gerenciar cadastro de locais/endereços onde os imóveis estão localizados.

### Estrutura de Dados

**Tabela**: `locations`

**Campos**:
- `id` (UUID): Identificador único
- `name` (TEXT): Nome do local (ex: "ACÁCIAS", "BAMBUÍ")
- `address` (TEXT): Endereço completo
- `city` (TEXT): Cidade
- `state` (TEXT): Estado (sigla)
- `zip_code` (TEXT): CEP
- `created_at` (TIMESTAMP): Data de criação

### Regras de Negócio

**Cadastro**:
- Nome é obrigatório e único
- Endereço completo é obrigatório
- CEP com máscara automática (00000-000)

**Edição**:
- Todos os campos são editáveis
- Nome deve permanecer único

**Exclusão**:
- ❌ Não permitir se houver imóveis cadastrados no local
- ✅ Permitir se não houver imóveis

**Uso no Sistema**:
- Usado como FK em `properties.location_id`
- Usado em filtros de permissões (`user_location_permissions`)
- Usado em isenções de taxa (`user_fee_exemptions`)
- Usado em despesas (`location_expenses`)

---

## 🏢 Imóveis

### Objetivo
Gerenciar cadastro completo de imóveis disponíveis para locação.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Imóveis                                  [+ Novo]       │
├─────────────────────────────────────────────────────────┤
│  Filtros:                                               │
│  [Buscar] [Local ▼] [Tipo ▼] [Status ▼] [Limpar]      │
│  Preço: [Min] - [Max]  |  Quartos: [Min] - [Max]      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   [Imagem]   │  │   [Imagem]   │  │   [Imagem]   │  │
│  │  ACÁCIAS     │  │  BAMBUÍ      │  │  CEDRO       │  │
│  │  Casa 1      │  │  Apto 201    │  │  Loja 05     │  │
│  │  R$ 1.200    │  │  R$ 800      │  │  R$ 2.500    │  │
│  │  2Q · 1B     │  │  1Q · 1B     │  │  Comercial   │  │
│  │  [Editar]    │  │  [Editar]    │  │  [Editar]    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Cadastro de Imóveis

**1.1 Campos Obrigatórios**
- Local (location_id) - FK para tabela `locations`
- Complemento (complement) - Ex: Casa 1, Apto 201, Loja 05
- Tipo (type): 
  - `house` (Casa)
  - `apartment` (Apartamento)
  - `commercial` (Comercial)
  - `land` (Terreno)
  - `room` (Quarto/Kitnet)
- Área em m² (area)
- Quartos (bedrooms)
- Banheiros (bathrooms)
- Valor de Aluguel (rental_price)

**1.2 Campos Opcionais**
- Tem Garagem (has_garage) - Boolean
- Valor da Garagem (garage_value) - Obrigatório se `has_garage = true`
- Descrição (description) - Texto longo
- Imagens (images) - Array de URLs
- Disponibilidade (availability): 
  - `available` (Disponível)
  - `rented` (Alugado)
  - `maintenance` (Em manutenção)
- Data de Cadastro (created_at) - Preenchido automaticamente

**1.3 Validações**
- `rental_price` deve ser > 0
- Se `has_garage = true`, então `garage_value` é obrigatório e > 0
- `area` deve ser > 0
- `bedrooms` e `bathrooms` devem ser >= 0
- Pelo menos 1 imagem é recomendada (não obrigatória)
- Complemento deve ser único dentro do mesmo local

#### 2. Upload de Imagens

**2.1 Formatos Aceitos**
- JPG, JPEG, PNG, WEBP
- Tamanho máximo: 5MB por imagem
- Máximo de 10 imagens por imóvel

**2.2 Armazenamento**
- Pasta: `public/uploads/`
- Nome do arquivo: `image_[uuid].[extensão]`
- Primeira imagem = imagem principal (thumbnail)

**2.3 Visualização**
- Lightbox para visualizar imagens em tela cheia
- Navegação entre imagens (anterior/próximo)
- Download de imagens individual
- Zoom in/out

**2.4 Gerenciamento**
- Arrastar para reordenar
- Excluir imagens individualmente
- Upload de múltiplas imagens simultâneas

#### 3. Filtros de Busca

**3.1 Filtros Disponíveis**
- **Busca textual**: Busca em location.name + complement
- **Local**: Dropdown com todos os locais cadastrados
- **Tipo de imóvel**: Dropdown (Casa, Apartamento, Comercial, etc.)
- **Status**: Dropdown (Disponível, Alugado, Manutenção)
- **Faixa de preço**: Min/max (inclui valor da garagem)
- **Número de quartos**: Min/max

**3.2 Aplicação de Filtros**
- Filtros são cumulativos (AND lógico)
- Busca textual usa ILIKE (case-insensitive)
- Filtros monetários incluem valor da garagem quando `has_garage = true`
- Botão "Limpar Filtros" restaura todos os valores

#### 4. Alteração de Disponibilidade

**4.1 Status Permitidos**
- `available`: Disponível para locação
- `rented`: Alugado (atualizado automaticamente ao criar locação)
- `maintenance`: Em manutenção (manual)

**4.2 Mudança Automática**
- Ao criar locação ativa → `availability = 'rented'`
- Ao encerrar/rescindir locação → `availability = 'available'`

**4.3 Mudança Manual**
- Admin/Broker pode alterar status manualmente
- Não altera locações existentes
- Útil para marcar imóveis em manutenção

#### 5. Exclusão de Imóveis

**5.1 Validação**
- ❌ Não permitir se houver locação ativa
- ✅ Permitir se todas as locações estiverem encerradas
- Confirmação obrigatória via AlertDialog

**5.2 Cascata**
- Ao excluir imóvel:
  - Deletar locações antigas (se permitido)
  - Deletar imagens associadas do servidor
  - Deletar pagamentos associados

#### 6. Página de Detalhes do Imóvel

**URL**: `/properties/[id]`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  [← Voltar]  ACÁCIAS - Casa 1               [Editar]    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  Informações Gerais               │
│  │                 │  Local: ACÁCIAS                    │
│  │   [Galeria de   │  Tipo: Casa                        │
│  │    Imagens]     │  Área: 120 m²                      │
│  │                 │  Quartos: 3 | Banheiros: 2         │
│  └─────────────────┘  Garagem: Sim (R$ 200,00)         │
│                       Aluguel: R$ 1.200,00              │
│                       Status: Disponível                │
├─────────────────────────────────────────────────────────┤
│  Descrição                                              │
│  Casa ampla com quintal e área de serviço...           │
├─────────────────────────────────────────────────────────┤
│  Histórico de Locações                                  │
│  [Tabela com locações antigas]                          │
└─────────────────────────────────────────────────────────┘
```

**Funcionalidades**:
- Visualizar todas as informações do imóvel
- Galeria de imagens com lightbox
- Histórico completo de locações
- Botão para editar (se Admin/Broker)
- Botão para criar nova locação (se disponível)

### Novidades do Cadastro de Imóvel (NOVO — Agosto/2026)

- **Churrasqueira** (`has_barbecue`): novo checkbox em "Diferenciais", junto
  com Móveis Planejados / Aceita Pets / Vaga de Garagem. No anúncio público,
  o bloco "Detalhes Adicionais" só mostra os itens marcados no cadastro.
- **Tipo de Anúncio** (`listing_type`): `rent` (Locação) ou `sale` (Venda).
  Quando o imóvel é cadastrado como Venda, o anúncio público e a página de
  detalhes mostram "Valor Venda" em vez de "Valor" + "/mês".
- **Reordenar fotos por arrastar**: no formulário de Novo/Editar Imóvel, a
  primeira foto da lista vira a "Capa" do anúncio; dá pra arrastar e soltar
  para reordenar.
- **Atalho de URL**: `/properties?novo=1` abre a tela de Novo Imóvel já
  aberta, sem precisar clicar no botão.
- **Link de compartilhamento com código curto** (`public_code`): a URL
  pública do imóvel (`/imovel/[código]`) usa um código curto **numérico e
  sequencial, com 4 dígitos** — ex.: `/imovel/0139` — em vez do UUID
  completo, bem mais fácil de compartilhar por WhatsApp. O código é gerado
  automaticamente no cadastro; a formatação (completar com zeros à esquerda)
  fica em `src/lib/propertyCode.ts`. A URL antiga, com o UUID, **continua
  funcionando**, para não quebrar links já compartilhados.

---

## 👥 Inquilinos

### Objetivo
Gerenciar cadastro de inquilinos (pessoas físicas ou jurídicas) que podem alugar imóveis.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Inquilinos                               [+ Novo]       │
├─────────────────────────────────────────────────────────┤
│  Filtros:                                               │
│  [Buscar: nome, email, telefone, doc] [Status ▼]       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │  📱 João Silva                    [Locatário]     │   │
│  │  📧 joao@email.com                                │   │
│  │  📞 (11) 98765-4321                               │   │
│  │  🆔 CPF: 123.456.789-10                           │   │
│  │  [Editar] [Excluir]                               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Cadastro de Inquilinos

**1.1 Campos Obrigatórios**
- Nome (name) - Nome completo
- Email (email) - Formato válido
- Telefone (phone) - Formato brasileiro
- Tipo de Documento (document_type): `cpf` ou `cnpj`
- Número do Documento (document_number) - Formatado com máscara

**1.2 Campos Opcionais**
- RG
- **Profissão (occupation)** - Campo de texto livre (até 255 caracteres)
- **Estado Civil (marital_status)** - Select com opções predefinidas
- **Renda Mensal (monthly_income)** - Valor numérico com máscara R$ XX.XXX,XX
- Observações (notes) - Texto longo
- Status (status) - Padrão: `active`

**1.3 Validações**
- **Email**: Deve ser válido (formato) e único no sistema
- **Telefone**: Formato brasileiro (XX) XXXXX-XXXX
- **CPF**: 11 dígitos com validação de dígitos verificadores
- **CNPJ**: 14 dígitos com validação de dígitos verificadores
- **Documento**: Deve ser único no sistema
- **Renda Mensal**: Aceita valores decimais, máscara aplicada automaticamente

**Máscaras Aplicadas**:
- CPF: 000.000.000-00
- CNPJ: 00.000.000/0000-00
- Telefone: (00) 00000-0000
- **Renda Mensal: R$ XX.XXX,XX** (máscara incremental durante digitação)

#### 1.4 Novos Campos - Detalhamento

**Profissão (occupation):**
- Campo de texto livre (VARCHAR 255)
- Opcional - pode ficar vazio
- Armazenamento: string sem formatação
- Exemplos: "Engenheiro Civil", "Médico", "Professor", "Empresário"
- Útil para: análise de perfil de inquilinos, relatórios

**Estado Civil (marital_status):**
- Campo select com opções predefinidas (VARCHAR 50)
- Opcional - pode ficar vazio
- Valores aceitos no banco de dados:
  - `solteiro` - Solteiro(a)
  - `casado` - Casado(a)
  - `divorciado` - Divorciado(a)
  - `viuvo` - Viúvo(a)
  - `uniao_estavel` - União Estável
- Útil para: documentação de contratos, análise demográfica

**Renda Mensal (monthly_income):**
- Campo numérico (DECIMAL 10,2)
- Opcional - pode ficar NULL
- Armazenamento: número decimal puro (ex: 5500.00)
- Exibição: R$ 5.500,00 (com máscara monetária R$ XX.XXX,XX)
- Entrada: Máscara incremental
  - Digita "5000" → mostra "R$ 50,00"
  - Continua digitando → "50000" → mostra "R$ 500,00"
  - Continua digitando → "500000" → mostra "R$ 5.000,00"
- Útil para: análise de capacidade de pagamento, relatórios financeiros

**Regras de Negócio Importantes:**
1. **Retroatividade**: Inquilinos cadastrados antes da implementação desses campos terão valores NULL
2. **Obrigatoriedade**: Nenhum dos 3 campos é obrigatório - podem permanecer vazios
3. **Edição**: Campos podem ser preenchidos/alterados a qualquer momento via edição do inquilino
4. **Máscara Monetária**: Aplicada automaticamente em TODOS os campos de valor do sistema (não apenas renda mensal)

#### 2. Status do Inquilino

**2.1 Status Disponíveis**
- `active`: Ativo (sem locação ativa)
- `renter`: Locatário (com locação ativa)
- `inactive`: Inativo (cadastro desativado)

**2.2 Mudança Automática**
- Ao criar locação ativa → `status = 'renter'`
- Ao encerrar locação → `status = 'active'`
- Badge verde: Active
- Badge azul: Renter
- Badge cinza: Inactive

**2.3 Preservação de Status**
- Ao editar inquilino, o status original é preservado
- Status só muda por ações de locação ou manualmente pelo admin

#### 3. Filtros de Busca

**3.1 Filtros Disponíveis**
- **Busca textual**: Nome + Email + Telefone + Documento
- **Status**: Dropdown (Todos, Ativo, Locatário, Inativo)

**3.2 Aplicação**
- Case-insensitive
- Busca parcial (ILIKE)
- Remove formatação de documento para busca

#### 4. Exclusão de Inquilinos

**4.1 Validação**
- ❌ Não permitir se houver locação ativa
- ✅ Permitir se todas as locações estiverem encerradas
- Confirmação obrigatória via AlertDialog

**4.2 Cascata**
- Ao excluir inquilino:
  - Deletar locações antigas (se permitido)
  - Deletar pagamentos associados

#### 5. Página de Detalhes do Inquilino

**URL**: `/tenants/[id]`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  [← Voltar]  João Silva                     [Editar]    │
├─────────────────────────────────────────────────────────┤
│  Informações Gerais                                     │
│  Nome: João Silva                                       │
│  Email: joao@email.com                                  │
│  Telefone: (11) 98765-4321                              │
│  CPF: 123.456.789-10                                    │
│  Status: Locatário                                      │
├─────────────────────────────────────────────────────────┤
│  Observações                                            │
│  Cliente pontual, recomendado...                        │
├─────────────────────────────────────────────────────────┤
│  Locações                                               │
│  [Tabela com locações atuais e históricas]              │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 Locações

### Objetivo
Gerenciar contratos de locação entre imóveis e inquilinos.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Locações                                 [+ Nova]       │
├─────────────────────────────────────────────────────────┤
│  Filtros:                                               │
│  [Buscar] [Status ▼] [Local ▼] [Mês/Ano]              │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │  🏠 ACÁCIAS - Casa 1               [Ativo]        │   │
│  │  👤 João Silva                                    │   │
│  │  📅 01/07/2025 → 31/12/2026                       │   │
│  │  💰 R$ 1.200,00/mês                               │   │
│  │  [Ver Detalhes] [Rescindir]                       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Criação de Locação

**1.1 Campos Obrigatórios**
- Imóvel (property_id) - FK para `properties`
- Inquilino (tenant_id) - FK para `tenants`
- Data de Início (start_date)
- Data de Término (end_date)
- Valor de Aluguel (monthly_rent)
- Dia de Vencimento (due_day) - 1 a 31
- Forma de Pagamento (payment_method):
  - `pix` (PIX)
  - `bank_transfer` (Transferência Bancária)
  - `credit_card` (Cartão de Crédito)
  - `debit_card` (Cartão de Débito)
  - `cash` (Dinheiro)

**1.2 Campos Opcionais - Garagem**
- Tem Garagem (has_garage) - Boolean
- Valor da Garagem (garage_value) - Obrigatório se `has_garage = true`

**1.3 Campos Opcionais - Pagamento**
- Código PIX (pix_code) - Chave PIX para recebimento

**1.4 Campos Opcionais - Caução**
- Valor do Caução (security_deposit) - Valor do depósito de segurança
- Número de Parcelas do Caução (deposit_installments) - Padrão: 1, Máximo: 12

**1.5 Campos Opcionais - Comissões**
- Corretor Parceiro (has_partner_broker) - Boolean
- Valor Comissão Corretor Parceiro (partner_broker_commission)
- Valor Comissão Corretor Interno (internal_broker_commission)

**1.6 Campos Opcionais - Documentação**
- Contrato PDF (contract) - Upload de arquivo PDF
- Observações (notes) - Texto longo

**1.7 Validações Críticas**
- `start_date` < `end_date` (data início antes da data fim)
- `start_date` não pode ser no passado (ao criar nova locação)
- `monthly_rent` > 0
- Se `has_garage = true`, então `garage_value` > 0
- `due_day` entre 1 e 31
- **Imóvel não pode ter locação ativa simultânea**
- **Inquilino não pode ter locação ativa simultânea**
- `security_deposit` >= 0
- `deposit_installments` >= 1 e <= 12

#### 2. Geração Automática de Pagamentos (Recebimentos)

**2.1 Trigger de Criação**
- Ao criar ou ativar locação, gerar parcelas automaticamente
- Uma parcela por mês entre `start_date` e `end_date`

**2.2 Cálculo de Parcelas**
```typescript
totalMeses = diferença em meses entre start_date e end_date + 1
valorEsperado = monthly_rent + (has_garage ? garage_value : 0)

// Primeira parcela (pode ser proporcional)
diasNoMes = total de dias no mês de início
diasUtilizados = dias desde start_date até fim do mês
valorProporcional = (valorEsperado / diasNoMes) * diasUtilizados

Para cada mês do contrato:
  criar payment com:
    - rental_id
    - reference_month = mês atual
    - reference_year = ano atual
    - due_date = dia do vencimento (due_day) do mês
    - expected_amount = valorEsperado (ou proporcional na 1ª)
    - paid_amount = 0
    - status = 'pending'
    - payment_method = método escolhido na locação
    - installment = número da parcela (1, 2, 3...)
    - total_installments = totalMeses
```

**2.3 Atualização de Pagamentos ao Editar Locação**
- **Se datas mudarem**: 
  - Recalcular parcelas (deletar antigas + criar novas)
  - Manter pagamentos já realizados (status = 'paid')
- **Se valores mudarem**: 
  - Atualizar `expected_amount` nas parcelas pendentes
- **Se método de pagamento mudar**: 
  - Atualizar `payment_method` em todas as parcelas pendentes

#### 3. Caução e Parcelamento

**3.1 Valor do Caução**
- Valor opcional definido na criação da locação
- Pode ser parcelado em até 12x
- Armazenado em tabela separada: `deposit_installments`

**3.2 Geração de Parcelas do Caução**
```typescript
Se security_deposit > 0 e deposit_installments > 0:
  valorParcela = security_deposit / deposit_installments
  
  Para cada parcela (1 até deposit_installments):
    criar deposit_installment com:
      - rental_id
      - installment_number = parcela atual (1, 2, 3...)
      - total_installments = deposit_installments
      - installment_total = security_deposit (valor total)
      - amount = valorParcela
      - payment_date = start_date + (parcela - 1) meses
      - pix_code = null (a preencher quando receber)
      - partner_commission = partner_broker_commission (se has_partner_broker)
      - internal_commission = internal_broker_commission
```

**3.3 Comissões de Caução**
- Comissões são cadastradas uma única vez no **primeiro registro** de caução
- Valores aplicam-se ao valor **total** do caução, não por parcela
- Exibidas no relatório financeiro de cauções

**3.4 Controle de Recebimento**
- Caução é considerado **recebido** quando `pix_code` está preenchido
- Admin pode editar `pix_code` inline na tabela de cauções (aba Financeiro)

#### 4. Status da Locação

**4.1 Status Disponíveis**
- `is_active = true`: Locação ativa/vigente
- `is_active = false`: Locação encerrada/rescindida

**4.2 Mudança de Status Manual**
- Admin/Broker pode encerrar locação manualmente
- Dialog de confirmação obrigatório

**4.3 Efeitos ao Encerrar Locação**
- Imóvel: `availability = 'available'`
- Inquilino: `status = 'active'`
- Pagamentos pendentes permanecem (não são deletados)
- Data fim (`end_date`) **NÃO é alterada** (mantém data original)

#### 5. Rescisão de Contrato

> ⚠️ **Esta seção descreve o comportamento ANTERIOR à issue #49
> (agosto/2026), quando a rescisão gerava um recebimento só.** As regras
> em vigor estão em [🔚 Rescisão de Contrato](#-rescisão-de-contrato),
> mais abaixo. Em especial: hoje são **dois** recebimentos, a correção do
> caução incide sobre o valor **pago** (não o contratado, como diz o item
> 5.1 abaixo), e não existe mais campo de multa livre.

**5.1 Dialog de Rescisão**
- Acessível via botão "Rescindir Contrato" na lista ou detalhes
- Campos:
  - Data da Rescisão (termination_date) - Data de saída do inquilino
  - Aplicar Multa de Contrato Completo (boolean)
  - Aplicar Multa de 12 Meses (boolean)
  - Valor da Multa (penalty_amount) - Calculado automaticamente
  - Valor do Caução (deposit_amount) - Preenchido automaticamente com correção IGPM

**5.2 Cálculo Automático de Valores**

**Aluguel Proporcional**:
```typescript
diasNoMes = total de dias no mês da rescisão
diasUtilizados = dias desde início do mês até data da rescisão
valorProporcional = (monthly_rent / diasNoMes) * diasUtilizados
```

**Multa Rescisória**:
```typescript
Se contrato < 12 meses E marca "Multa Contrato Completo":
  multa = (monthly_rent × meses_restantes) × 0.50
  
Se contrato >= 12 meses E marca "Multa 12 Meses":
  multa = monthly_rent × 3
  
Senão:
  multa = 0
```

**Correção do Caução (IGPM)**:
```typescript
// Buscar variação IGPM acumulada desde início do contrato
variacaoIGPM = buscar do serviço igpmService
caucaoCorrigido = security_deposit × (1 + variacaoIGPM)
```

**Valor Final da Rescisão**:
```typescript
valorFinal = aluguelProporcional + multa - caucaoCorrigido + garageValue (se houver)
```

**5.3 Processamento da Rescisão** (função `processContractTermination`)

**PASSO 1-7: Calcular e atualizar recebimento do mês da rescisão**
```typescript
1. Calcular aluguel proporcional
2. Calcular multa rescisória
3. Buscar e corrigir caução com IGPM
4. Calcular valor final (proporcional + multa - caução + garagem)
5. Criar breakdown detalhado dos valores
6. Atualizar recebimento do mês com:
   - expected_amount = valorFinal
   - payment_date = data da rescisão
   - status = recalculado (pode ficar 'paid' se valorFinal <= 0)
   - observations = breakdown em JSON
```

**PASSO 7.5: Atualizar data fim do contrato**
```typescript
// CRÍTICO: Atualizar end_date para data da rescisão
UPDATE rentals 
SET end_date = termination_date 
WHERE id = rental_id
```

**PASSO 8: Deletar recebimentos futuros**
```typescript
// Deletar TODOS os recebimentos com vencimento >= primeiro dia do mês seguinte
cutoffDate = primeiro dia do mês seguinte à rescisão
DELETE FROM payments 
WHERE rental_id = X 
  AND due_date >= cutoffDate
```

**PASSO 9: Recalcular números de parcela**
```typescript
// Recalcular installment e total_installments de todas as parcelas restantes
totalParcelas = COUNT de parcelas restantes
Para cada parcela (ordem por due_date):
  UPDATE payments 
  SET installment = número_sequencial,
      total_installments = totalParcelas
```

**PASSO 10: Validações obrigatórias**
```typescript
// Validação 1: Garantir que parcelas futuras foram deletadas
SELECT COUNT(*) FROM payments 
WHERE rental_id = X AND due_date >= cutoffDate

Se COUNT > 0:
  THROW ERROR("Parcelas futuras não foram deletadas!")

// Validação 2: Garantir que recálculo está correto
totalEsperado = parcelas originais - parcelas deletadas
totalAtual = COUNT de parcelas restantes

Se totalAtual != totalEsperado:
  THROW ERROR("Recálculo de parcelas incorreto!")
```

**5.4 Efeitos da Rescisão**
- ✅ Recebimento do mês da rescisão atualizado com valor proporcional + multa - caução
- ✅ Data fim do contrato atualizada para data da rescisão
- ✅ Todos os recebimentos futuros deletados
- ✅ Números de parcela recalculados (ex: 1/9, 2/9... 9/9)
- ✅ Imóvel volta para `availability = 'available'`
- ✅ Inquilino volta para `status = 'active'`
- ✅ Locação continua `is_active = true` (pode ser encerrada manualmente depois)

**5.5 Identificação na Tela de Recebimentos (NOVO — Agosto/2026)**
- O recebimento do mês da rescisão (que pode ter valor negativo, quando a
  devolução de caução é maior que o proporcional de aluguel devido) ganhou
  uma etiqueta **"Rescisão"** no card, na tela de Recebimentos, para não ser
  confundido com um recebimento comum.
- Corrigido bug em que esse valor negativo era salvo sempre como positivo
  (a função `parseCurrency()` apagava o sinal de "-"), fazendo o
  recebimento de rescisão aparecer como um aluguel normal na lista.

#### 6. Upload de Contrato

**6.1 Formato Aceito**
- Apenas PDF
- Tamanho máximo: 10MB
- Um arquivo por locação

**6.2 Armazenamento**
- Pasta: `public/uploads/`
- Nome: `rental_[uuid].pdf`

**6.3 Funcionalidades**
- Download direto do contrato
- Disponível na página de detalhes da locação
- Substituição do arquivo (upload novo substitui antigo)

#### 7. Edição de Locação

**7.1 Campos Editáveis**
- Todos os campos exceto `property_id` e `tenant_id`
- Imóvel e inquilino **não** podem ser alterados (restrição de integridade)

**7.2 Recálculo de Pagamentos**
- **Se `start_date` ou `end_date` mudarem**:
  - Deletar pagamentos futuros (status `pending`)
  - Recriar pagamentos com novas datas
  - Manter pagamentos já realizados
- **Se `monthly_rent` ou `garage_value` mudarem**:
  - Atualizar `expected_amount` em pagamentos pendentes
  - Não altera pagamentos já pagos

**7.3 Validações na Edição**
- Mesmas validações do cadastro
- Não permitir reduzir período se houver pagamentos fora do novo período

#### 8. Exclusão de Locação

**8.1 Validação**
- ✅ Sempre permitido
- Confirmação obrigatória via AlertDialog
- Aviso se houver pagamentos realizados

**8.2 Cascata**
- Deletar pagamentos associados (todos, inclusive pagos)
- Deletar parcelas de caução
- Imóvel: `availability = 'available'`
- Inquilino: `status = 'active'`

#### 9. Página de Detalhes da Locação

**URL**: `/rentals/[id]`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  [← Voltar]                       [Editar] [Rescindir]  │
├─────────────────────────────────────────────────────────┤
│  Informações da Locação                                 │
│  🏠 Imóvel: ACÁCIAS - Casa 1                            │
│  👤 Inquilino: João Silva                               │
│  📅 Período: 01/07/2025 → 31/12/2026 (18 meses)         │
│  💰 Valor: R$ 1.200,00/mês (Venc: dia 5)               │
│  🚗 Garagem: Sim (R$ 200,00)                            │
│  💳 Forma: PIX (chave: joao@pix.com)                    │
│  📊 Status: Ativo                                       │
├─────────────────────────────────────────────────────────┤
│  Garantia (Caução)                                      │
│  Valor Total: R$ 1.111,00 (3x de R$ 370,33)            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Parcela 1/3: R$ 370,33 - Venc: 01/07/2025       │   │
│  │  PIX: [___________]  ✅ Recebido                  │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Parcela 2/3: R$ 370,33 - Venc: 01/08/2025       │   │
│  │  PIX: [___________]  ⏳ Pendente                  │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Parcela 3/3: R$ 370,34 - Venc: 01/09/2025       │   │
│  │  PIX: [___________]  ⏳ Pendente                  │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Comissões                                              │
│  Corretor Parceiro: R$ 1.200,00                         │
│  Corretor Interno: R$ 600,00                            │
├─────────────────────────────────────────────────────────┤
│  Contrato                                               │
│  📄 contrato_locacao.pdf [Download]                     │
├─────────────────────────────────────────────────────────┤
│  Observações                                            │
│  Contrato renovado automaticamente...                   │
├─────────────────────────────────────────────────────────┤
│  Pagamentos (Recebimentos)                              │
│  [Tabela com todos os pagamentos da locação]            │
│  Parcela | Mês/Ano | Status | Vencimento | Valor | ...  │
└─────────────────────────────────────────────────────────┘
```

**Funcionalidades**:
- Visualizar todas as informações completas
- Detalhamento de cada parcela de caução
- Download do contrato
- Tabela completa de pagamentos
- Botões para editar e rescindir (se Admin/Broker)

---

## 💰 Pagamentos/Recebimentos

### Objetivo
Gerenciar recebimento de parcelas de aluguel das locações ativas.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Pagamentos                                             │
├─────────────────────────────────────────────────────────┤
│  Filtros:                                               │
│  [Mês ▼] [Ano ▼] [Status ▼] [Local ▼] [Filtrar]       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │  🏠 ACÁCIAS - Casa 1             Parcela 5/18     │   │
│  │  👤 João Silva                   [Pendente]       │   │
│  │  📅 Vencimento: 05/11/2025                        │   │
│  │  💰 Valor Esperado: R$ 1.200,00                   │   │
│  │  💳 Valor Pago: R$ 0,00                           │   │
│  │  [Gerenciar Pagamento]                            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Estrutura de Dados

**Tabela**: `payments`

**Campos**:
- `id` (UUID): Identificador único
- `rental_id` (UUID): FK para `rentals`
- `reference_month` (INTEGER): Mês de referência (1-12)
- `reference_year` (INTEGER): Ano de referência
- `due_date` (DATE): Data de vencimento
- `expected_amount` (NUMERIC): Valor esperado
- `paid_amount` (NUMERIC): Valor pago
- `payment_date` (DATE): Data do pagamento
- `status` (TEXT): Status do pagamento
- `payment_method` (TEXT): Forma de pagamento
- `payment_code` (TEXT): Código PIX
- `receipt` (TEXT): Comprovante (path do arquivo)
- `installment` (INTEGER): Número da parcela (1, 2, 3...)
- `total_installments` (INTEGER): Total de parcelas do contrato
- `observations` (TEXT): Observações (usado em rescisões)

### Regras de Negócio

#### 1. Status do Pagamento

**1.1 Lógica de Status**
```typescript
SE paid_amount >= expected_amount:
  status = 'paid'    // Pago totalmente
  
SENÃO SE paid_amount > 0:
  status = 'partial' // Pagamento parcial
  
SENÃO SE data_atual > due_date:
  status = 'overdue' // Atrasado
  
SENÃO:
  status = 'pending' // Pendente
```

**1.2 Cores dos Status**
- `paid` (Pago): Verde
- `partial` (Parcial): Amarelo
- `overdue` (Atrasado): Vermelho
- `pending` (Pendente): Cinza

**1.3 Atualização Automática**
- Status recalculado sempre que `paid_amount` ou `due_date` mudarem
- Job diário pode atualizar status de `pending` para `overdue` (não implementado)

#### 2. Gerenciamento de Pagamentos

**2.1 Dialog "Gerenciar Pagamento"**

**URL**: `/payments/manage/[id]`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Gerenciar Pagamento                          [X]       │
├─────────────────────────────────────────────────────────┤
│  Informações da Locação                                 │
│  🏠 ACÁCIAS - Casa 1                                    │
│  👤 João Silva                                          │
│  📅 Referência: Novembro/2025 (Parcela 5/18)           │
├─────────────────────────────────────────────────────────┤
│  Valor Esperado: R$ 1.200,00                            │
│  Valor Pago: [___________]                              │
│  Data Pagamento: [dd/mm/aaaa]                           │
│  Código PIX: [___________]                              │
│  Comprovante: [Upload]                                  │
│  Observações: [___________]                             │
├─────────────────────────────────────────────────────────┤
│  Ações Rápidas:                                         │
│  [Marcar como Pago] [Valor Parcial] [Limpar]           │
├─────────────────────────────────────────────────────────┤
│                              [Cancelar] [Salvar]        │
└─────────────────────────────────────────────────────────┘
```

**2.2 Marcar como Pago**
- Botão de ação rápida
- Define `paid_amount` = `expected_amount`
- Define `payment_date` = data atual
- Atualiza `status` = `paid`

**2.3 Registrar Pagamento Parcial**
- Define `paid_amount` com valor < `expected_amount`
- Define `payment_date` = data do pagamento
- Atualiza `status` = `partial`

**2.4 Alterar Valor Pago**
- Permitir edição de `paid_amount`
- Recalcular status automaticamente
- Validação: `paid_amount` >= 0

**2.5 Upload de Comprovante**
- **Formatos**: JPG, PNG, PDF
- **Tamanho máximo**: 5MB
- **Armazenamento**: `public/uploads/payment_[uuid].[ext]`
- **Visualização**: Link para download + preview (se imagem)

**2.6 Código PIX**
- Campo de texto livre
- Usado como identificação do pagamento
- Editável inline na tabela de pagamentos

#### 3. Filtros de Pagamentos

**3.1 Filtros Disponíveis**
- **Mês/Ano de Referência**: Dropdown (padrão: mês atual)
- **Status**: Todos, Pago, Pendente, Atrasado, Parcial
- **Local**: Dropdown com todos os locais
- **Busca**: Imóvel ou inquilino

**3.2 Ordenação**
- Clique no cabeçalho da coluna para ordenar
- Opções: Data de vencimento, Valor esperado, Status
- Crescente/Decrescente

#### 4. Impressão de Recibo

**4.1 Componente PaymentReceipt**
- Acessível via botão "Imprimir Recibo" no card de pagamento
- Disponível apenas para pagamentos com status `paid` ou `partial`

**4.2 Dados do Recibo**
```
┌─────────────────────────────────────────────────────────┐
│                    RECIBO DE PAGAMENTO                  │
│                 Gerenciador de Locações                 │
├─────────────────────────────────────────────────────────┤
│  Nº: [ID do pagamento]                                  │
│  Data de Emissão: [Data atual]                          │
├─────────────────────────────────────────────────────────┤
│  DADOS DO IMÓVEL                                        │
│  Endereço: ACÁCIAS - Casa 1                             │
│  Complemento: Casa com quintal                          │
├─────────────────────────────────────────────────────────┤
│  DADOS DO INQUILINO                                     │
│  Nome: João Silva                                       │
│  CPF/CNPJ: 123.456.789-10                               │
├─────────────────────────────────────────────────────────┤
│  DETALHES DO PAGAMENTO                                  │
│  Período de Referência: Novembro/2025                   │
│  Data de Vencimento: 05/11/2025                         │
│  Data de Pagamento: 03/11/2025                          │
│  Valor Pago: R$ 1.200,00                                │
│  Forma de Pagamento: PIX                                │
├─────────────────────────────────────────────────────────┤
│  Observações: Pagamento realizado via PIX               │
├─────────────────────────────────────────────────────────┤
│  ___________________________                             │
│  Assinatura do Proprietário                             │
└─────────────────────────────────────────────────────────┘
```

**4.3 Geração**
- Componente React com dados formatados
- Função `window.print()` para impressão
- CSS `@media print` para otimizar layout

#### 5. Edição Inline de Código PIX

**5.1 Funcionalidade**
- Clique no ícone de lápis → Campo de input
- Editar código PIX diretamente na tabela
- Botões: Salvar / Cancelar

**5.2 Validação**
- Permitir qualquer string alfanumérica
- Salvar na tabela `payments` → campo `payment_code`

#### 6. Card de Pagamento

**6.1 Layout do Card**
```
┌──────────────────────────────────────────────────┐
│  🏠 ACÁCIAS                    Parcela 5/18       │
│  Casa 1                        [Status Badge]    │
│  👤 João Silva                                    │
│  📞 (11) 98765-4321                               │
│  📅 Vencimento: 05/11/2025                        │
│                                                   │
│  Valor Esperado                                   │
│  R$ 1.200,00                                      │
│                                                   │
│  [Gerenciar Pagamento] [Imprimir Recibo]         │
└──────────────────────────────────────────────────┘
```

**6.2 Informações Exibidas**
- Local e complemento do imóvel
- Número da parcela (ex: 5/18)
- Nome e telefone do inquilino
- Data de vencimento
- Valor esperado (destaque)
- Status com badge colorido
- Botões de ação

### Histórico de Pagamentos, Recibo por Entrada e Exclusão (NOVO — Agosto/2026)

- Cada pagamento (total ou parcial) registrado num recebimento vira uma
  entrada em `payments.partial_payments` (JSONB), com
  `{ amount, expected_amount, payment_date, payment_method, notes,
  attachments, registered_at }` — em vez de só sobrescrever `paid_amount`.
- A tela de "Gerenciar Pagamento" mostra esse histórico com um botão de
  recibo numerado por entrada (1, 2, 3...), permitindo emitir o recibo de
  cada pagamento separadamente.
- **Excluir um recibo/pagamento específico** do histórico: recalcula
  `paid_amount` e `status` a partir do que sobrou no histórico.
- **Cancelar o recebimento** (voltar para pendente) também limpa todo o
  histórico de `partial_payments`, não deixando entradas órfãs.
- Corrigido também um travamento da página que acontecia ao fechar diálogos
  de confirmação em sequência (ex.: confirmar exclusão de um recibo logo
  depois de outra ação) — o `AlertContext` não liberava o controle de
  scroll/pointer-events do fundo da página corretamente.

### Sincronização de Recebimentos ao Editar Locação (NOVO — Agosto/2026)

Quando o valor do aluguel de uma locação é alterado (edição da Locação), os
recebimentos futuros e vencidos são recalculados automaticamente para
refletir o novo valor:

- **Recebimentos com status `overdue` (atrasado)** também são recalculados
  — antes só os `pending` eram atualizados, então um recebimento já vencido
  continuava mostrando o valor antigo mesmo depois de o aluguel ser
  reajustado na locação.
- A correção do **valor da garagem** (`garage_value`) usada nesse
  recálculo também foi corrigida para não usar um valor desatualizado
  (parado no valor antigo do imóvel).
- A lógica de sincronização, que estava duplicada entre
  `rentalUpdateService.ts` e `paymentService.ts` (podendo gerar resultados
  diferentes dependendo de qual caminho de código rodava primeiro), foi
  unificada em `rentalUpdateService.ts`. `paymentService.ts` não sincroniza
  mais recebimentos por conta própria.
- **Recebimentos que já estavam desatualizados antes dessa correção**
  foram corrigidos manualmente via SQL direto no banco (não retroativo por
  código — é uma correção pontual dos dados já existentes).

---

## 💰 Caução

### Tipos de Pagamento

| Tipo | Descrição |
|------|-----------|
| **À vista** | Caução pago integralmente no primeiro mês |
| **Parcelado em 2x** | Caução dividido em 2 parcelas (1º e 2º mês) |
| **Parcelado em 3x** | Caução dividido em 3 parcelas (1º, 2º e 3º mês) |

> ⚠️ **Status:** dois bugs relacionados ao parcelamento do caução foram
> corrigidos no código (commits `f9d2eb5d` e `0414ca4b`) e estão
> aguardando `git push` + deploy + teste manual em produção antes de
> serem considerados encerrados:
>
> 1. **Edição** de uma locação já criada não atualizava corretamente o
>    número de parcelas (só mexia nas que já existiam, sem criar as que
>    faltavam nem remover as que sobravam) — [issue #13 do GitHub](https://github.com/CaduCondo/sistemaDuvoEnterprise/issues/13).
> 2. **Criação** de uma locação nova com caução em 2x ou 3x só salvava a
>    1ª parcela (as parcelas 2 e 3 eram descartadas silenciosamente,
>    porque dois pontos do código tentavam criar as parcelas na mesma
>    operação) — [issue #14 do GitHub](https://github.com/CaduCondo/sistemaDuvoEnterprise/issues/14).
>
> Acompanhar status em ambos no [kanban interno](https://duvoenterprise.com.br/kanban).

### Criação do parcelamento numa locação nova

Ao criar uma locação com "Caução Parcelado?" marcado, `rentalService.create()`
é o único ponto que cria as parcelas em `deposit_installments` — antes da
correção da issue #14, o `RentalFormDialog.tsx` também tentava criar as
parcelas certas logo em seguida, e a trava de duplicidade descartava essa
2ª tentativa por completo, sem avisar o usuário.

- **1 parcela (à vista):** cria 1 registro com o valor e vencimento
  informados.
- **2 ou 3 parcelas:** cria um registro por parcela, cada um com seu
  próprio valor e vencimento (2ª e 3ª parcelas só são criadas se tiverem
  valor preenchido no formulário).
- **Vencimento da 1ª parcela:** usa a data informada no formulário; só
  cai para a data de início do contrato como último recurso, se nenhuma
  data foi informada.
- **Código PIX preenchido na 1ª parcela:** a parcela já é criada com
  `status = "paid"` (mesmo comportamento de antes, agora sempre aplicado).
- Essa lógica fica em `buildInitialDepositInstallments()`, em
  `depositInstallmentService.ts`, e é testada isoladamente em
  `depositInstallmentService.test.ts`.

### Edição do parcelamento numa locação existente

Ao editar uma locação e mudar o número de parcelas do caução, o sistema
sincroniza a tabela `deposit_installments` para refletir a nova
configuração:

- **Aumentar o número de parcelas** (ex.: 1 → 3): as parcelas que já
  existiam são atualizadas com os novos valores/vencimentos, e as que
  faltam são criadas.
- **Diminuir o número de parcelas** (ex.: 3 → 1): as parcelas que deixam
  de existir são removidas, exceto parcelas já pagas (ver regra abaixo).
- **Parcela já paga (`status = "paid"`):** nunca tem valor ou vencimento
  sobrescritos por uma edição de locação, e nunca é excluída
  automaticamente — só é excluída manualmente pelo próprio recebimento de
  caução (Financeiro > Cauções), o que reabre a parcela para cobrança.
- **Limite para reduzir a quantidade de parcelas:** não é possível
  configurar uma quantidade de parcelas menor que a quantidade de parcelas
  já pagas (não importa qual parcela — 1ª, 2ª ou 3ª — está paga, só a
  quantidade). Por exemplo, se 2 das 3 parcelas já foram pagas, só é
  possível reduzir para 2 parcelas ou manter em 3; tentar reduzir para 1
  mostra uma mensagem explicando o motivo. Para reduzir de verdade abaixo
  disso, é preciso excluir antes o(s) recebimento(s) de caução já pago(s)
  em Financeiro > Cauções.
- Essa lógica de decisão (o que criar/atualizar/remover) fica em
  `planDepositInstallmentsSync()`, em `depositInstallmentService.ts`, e é
  testada isoladamente em `depositInstallmentService.test.ts`.

### Tabela deposit_installments

**Estrutura:** O sistema mantém um registro separado para cada parcela de caução na tabela `deposit_installments`.

**Campos principais:**
- `id` (UUID): Identificador único da parcela
- `rental_id` (UUID): Referência para a locação
- `installment_number` (INTEGER): Número da parcela (1, 2 ou 3)
- `installment_total` (INTEGER): Total de parcelas do caução
- `amount` (DECIMAL): Valor desta parcela
- `due_date` (DATE): Data de vencimento (calculada automaticamente)
- `payment_date` (DATE): Data de pagamento da parcela
- `pix_code` (TEXT): Código PIX para comprovação de pagamento
- `partner_commission` (DECIMAL): Comissão do corretor parceiro (única vez)
- `internal_commission` (DECIMAL): Comissão do corretor interno (única vez)
- `status` (TEXT): Status da parcela (pending, paid, overdue)

### Datas de Vencimento das Parcelas

**IMPORTANTE:** O sistema usa campos específicos na tabela `rentals` para determinar as datas de vencimento:

| Parcela | Campo em rentals | Descrição |
|---------|------------------|-----------|
| 1ª parcela | `deposit_payment_date` | Data de pagamento da primeira parcela (campo "Data Pagamento" no formulário) |
| 2ª parcela | `deposit_installment2_payment_date` | Data de vencimento da segunda parcela |
| 3ª parcela | `deposit_installment3_payment_date` | Data de vencimento da terceira parcela |

**Exemplo:**
- Locação criada: 01/07/2025
- Caução: R$ 1.200,00 em 3x
- Data Pagamento: 01/07/2025
- Data Vencimento 2ª Parcela: 01/08/2025
- Data Vencimento 3ª Parcela: 01/09/2025

**Resultado:**
- Parcela 1/3: R$ 400,00 - Vencimento 01/07/2025
- Parcela 2/3: R$ 400,00 - Vencimento 01/08/2025
- Parcela 3/3: R$ 400,00 - Vencimento 01/09/2025

### Cálculo das Parcelas

**Regra:** Divisão igualitária com ajuste de centavos na última parcela

**Exemplo 1 - Caução R$ 1.000,00 em 3x:**
- 1ª parcela: R$ 333,33
- 2ª parcela: R$ 333,33
- 3ª parcela: R$ 333,34 (ajuste de R$ 0,01)

**Exemplo 2 - Caução R$ 1.234,56 em 2x:**
- 1ª parcela: R$ 617,28
- 2ª parcela: R$ 617,28

### Comissões de Caução

**Importante:** As comissões são registradas UMA ÚNICA VEZ no sistema, mesmo quando o caução é parcelado.

**Campos na tabela deposit_installments:**
- `partner_commission`: Valor da comissão do corretor parceiro
- `internal_commission`: Valor da comissão do corretor interno

**Regra de negócio:**
- Valores são definidos na criação da locação
- Comissões aplicam-se ao valor **total** do caução, não por parcela
- Exibidas no relatório financeiro de cauções
- Apenas parcelas da mesma locação compartilham os mesmos valores de comissão (rowspan na tabela)

**Exemplo:**
- Caução: R$ 1.200,00 (3x de R$ 400,00)
- Comissão Parceiro: R$ 360,00 (30% do total)
- Comissão Interno: R$ 240,00 (20% do total)

**Exibição na tabela:**
```
┌─────────────────────────────────────────────────────────┐
│ Local | Inquilino | Corretor | Pg Parceiro | Pg Interno│ (Rowspan - mesclado)
│                     Parceiro    R$ 360,00    R$ 240,00 │
├─────────────────────────────────────────────────────────┤
│                     Parcela 1/3 | Data | Valor | PIX   │
│                     Parcela 2/3 | Data | Valor | PIX   │
│                     Parcela 3/3 | Data | Valor | PIX   │
└─────────────────────────────────────────────────────────┘
```

### Controle de Recebimento

**Sistema de verificação:**
- Uma parcela é considerada **recebida** quando o campo `pix_code` está preenchido
- Status `paid` indica parcela paga
- Status `pending` indica parcela não paga
- Status `overdue` indica parcela atrasada

**Código PIX:**
- Campo opcional para cada parcela
- Serve como comprovação de pagamento
- Pode ser editado inline no relatório financeiro
- Facilita rastreamento e reconciliação

### Edição Inline no Relatório Financeiro

**Admin e Broker podem editar diretamente na tabela:**

1. **Código PIX** - Clique no ícone de lápis:
   - Campo de texto livre
   - Salva em `deposit_installments.pix_code`
   - Ao preencher, linha fica verde (recebido)

2. **Comissões** - Clique no valor para editar:
   - Comissão Parceiro: `deposit_installments.partner_commission`
   - Comissão Interno: `deposit_installments.internal_commission`
   - Máscara de moeda automática
   - Atualiza KPIs em tempo real

3. **Valor da Parcela** - Editável inline:
   - Campo: `deposit_installments.amount`
   - Útil para ajustes ou correções
   - Recalcula totais automaticamente

4. **Valor Devolvido** (apenas contratos cancelados):
   - Campo: `rentals.returned_deposit_amount`
   - Exibido apenas quando filtro ≠ "Ativas"
   - Mesclado (rowspan) - um valor por locação
   - Usado para registrar quanto foi efetivamente devolvido ao inquilino

### Valor Devolvido

**Funcionalidade para contratos cancelados:**

Quando um contrato é cancelado/rescindido, o sistema permite registrar o valor do caução que foi devolvido ao inquilino.

**Campo:** `returned_deposit_amount` na tabela `rentals`

**Regras:**
- Visível apenas para contratos com `status != 'active'`
- Editável inline no relatório financeiro (aba Cauções)
- Valor pode ser menor que o caução original (descontos por danos, etc.)
- Exibido em vermelho na coluna "Valor Devolvido"
- Mesclado (rowspan) - um valor único por locação

**Exemplo de uso:**
- Caução pago: R$ 1.200,00
- Danos no imóvel: R$ 300,00
- **Valor devolvido:** R$ 900,00

### Correção por IGPM

**IMPORTANTE:** Na rescisão do contrato, o caução é corrigido pelo IGPM acumulado.

**Processo:**

1. Sistema busca o **IGPM acumulado** do período da locação
2. Aplica correção sobre o valor total do caução pago
3. **Devolução:** Valor corrigido é abatido no recebimento do último mês

**Fórmula:**
```
Caução Corrigido = Caução Original × (1 + IGPM_Acumulado/100)
```

**Exemplo:**
- Caução original: R$ 1.200,00
- IGPM acumulado no período: 8,5%
- **Caução corrigido:** R$ 1.200,00 × 1,085 = R$ 1.302,00

**Observação:** O valor corrigido pelo IGPM é usado nos cálculos de rescisão. O campo `returned_deposit_amount` serve para registrar o valor efetivamente devolvido (que pode ser diferente devido a descontos).

### Isenção de Taxa no Caução

**Regra:** Taxa administrativa **NÃO é aplicada** sobre o valor do caução

**Motivo:** Caução é uma garantia, não é receita da administradora

### Recebimentos de Caução na Tela de Recebimentos (NOVO — Agosto/2026)

**O que mudou:** além de aparecerem no relatório "Detalhamento dos Cauções"
(aba Financeiro), as parcelas de caução agora também aparecem **junto com
as parcelas de aluguel na tela Recebimentos** — antes só o aluguel aparecia
lá.

**Como diferenciar caução de aluguel na tela de Recebimentos:**
- Badge/borda na cor **indigo/roxo** com o texto **"CAUÇÃO"** no dialog de
  gerenciamento (`DepositPaymentDialog.tsx`), contra o visual padrão do
  aluguel (`ManagePaymentForm.tsx`)
- O layout e os campos são propositalmente muito parecidos com o de
  aluguel (mesmas seções de informações da locação, mesmos campos de
  valor/data/forma de pagamento/anexos) — a intenção é reduzir a curva de
  aprendizado, mantendo a cor/badge como diferenciador principal

**Histórico de pagamentos + recibo por pagamento (igual ao aluguel):**
- Cada pagamento (total ou parcial) registrado numa parcela de caução vira
  uma entrada em `deposit_installments.partial_payments` (JSONB)
- A tela de Recebimentos mostra um botão de recibo numerado por entrada do
  histórico (1, 2, 3...), igual já acontecia com aluguel
- O recibo de caução (`DepositReceipt.tsx`) segue o mesmo layout/texto do
  recibo de aluguel (`PaymentReceipt.tsx`), com as substituições
  específicas de caução:
  - Título "RECIBO DE CAUÇÃO" (em vez de "RECIBO DE ALUGUEL")
  - Indicador de parcela mostra a parcela do **caução** (ex: "1/3"), não a
    parcela do contrato de aluguel
  - Texto "Recebi de [inquilino]... proveniente ao depósito de caução
    referente ao mês de [mês/ano do vencimento da parcela]..." (sem menção a
    água/luz, que é específica do recibo de aluguel)
  - Bloco de valores mostra "Caução:" em vez de "Aluguel:"
  - Mesma assinatura, botões (Imprimir/WhatsApp/Baixar PDF/Fechar) e rodapé
    de Vencimento/Pagamento do recibo de aluguel

**Trava de edição quando a parcela está paga:**
- Quando o status da parcela de caução é `paid`, a tela abre **somente
  leitura** (campos desabilitados) — igual já acontecia no recebimento de
  aluguel
- A multa e os juros **não continuam contando** depois que a parcela foi
  paga: ficam congelados nos valores históricos (`penalty_amount` /
  `interest_amount` da parcela), em vez de recalcular com base na data
  atual
- Para alterar algo numa parcela já paga, é preciso clicar no botão
  **"Editar"** (mesmo padrão do botão "Editar" do recebimento de aluguel)

**Exclusão de pagamentos individuais ou de todos:**
- Cada entrada do histórico pode ser excluída individualmente (recalcula
  `paid_amount`/status a partir do restante do histórico)
- Também é possível excluir **todos** os recebimentos da parcela de uma vez
  (zera `partial_payments`, volta a parcela para `pending`)

---

## 🔚 Rescisão de Contrato

> Atualizado em **28/ago/2026** (issue #49). Antes desta entrega, a rescisão
> gerava **um** recebimento só, misturando aluguel e devolução do caução — e
> o caução, que é dinheiro de terceiro, entrava na base das taxas de
> administração e gerenciamento, distorcendo todos os relatórios.

### A regra central: dois recebimentos, nunca um

Toda rescisão gera **dois** registros ligados entre si por
`termination_group_id`, distinguidos pela coluna `payment_kind`:

| `payment_kind` | O quê | Onde aparece | Entra na base das taxas? |
|---|---|---|---|
| `rent` | aluguel proporcional + garagem proporcional + multa rescisória | Financeiro → **Locações** | **Sim** |
| `termination` | devolução do caução + despesas adicionais + desconto | Financeiro → **Cauções** | **Não** |

> ⚠️ `payment_kind` é a **única** fonte de verdade sobre o tipo de um
> recebimento. Já houve três defeitos causados por decidir isso lendo o
> texto do campo Observações — o recebimento de aluguel escreve
> "Rescisão de Contrato…" e o de rescisão escreve "Recebimento de
> Rescisão…", então a comparação por texto acerta o registro errado.
> Texto de observação é para o usuário ler, nunca para o sistema decidir
> regra.

### O que acontece com o recebimento do mês da rescisão

Depende do status que ele tinha:

| Status do mês | O que acontece | Composição do novo recebimento |
|---|---|---|
| **Pendente** | o antigo é **deletado** (não houve pagamento) | Aluguel + Aluguel Proporcional + Garagem + Garagem Proporcional + Multa Rescisória |
| **Pago** ou **Parcial** | o antigo é **preservado** (é histórico) | Aluguel Proporcional + Garagem Proporcional + Multa Rescisória |

Parcelas com vencimento **posterior** à data da rescisão são apagadas em
ambos os casos.

### Devolução do caução

- A correção incide sobre o valor **efetivamente pago**, nunca sobre o
  contratado. Caução de R$ 6.000,00 em 3x com 2 parcelas pagas devolve
  sobre R$ 4.222,22 — não sobre os R$ 6.000,00.
- Caução nunca pago: **nada a devolver**.
- A correção usa a **Taxa da Poupança**, do último pagamento até a data da
  rescisão. O detalhe mês a mês fica no tooltip da tela.
- Uma parcela marcada como paga com valor R$ 0,00 é dado inconsistente
  (defeito antigo do `markDepositInstallmentAsPaid`): vale o valor da
  parcela.

### Sinais no Recebimento de Rescisão

    Valor Total = Devolução de Caução + Despesas Adicionais + Valor Desconto

| Parcela | Sinal | Significado |
|---|---|---|
| Devolução de caução | negativo | dinheiro sai da imobiliária |
| Despesas adicionais | positivo | cobrança do inquilino (reforma, limpeza, pintura) |
| Valor de desconto | negativo | concedido ao inquilino |

**Total negativo** = a imobiliária paga o inquilino.
**Total positivo** = o inquilino paga.

Valores negativos aparecem **em vermelho** em todas as telas e listas.

### Multa rescisória

Sempre uma das duas cláusulas do contrato — proporcional ao tempo restante,
ou cláusula de 12 meses. **Não existe campo de multa livre.** Desconto,
arredondamento ou perdão da multa se fazem no campo "Valor de Desconto" do
Recebimento de Rescisão, onde ficam registrados como desconto em vez de
escondidos dentro da multa.

### Valor Total da Rescisão

Quando dois recebimentos da mesma locação vencem no mesmo dia — o que é
como uma rescisão fecha — as telas mostram, abaixo do `VALOR TOTAL`, a
linha `VALOR TOTAL DA RESCISÃO` com a soma dos dois. O inquilino costuma
pagar tudo de uma vez.

### O que esta entrega NÃO resolve

**As rescisões anteriores a esta migração continuam no formato antigo**, com
o caução misturado, e seguem distorcendo a base das taxas. Corrigi-las é
uma migração de dados própria, ainda não feita.

---

## 📊 Financeiro

### Objetivo
Apresentar relatórios financeiros consolidados com foco em receitas, despesas e análise de cauções.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Financeiro                                             │
│  [Detalhamento de Locações] [Detalhamento de Cauções]  │
├─────────────────────────────────────────────────────────┤
│  Filtros:                                               │
│  [Mês ▼] [Ano ▼] [Local ▼] [Filtrar]                  │
├─────────────────────────────────────────────────────────┤
│  KPIs FINANCEIROS                                       │
│  [Receita Bruta] [Taxa Admin] [Taxa Ger.] [Contas] [Líquida] │
├─────────────────────────────────────────────────────────┤
│  TABELA DE DETALHAMENTO                                 │
│  [Exportar Excel] [Imprimir]                            │
│  [...dados...]                                          │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Abas do Financeiro

**1.1 Aba "Detalhamento de Locações"**
- Padrão ao abrir a página
- Disponível para: Admin, Broker, Financial
- Exibe KPIs e tabela de pagamentos
- Financial vê apenas locais permitidos

**1.2 Aba "Detalhamento de Cauções"**
- Disponível apenas para: Admin, Broker
- Financial **não** tem acesso (tab oculta)
- Exibe KPIs e tabela de parcelas de caução
- Inclui edição de comissões inline

#### 2. KPIs de Locações

**2.1 Receita Bruta**
- **Fórmula**: Soma de `paid_amount` dos pagamentos com status `paid` ou `partial`
- **Período**: Filtrado por mês/ano selecionado
- **Query**:
```sql
SELECT SUM(paid_amount) 
FROM payments 
WHERE reference_month = X 
  AND reference_year = Y 
  AND status IN ('paid', 'partial')
```
- **Cor**: Verde
- **Formato**: R$ 1.234,56

**2.2 Taxa de Administração**
- **Fórmula**: `Receita Bruta × (percentual_taxa_admin / 100)`
- **Percentual**: Configurável em `config` (padrão: 5%)
- **Exceção**: Imóveis com isenção de taxa (`user_fee_exemptions`) não entram no cálculo
- **Query**:
```sql
SELECT SUM(paid_amount * (taxa_admin / 100))
FROM payments p
LEFT JOIN user_fee_exemptions e ON p.rental.property.location_id = e.location_id
WHERE e.id IS NULL  -- Não tem isenção
```
- **Cor**: Laranja
- **Formato**: R$ 1.234,56

**2.3 Taxa de Gerenciamento**
- **Fórmula**: `Receita Bruta × (percentual_taxa_gerenciamento / 100)`
- **Percentual**: Configurável em `config` (padrão: 3%)
- **Exceção**: Mesma lógica de isenção da taxa de administração
- **Cor**: Amarelo
- **Formato**: R$ 1.234,56

**2.4 Contas do Mês**
- **Fórmula**: Soma de `amount` da tabela `location_expenses`
- **Período**: Filtrado por `reference_month` e `reference_year`
- **Tipos de despesas**: 
  - Água
  - Luz
  - Internet
  - Manutenção
  - Condomínio
  - IPTU
  - Limpeza
  - Segurança
  - Outros
- **Query**:
```sql
SELECT SUM(amount)
FROM location_expenses
WHERE reference_month = X
  AND reference_year = Y
```
- **Cor**: Vermelho
- **Formato**: R$ 1.234,56

**2.5 Receita Líquida**
- **Fórmula**: `Receita Bruta - Taxa Admin - Taxa Gerenciamento - Contas do Mês`
- **Descrição**: Valor final disponível para repasse ao proprietário
- **Cor**: Verde escuro
- **Formato**: R$ 1.234,56

#### 3. Tabela de Detalhamento de Locações

**3.1 Colunas**
| Coluna | Descrição | Editável |
|--------|-----------|----------|
| Parcela | Ex: 5/18 | Não |
| Local | Nome do local | Não |
| Complemento | Casa 1, Apto 201 | Não |
| Inquilino | Nome do inquilino | Não |
| Ano | Ano de referência | Não |
| Mês | Mês de referência | Não |
| Status | Badge colorido | Não |
| Data Venc. | dd/mm/aaaa | Não |
| Data Recebida | dd/mm/aaaa | Não |
| Valor Esperado | R$ 1.234,56 | Não |
| Valor Pago | R$ 1.234,56 (verde) | Não |
| Código PIX | Chave PIX | **Sim** |

**3.2 Linha de Totais**
- Última linha da tabela
- **Valor Esperado (Total)**: Soma de todas as colunas `expected_amount`
- **Valor Pago (Total)**: Soma de todas as colunas `paid_amount`
- Fundo cinza com texto em negrito
- Valores formatados em moeda brasileira

**3.3 Ordenação**
- Clique no cabeçalho da coluna para ordenar
- Ícones: ↕️ (neutro), ↑ (crescente), ↓ (decrescente)
- Suporta ordenação por múltiplas colunas
- Mantém linha de totais sempre no final

**3.4 Edição de Código PIX Inline**
- Clique no ícone de lápis (✏️) → Campo de input
- Editar código PIX diretamente na célula
- Botões: ✅ Salvar / ❌ Cancelar
- Salva na tabela `payments.payment_code`
- Atualização em tempo real

**3.5 Exportação para Excel**
- Botão "Exportar Excel"
- Formato: `Financeiro_Locacoes_[Mês]_[Ano].xlsx`
- Inclui todas as colunas visíveis
- Linha de totais incluída
- Valores formatados em moeda brasileira
- Headers em negrito

**3.6 Impressão**
- Botão "Imprimir"
- CSS `@media print` remove:
  - Cabeçalho do sistema
  - Menu lateral
  - Botões de ação
  - Filtros
- Tabela formatada para papel A4 paisagem
- Mantém linha de totais

#### 4. KPIs de Cauções

**4.1 Valor Bruto Esperado**
- **Fórmula**: Soma de `amount` de todas as parcelas de caução
- **Filtro**: Status de locação (ativo/inativo/todos)
- **Query**:
```sql
SELECT SUM(amount)
FROM deposit_installments di
JOIN rentals r ON di.rental_id = r.id
WHERE r.is_active = [filtro]
```
- **Cor**: Azul
- **Formato**: R$ 1.234,56

**4.2 Valor Bruto Recebido**
- **Fórmula**: Soma de `amount` das parcelas com `pix_code` preenchido
- **Lógica**: Considera código PIX como comprovante de pagamento
- **Query**:
```sql
SELECT SUM(amount)
FROM deposit_installments
WHERE pix_code IS NOT NULL AND pix_code != ''
```
- **Cor**: Verde
- **Formato**: R$ 1.234,56

**4.3 Comissão Total**
- **Fórmula**: Soma de `partner_commission` + `internal_commission`
- **Observação**: Valores únicos por locação (não por parcela)
- **Query**:
```sql
SELECT SUM(DISTINCT partner_commission) + SUM(DISTINCT internal_commission)
FROM deposit_installments
GROUP BY rental_id
```
- **Cor**: Laranja
- **Formato**: R$ 1.234,56

**4.4 Receita Líquida**
- **Fórmula**: `Valor Bruto Recebido - Comissão Total`
- **Descrição**: Valor líquido após deduzir comissões
- **Cor**: Verde escuro
- **Formato**: R$ 1.234,56

#### 5. Tabela de Detalhamento de Cauções

**5.1 Estrutura de Agrupamento**
```
┌─────────────────────────────────────────────────────────┐
│ Local | Compl. | Inquil. | Aluguel | Total Caução | ... │ (Rowspan)
├─────────────────────────────────────────────────────────┤
│                     Parcela 1/3 | Data | Valor | PIX   │
│                     Parcela 2/3 | Data | Valor | PIX   │
│                     Parcela 3/3 | Data | Valor | PIX   │
├─────────────────────────────────────────────────────────┤
│ Local | Compl. | Inquil. | Aluguel | Total Caução | ... │ (Rowspan)
├─────────────────────────────────────────────────────────┤
│                     Parcela 1/2 | Data | Valor | PIX   │
│                     Parcela 2/2 | Data | Valor | PIX   │
└─────────────────────────────────────────────────────────┘
```

**5.2 Colunas Agrupadas (Rowspan)**
- **Local**: Nome do local
- **Complemento**: Casa 1, Apto 201
- **Inquilino**: Nome do inquilino
- **Valor Aluguel**: Valor mensal do aluguel
- **Valor Total Caução**: Valor total do caução
- **Corretor Parceiro**: Sim/Não
- **Pg Corretagem Parceiro**: Valor (editável inline)
- **Pg Corretagem Interno**: Valor (editável inline)

**5.3 Colunas Individuais (Por Parcela)**
- **Parcela**: Ex: 1/3, 2/3, 3/3
- **Data Pagamento**: dd/mm/aaaa
- **Valor Parcela**: R$ 1.234,56
- **Código PIX**: Chave PIX (editável inline)

**5.4 Coloração de Linhas**
```typescript
SE pix_code IS NOT NULL AND pix_code != '':
  backgroundColor = 'bg-green-50' // Verde claro (paga)
SENÃO:
  backgroundColor = 'bg-red-50'   // Vermelho claro (pendente)
```

**5.5 Edição de Comissões Inline**
- Clique no ícone de lápis (✏️) → Campo de input com máscara de moeda
- Editar valores de comissão diretamente na célula
- Botões: ✅ Salvar / ❌ Cancelar
- Salva em:
  - `deposit_installments.partner_commission`
  - `deposit_installments.internal_commission`
- Validação: Valor >= 0
- Atualização em tempo real

**5.6 Edição de Código PIX Inline**
- Funcionalidade idêntica à tabela de locações
- Atualiza campo `pix_code` da tabela `deposit_installments`
- Muda cor da linha automaticamente (verde = recebido)

**5.7 Filtro de Status de Locação**
- Dropdown: **Ativos** / **Inativos** / **Todos**
- Filtra por `rentals.is_active`
- Atualiza KPIs e tabela automaticamente

**5.8 Linha de Totais**
```
┌─────────────────────────────────────────────────────────┐
│ TOTAIS                                                   │
├─────────────────────────────────────────────────────────┤
│ Valor Total Caução (soma única por locação)             │
│ Comissão Parceiro (soma única por locação)              │
│ Comissão Interno (soma única por locação)               │
│ Valor Parcela (soma de todas as parcelas individuais)   │
└─────────────────────────────────────────────────────────┘
```
- Fundo cinza escuro (`bg-gray-200`)
- Texto em negrito
- Valores formatados em moeda

#### 6. Permissões por Perfil

**6.1 Usuário Financial**
- **Locações**: Visualiza apenas dados de locais permitidos (`user_location_permissions`)
- **KPIs**: Calculados apenas com dados permitidos
- **Tabelas**: Filtradas por `location_id`
- **Cauções**: **SEM ACESSO** (aba oculta)

**6.2 Usuário Admin/Broker**
- **Acesso Total**: Visualiza todos os dados sem restrição
- **Locações**: Acesso completo
- **Cauções**: Acesso completo
- **Edição**: Pode editar comissões e códigos PIX

---

## ⚙️ Configurações

### Objetivo
Centralizar configurações globais do sistema, gerenciar usuários, permissões e despesas.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Configurações                                          │
│  [Gerais] [Usuários] [Permissões] [Despesas Locais]    │
├─────────────────────────────────────────────────────────┤
│  [...conteúdo da aba selecionada...]                   │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Aba "Configurações Gerais"

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Taxas Administrativas                                  │
│  Taxa de Administração (%): [_____] (padrão: 5%)       │
│  Taxa de Gerenciamento (%): [_____] (padrão: 3%)       │
│  [Salvar Configurações]                                 │
└─────────────────────────────────────────────────────────┘
```

**1.1 Taxa de Administração**
- **Valor padrão**: 5%
- **Aplicação**: Sobre receita bruta de locações
- **Editável**: Apenas por Admin
- **Persistência**: Tabela `config` (chave: `admin_fee_percentage`)

**1.2 Taxa de Gerenciamento**
- **Valor padrão**: 3%
- **Aplicação**: Sobre receita bruta de locações
- **Editável**: Apenas por Admin
- **Persistência**: Tabela `config` (chave: `management_fee_percentage`)

**1.3 Validações**
- Valores devem ser >= 0 e <= 100
- Formato: Número decimal com 2 casas

#### 2. Aba "Usuários"

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Usuários do Sistema                      [+ Novo]      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │  João Silva                    [Admin]           │   │
│  │  joao@email.com                                  │   │
│  │  [Editar] [Excluir]                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**2.1 Perfis (Roles)**
- `admin`: Acesso total ao sistema
- `broker`: Acesso a gestão de locações e financeiro
- `financial`: Acesso apenas a dados financeiros de locais permitidos
- `user`: Acesso básico (futuro)

**2.2 Cadastro de Usuário**
- **Email**: Único, formato válido
- **Nome completo**: Obrigatório
- **Senha**: Mínimo 6 caracteres (somente no cadastro)
- **Perfil (role)**: Obrigatório
- **Status**: Ativo/Inativo

**2.3 Validações**
- Email deve ser único no sistema
- Senha mínima de 6 caracteres
- Perfil deve ser válido (admin, broker, financial, user)

**2.4 Autenticação**
- Sistema usa Supabase Auth
- Login via email + senha
- Sessão persistida em localStorage
- Token JWT para API

**2.5 Exclusão de Usuário**
- Admin pode excluir qualquer usuário
- **Não pode excluir a si mesmo**
- Confirmação obrigatória via AlertDialog
- **Cascata**: Remover permissões associadas

**2.6 Edição de Usuário**
- Todos os campos são editáveis exceto email
- Senha só pode ser alterada pelo próprio usuário (não implementado)
- Alteração de perfil atualiza permissões automaticamente

#### 3. Aba "Permissões"

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Gerenciar Permissões                                   │
│  Usuário: [Selecionar Usuário ▼]                       │
├─────────────────────────────────────────────────────────┤
│  Permissões de Acesso por Local                         │
│  ☐ ACÁCIAS                                              │
│  ☐ BAMBUÍ                                               │
│  ☐ CEDRO                                                │
│  [Salvar Permissões]                                    │
├─────────────────────────────────────────────────────────┤
│  Isenções de Taxa                                       │
│  ☐ ACÁCIAS                                              │
│  ☐ BAMBUÍ                                               │
│  ☐ CEDRO                                                │
│  [Salvar Isenções]                                      │
└─────────────────────────────────────────────────────────┘
```

**3.1 Permissões por Local**

**Tabela**: `user_location_permissions`

**Funcionalidade**:
- Associa usuário a locais específicos
- Apenas usuários `financial` precisam de permissões explícitas
- Admin/Broker têm acesso a todos os locais automaticamente

**Atribuição**:
1. Admin seleciona usuário no dropdown
2. Sistema carrega locais permitidos (checkboxes marcados)
3. Admin marca/desmarca locais
4. Clica em "Salvar Permissões"
5. Sistema:
   - Deleta permissões antigas do usuário
   - Insere novos registros em `user_location_permissions`

**Validação**:
- Permissões só aplicam-se a usuários `financial`
- Admin/Broker: checkboxes desabilitados (acesso total)
- Remover todas as permissões = sem acesso a nenhum dado

**Efeito no Sistema**:
- Usuário vê apenas:
  - Imóveis dos locais permitidos
  - Locações dos imóveis permitidos
  - Pagamentos das locações permitidas
  - KPIs calculados apenas com dados permitidos

**3.2 Isenções de Taxa**

**Tabela**: `user_fee_exemptions`

**Funcionalidade**:
- Associa usuário a locais isentos de taxa administrativa/gerenciamento
- Ao calcular taxas, ignora receitas desses locais

**Atribuição**:
1. Admin seleciona usuário no dropdown
2. Sistema carrega locais isentos (checkboxes marcados)
3. Admin marca/desmarca locais
4. Clica em "Salvar Isenções"
5. Sistema:
   - Deleta isenções antigas do usuário
   - Insere novos registros em `user_fee_exemptions`

**Efeito nos Cálculos**:
```typescript
Para cada pagamento ao calcular taxas:
  SE location_id do imóvel está em user_fee_exemptions:
    NÃO somar para taxa de administração
    NÃO somar para taxa de gerenciamento
  SENÃO:
    Somar normalmente
```

#### 4. Aba "Despesas de Locais"

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Despesas de Locais                       [+ Nova]      │
│  Filtros: [Mês ▼] [Ano ▼] [Local ▼] [Tipo ▼]          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │  ACÁCIAS                          Nov/2025        │   │
│  │  Tipo: Água                                       │   │
│  │  Valor: R$ 150,00                                 │   │
│  │  Status: Pago                                     │   │
│  │  Descrição: Conta de água                         │   │
│  │  [Editar] [Excluir]                               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**4.1 Tabela `location_expenses`**
- Registra despesas mensais por local
- Entra no cálculo de "Contas do Mês" no Financeiro

**4.2 Tipos de Despesas**
- `water` (Água)
- `electricity` (Luz)
- `internet` (Internet)
- `maintenance` (Manutenção)
- `condominium` (Condomínio)
- `property_tax` (IPTU)
- `cleaning` (Limpeza)
- `security` (Segurança)
- `other` (Outros)

**4.3 Cadastro de Despesa**
- **Local** (location_id): Obrigatório, FK para `locations`
- **Tipo** (type): Obrigatório, dropdown
- **Valor** (amount): Obrigatório, > 0
- **Mês de Referência** (reference_month): 1-12
- **Ano de Referência** (reference_year): Obrigatório
- **Descrição** (description): Opcional
- **Status** (status): `pending` ou `paid`

**4.4 Validações**
- Valor > 0
- Mês entre 1 e 12
- Tipo deve ser válido
- **Não permitir duplicatas** (mesmo local + tipo + mês/ano)

**4.5 Efeito no Financeiro**
- Despesas entram no cálculo de "Contas do Mês"
- Reduzem a receita líquida
- Query:
```sql
SELECT SUM(amount)
FROM location_expenses
WHERE reference_month = X
  AND reference_year = Y
  AND location_id IN (locais permitidos se Financial)
```

**4.6 Filtros**
- Mês/Ano de referência
- Local
- Tipo de despesa
- Status (pago/pendente)

---

## 🌐 Página Pública de Imóveis

### Objetivo
Exibir imóveis disponíveis para locação em uma página pública, permitindo que potenciais inquilinos vejam e demonstrem interesse.

### URLs

| Página | URL | O que mostra |
|---|---|---|
| Lista de anúncios | `/` | Todos os imóveis com status `available` |
| Anúncio individual | `/imovel/[código]` | Um imóvel só — é este o link que se divulga |

**Exemplo**: `https://duvoenterprise.com.br/imovel/0139`

> ⚠️ Corrigido em 23/ago/2026: esta seção documentava a rota
> `/locations/[location_id]`, que **não existe no sistema**. A lista de
> anúncios é a própria página inicial.

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] ACÁCIAS - Imóveis Disponíveis                   │
│  [Compartilhar] [WhatsApp]                              │
├─────────────────────────────────────────────────────────┤
│  Filtros:                                               │
│  [Tipo ▼] [Preço Min-Max] [Quartos ▼] [Ordenar ▼]     │
│  [Modo: Grade/Lista]                                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  [Imagem]   │  │  [Imagem]   │  │  [Imagem]   │     │
│  │  Casa 1     │  │  Casa 2     │  │  Apto 201   │     │
│  │  R$ 1.200   │  │  R$ 1.500   │  │  R$ 800     │     │
│  │  3Q · 2B    │  │  4Q · 3B    │  │  1Q · 1B    │     │
│  │  120m²      │  │  150m²      │  │  45m²       │     │
│  │  [Ver Mais] │  │  [Ver Mais] │  │  [Ver Mais] │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Regras de Negócio

#### 1. Acesso Público
- **SEM autenticação**: qualquer pessoa pode acessar, e isso vale tanto para
  a lista (`/`) quanto para o anúncio individual (`/imovel/[código]`).
- **SEM menu lateral**: layout simplificado.
- **URL compartilhável**: pode ser enviada via WhatsApp, e-mail, etc.

> ⚠️ **Onde isso é decidido no código, e a armadilha que já custou caro.**
>
> Quem libera uma página para visitante sem login é a lista `publicRoutes`,
> em `src/contexts/AuthContext.tsx`. Quem não está nessa lista é mandado para
> a home.
>
> A lista compara com `router.pathname`, que é o **padrão** da rota
> (`/imovel/[id]`), e **não** o endereço que aparece na barra do navegador
> (`/imovel/0139`). Página nova que precise ser pública tem que entrar ali
> com o padrão, do jeito que o arquivo aparece em `src/pages/`.
>
> Em 23/ago/2026 (issue #56) descobriu-se que `/imovel/[id]` nunca tinha sido
> incluída: **todo visitante sem login que abrisse um link de anúncio era
> jogado para a home**, e o imóvel nunca aparecia. Quem estava logado no
> Gerenciador não via o problema — ou seja, o único público afetado era
> exatamente o público-alvo do anúncio.
>
> Coberto agora por um cenário automático marcado com `@smoke`, em
> `e2e/features/11-anuncio-publico.feature`, que abre o link curto **sem
> sessão** e exige continuar na página do anúncio.

#### 2. Imóveis Exibidos
- **Filtro**: Apenas imóveis com `availability = 'available'`
- **Filtro**: Apenas do local especificado na URL (`location_id`)
- **Ordenação padrão**: Mais recentes primeiro

#### 3. Filtros Disponíveis

**3.1 Tipo de Imóvel**
- Dropdown: Todos, Casa, Apartamento, Comercial, Terreno, Quarto
- Filtra por `properties.type`

**3.2 Faixa de Preço**
- Input: Preço mínimo e máximo
- Filtra por `properties.rental_price` (+ `garage_value` se houver)

**3.3 Número de Quartos**
- Dropdown: Todos, 1, 2, 3, 4+
- Filtra por `properties.bedrooms`

**3.4 Ordenação**
- **Mais Recentes**: `created_at DESC`
- **Menor Preço**: `rental_price ASC`
- **Maior Preço**: `rental_price DESC`
- **Maior Área**: `area DESC`

#### 4. Modo de Visualização

**4.1 Modo Grade (Grid)**
- Cards lado a lado (3 colunas em desktop, 1 em mobile)
- Imagem principal como thumbnail
- Informações resumidas

**4.2 Modo Lista**
- Cards em lista vertical (1 por linha)
- Imagem à esquerda, informações à direita
- Mais espaço para descrição

#### 5. Card de Imóvel Público

**Layout**:
```
┌──────────────────────────────────┐
│        [Imagem Principal]        │
├──────────────────────────────────┤
│  Casa 1                          │
│  💰 R$ 1.200,00/mês              │
│  🛏️ 3 Quartos · 🚿 2 Banheiros   │
│  📐 120 m²                       │
│  🚗 Garagem: R$ 200,00           │
│  [Ver Mais Detalhes]             │
└──────────────────────────────────┘
```

**Informações Exibidas**:
- Imagem principal (primeira da galeria)
- Complemento (Casa 1, Apto 201)
- Valor do aluguel
- Número de quartos e banheiros
- Área em m²
- Valor da garagem (se houver)
- Botão para ver detalhes

#### 6. Página de Detalhes Públicos

**URL**: `/locations/[location_id]/[property_id]`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  [← Voltar]  ACÁCIAS - Casa 1                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  Informações                      │
│  │                 │  💰 R$ 1.200,00/mês               │
│  │   [Galeria de   │  🚗 Garagem: R$ 200,00            │
│  │    Imagens]     │  🛏️ 3 Quartos                     │
│  │                 │  🚿 2 Banheiros                    │
│  └─────────────────┘  📐 120 m²                        │
├─────────────────────────────────────────────────────────┤
│  Descrição                                              │
│  Casa ampla com quintal e área de serviço...           │
├─────────────────────────────────────────────────────────┤
│  Demonstrar Interesse                                   │
│  Nome: [___________]                                    │
│  Email: [___________]                                   │
│  Telefone: [___________]                                │
│  Mensagem: [___________]                                │
│  [Enviar]                                               │
└─────────────────────────────────────────────────────────┘
```

**Funcionalidades**:
- Galeria de imagens com lightbox
- Todas as informações do imóvel
- Formulário de interesse (futuro)
- Botão de WhatsApp direto

#### 7. Compartilhamento

**7.1 Botões de Compartilhamento**
- **WhatsApp**: Abre WhatsApp com mensagem pré-formatada
- **Copiar Link**: Copia URL para área de transferência
- **Facebook**: Compartilha no Facebook (futuro)
- **Email**: Abre cliente de email com link (futuro)

**7.2 Mensagem Pré-formatada (WhatsApp)**
```
Olá! Tenho interesse neste imóvel:

ACÁCIAS - Casa 1
Valor: R$ 1.200,00/mês
Quartos: 3 | Banheiros: 2
Área: 120 m²

Link: https://seusite.com/locations/[id]/[property_id]
```

#### 8. Formulário de Interesse (Futuro)
- Nome completo
- Email
- Telefone
- Mensagem (opcional)
- Envio por email ou salvo no sistema

---

## 🔄 Fluxos Completos

### Fluxo 1: Criar Nova Locação com Caução Parcelado

**Cenário**: Criar locação de 12 meses com caução de R$ 1.200 parcelado em 3x

**Passo a Passo**:

1. **Admin/Broker acessa "Locações"**
2. **Clica em "+ Nova Locação"**
3. **Preenche formulário**:
   - Imóvel: ACÁCIAS - Casa 1
   - Inquilino: João Silva
   - Data Início: 01/07/2025
   - Data Fim: 30/06/2026 (12 meses)
   - Valor Aluguel: R$ 1.000,00
   - Dia Vencimento: 5
   - Garagem: Sim (R$ 200,00)
   - Método Pagamento: PIX
   - Código PIX: joao@pix.com
   - Caução: R$ 1.200,00
   - Parcelas Caução: 3x
   - Corretor Parceiro: Não
   - Comissão Interna: R$ 600,00
4. **Clica em "Salvar"**

**Sistema executa**:

```typescript
// 1. Criar registro na tabela rentals
INSERT INTO rentals (
  property_id, tenant_id, start_date, end_date,
  monthly_rent, due_day, has_garage, garage_value,
  payment_method, pix_code, security_deposit, 
  deposit_installments, internal_broker_commission,
  is_active
) VALUES (...)

// 2. Gerar 12 parcelas de aluguel
// Primeira parcela pode ser proporcional
FOR mes = 1 TO 12:
  INSERT INTO payments (
    rental_id, reference_month, reference_year,
    due_date, expected_amount, status, payment_method,
    installment, total_installments
  ) VALUES (...)

// 3. Gerar 3 parcelas de caução
FOR parcela = 1 TO 3:
  INSERT INTO deposit_installments (
    rental_id, installment_number, total_installments,
    installment_total, amount, payment_date,
    internal_commission
  ) VALUES (...)

// 4. Atualizar status do imóvel
UPDATE properties 
SET availability = 'rented' 
WHERE id = property_id

// 5. Atualizar status do inquilino
UPDATE tenants 
SET status = 'renter' 
WHERE id = tenant_id
```

**Resultado Final**:
- ✅ Locação criada com status ativo
- ✅ 12 pagamentos gerados (1/12 até 12/12)
- ✅ 3 parcelas de caução geradas (1/3, 2/3, 3/3)
- ✅ Imóvel marcado como "Alugado"
- ✅ Inquilino marcado como "Locatário"

---

### Fluxo 2: Registrar Pagamento Parcial

**Cenário**: Inquilino pagou R$ 800,00 de um aluguel de R$ 1.200,00

**Passo a Passo**:

1. **Admin/Broker acessa "Pagamentos"**
2. **Filtra por mês/ano da parcela**
3. **Localiza pagamento pendente**
4. **Clica em "Gerenciar Pagamento"**
5. **Preenche formulário**:
   - Valor Pago: R$ 800,00
   - Data Pagamento: 03/11/2025
   - Código PIX: 12345678901234567890
   - Comprovante: [upload de arquivo]
6. **Clica em "Salvar"**

**Sistema executa**:

```typescript
// 1. Atualizar pagamento
UPDATE payments SET
  paid_amount = 800.00,
  payment_date = '2025-11-03',
  payment_code = '12345678901234567890',
  receipt = 'payment_uuid.pdf',
  status = 'partial'  // Calculado: paid_amount < expected_amount
WHERE id = payment_id

// 2. Salvar comprovante
// Arquivo movido para public/uploads/payment_uuid.pdf
```

**Resultado Final**:
- ✅ Pagamento atualizado com valor parcial
- ✅ Status alterado para "Parcial" (badge amarelo)
- ✅ Comprovante salvo e disponível para download
- ✅ Saldo devedor: R$ 400,00

---

### Fluxo 3: Fazer Rescisão de Contrato no 9º Mês

**Cenário**: Locação de 18 meses, rescisão no 9º mês (março/2026)

**Passo a Passo**:

1. **Admin/Broker acessa "Locações"**
2. **Localiza locação ativa**
3. **Clica em "Rescindir Contrato"**
4. **Dialog de Rescisão abre**
5. **Preenche formulário**:
   - Data Rescisão: 20/03/2026
   - Aplicar Multa: Sim (Multa 12 meses = R$ 3.600,00)
   - Sistema calcula automaticamente:
     - Aluguel Proporcional: R$ 800,00 (20 dias de março)
     - Caução Corrigido (IGPM): R$ 1.250,00
     - Valor Final: R$ 800,00 + R$ 3.600,00 - R$ 1.250,00 = **R$ 3.150,00**
6. **Clica em "Confirmar Rescisão"**

**Sistema executa** (função `processContractTermination`):

```typescript
// PASSO 1-7: Calcular e atualizar recebimento de março/2026
UPDATE payments SET
  expected_amount = 3150.00,
  payment_date = '2026-03-20',
  status = 'pending',
  observations = JSON com breakdown dos valores
WHERE rental_id = X AND reference_month = 3 AND reference_year = 2026

// PASSO 7.5: Atualizar data fim do contrato
UPDATE rentals
SET end_date = '2026-03-20'
WHERE id = rental_id

// PASSO 8: Deletar parcelas 10-18 (abril-dezembro/2026)
DELETE FROM payments
WHERE rental_id = X
  AND due_date >= '2026-04-01'

// PASSO 9: Recalcular números de parcela (1/9 até 9/9)
UPDATE payments SET
  installment = ROW_NUMBER,
  total_installments = 9
WHERE rental_id = X
ORDER BY due_date

// PASSO 9.1: Validar deleção
SELECT COUNT(*) FROM payments 
WHERE rental_id = X AND due_date >= '2026-04-01'
-- Deve retornar 0, senão THROW ERROR

// PASSO 9.2: Validar recálculo
SELECT COUNT(*) FROM payments WHERE rental_id = X
-- Deve retornar 9, senão THROW ERROR
```

**Resultado Final**:
- ✅ Parcela 9 (março/2026) atualizada com:
  - Aluguel proporcional (20 dias)
  - + Multa de R$ 3.600,00
  - - Caução corrigido de R$ 1.250,00
  - = Valor final de R$ 3.150,00
- ✅ Data fim do contrato: 20/03/2026 (era 31/12/2026)
- ✅ Parcelas 10-18 deletadas (abril-dezembro/2026)
- ✅ Todas as parcelas renumeradas: 1/9, 2/9... 9/9
- ✅ Imóvel volta para "Disponível"
- ✅ Inquilino volta para "Ativo"

---

### Fluxo 4: Gerar Relatório Financeiro Mensal

**Cenário**: Admin quer visualizar relatório de novembro/2025

**Passo a Passo**:

1. **Admin acessa "Financeiro"**
2. **Aba "Detalhamento de Locações" já selecionada**
3. **Seleciona filtros**:
   - Mês: Novembro
   - Ano: 2025
   - Local: Todos
4. **Clica em "Filtrar"**

**Sistema executa**:

```typescript
// 1. Calcular KPIs
// Receita Bruta
SELECT SUM(paid_amount) 
FROM payments 
WHERE reference_month = 11 
  AND reference_year = 2025 
  AND status IN ('paid', 'partial')
// Resultado: R$ 25.000,00

// Taxa de Administração (5%)
receitaBruta * 0.05 = R$ 1.250,00
(excluindo locais com isenção)

// Taxa de Gerenciamento (3%)
receitaBruta * 0.03 = R$ 750,00
(excluindo locais com isenção)

// Contas do Mês
SELECT SUM(amount)
FROM location_expenses
WHERE reference_month = 11
  AND reference_year = 2025
// Resultado: R$ 500,00

// Receita Líquida
25.000 - 1.250 - 750 - 500 = R$ 22.500,00

// 2. Carregar tabela de pagamentos
SELECT 
  p.*,
  prop.complement,
  loc.name as location_name,
  t.name as tenant_name
FROM payments p
JOIN rentals r ON p.rental_id = r.id
JOIN properties prop ON r.property_id = prop.id
JOIN locations loc ON prop.location_id = loc.id
JOIN tenants t ON r.tenant_id = t.id
WHERE p.reference_month = 11
  AND p.reference_year = 2025
ORDER BY p.due_date

// 3. Calcular totais da tabela
totalEsperado = SUM(expected_amount)
totalPago = SUM(paid_amount)
```

**Resultado Final**:
- ✅ KPIs exibidos no topo
- ✅ Tabela com todos os pagamentos de novembro/2025
- ✅ Linha de totais no final da tabela
- ✅ Botões de exportação e impressão disponíveis

**Ações Disponíveis**:
- **Exportar Excel**: Gera arquivo `Financeiro_Locacoes_Novembro_2025.xlsx`
- **Imprimir**: Abre dialog de impressão do navegador
- **Editar Código PIX**: Clique inline na célula

---

### Fluxo 5: Atribuir Permissões de Local para Usuário Financial

**Cenário**: Admin quer dar acesso ao usuário "Maria" apenas aos locais ACÁCIAS e BAMBUÍ

**Passo a Passo**:

1. **Admin cria usuário "Maria"**:
   - Email: maria@email.com
   - Nome: Maria Silva
   - Perfil: Financial
   - Senha: ******
2. **Admin acessa "Configurações" → "Permissões"**
3. **Seleciona usuário "Maria" no dropdown**
4. **Sistema carrega lista de todos os locais (desmarcados)**
5. **Admin marca checkboxes**:
   - ✅ ACÁCIAS
   - ✅ BAMBUÍ
   - ☐ CEDRO
   - ☐ JACARANDÁ
6. **Clica em "Salvar Permissões"**

**Sistema executa**:

```typescript
// 1. Deletar permissões antigas (se houver)
DELETE FROM user_location_permissions
WHERE user_id = maria_id

// 2. Inserir novas permissões
INSERT INTO user_location_permissions (user_id, location_id)
VALUES 
  (maria_id, acacias_id),
  (maria_id, bambui_id)
```

**Resultado Final**:
- ✅ Maria agora só vê dados de ACÁCIAS e BAMBUÍ
- ✅ Dashboard mostra apenas KPIs desses 2 locais
- ✅ Financeiro exibe apenas pagamentos desses locais
- ✅ Gráficos calculados com dados permitidos

**Teste de Acesso** (Login como Maria):
```
Dashboard:
  - Total de Imóveis: 10 (apenas ACÁCIAS + BAMBUÍ)
  - Receita Bruta: R$ 15.000 (apenas locais permitidos)

Financeiro:
  - Tabela mostra apenas pagamentos de ACÁCIAS e BAMBUÍ
  - KPIs calculados apenas com dados desses locais
```

---

## 🗄️ Estrutura do Banco de Dados

### Principais Tabelas

#### 1. `locations`
```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. `properties`
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id),
  complement TEXT NOT NULL,
  type TEXT NOT NULL, -- house, apartment, commercial, land, room
  area NUMERIC NOT NULL,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  rental_price NUMERIC NOT NULL,
  has_garage BOOLEAN DEFAULT FALSE,
  garage_value NUMERIC,
  description TEXT,
  images TEXT[], -- Array de URLs
  availability TEXT DEFAULT 'available', -- available, rented, maintenance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(location_id, complement)
);
```

#### 3. `tenants`
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  document_type TEXT NOT NULL, -- cpf, cnpj
  document_number TEXT UNIQUE NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'active', -- active, renter, inactive
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. `rentals`
```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent NUMERIC NOT NULL,
  due_day INTEGER NOT NULL, -- 1-31
  has_garage BOOLEAN DEFAULT FALSE,
  garage_value NUMERIC,
  payment_method TEXT NOT NULL, -- pix, bank_transfer, credit_card, debit_card, cash
  pix_code TEXT,
  security_deposit NUMERIC DEFAULT 0,
  deposit_installments INTEGER DEFAULT 1,
  has_partner_broker BOOLEAN DEFAULT FALSE,
  partner_broker_commission NUMERIC,
  internal_broker_commission NUMERIC,
  contract TEXT, -- URL do PDF
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. `payments`
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  reference_month INTEGER NOT NULL, -- 1-12
  reference_year INTEGER NOT NULL,
  due_date DATE NOT NULL,
  expected_amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  payment_date DATE,
  status TEXT NOT NULL, -- pending, paid, overdue, partial
  payment_method TEXT NOT NULL,
  payment_code TEXT,
  receipt TEXT, -- URL do comprovante
  installment INTEGER NOT NULL, -- Número da parcela (1, 2, 3...)
  total_installments INTEGER NOT NULL, -- Total de parcelas
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 6. `deposit_installments`
```sql
CREATE TABLE deposit_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL, -- 1, 2, 3...
  total_installments INTEGER NOT NULL,
  installment_total NUMERIC NOT NULL, -- Valor total do caução
  amount NUMERIC NOT NULL, -- Valor desta parcela
  payment_date DATE NOT NULL,
  pix_code TEXT,
  partner_commission NUMERIC,
  internal_commission NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 7. `config`
```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Valores padrão
INSERT INTO config (key, value) VALUES
  ('admin_fee_percentage', '5'),
  ('management_fee_percentage', '3');
```

#### 8. `system_users`
```sql
CREATE TABLE system_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- admin, broker, financial, user
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 9. `user_location_permissions`
```sql
CREATE TABLE user_location_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);
```

#### 10. `user_fee_exemptions`
```sql
CREATE TABLE user_fee_exemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);
```

#### 11. `location_expenses`
```sql
CREATE TABLE location_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id),
  type TEXT NOT NULL, -- water, electricity, internet, maintenance, condominium, property_tax, cleaning, security, other
  amount NUMERIC NOT NULL,
  reference_month INTEGER NOT NULL, -- 1-12
  reference_year INTEGER NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 📝 Glossário de Termos

- **Locação**: Contrato de aluguel entre imóvel e inquilino
- **Parcela/Recebimento**: Pagamento mensal de aluguel
- **Caução**: Depósito de segurança pago pelo inquilino
- **Taxa de Administração**: Percentual sobre receita bruta para administração do imóvel
- **Taxa de Gerenciamento**: Percentual sobre receita bruta para gerenciamento da locação
- **Receita Bruta**: Total recebido antes de descontar taxas
- **Receita Líquida**: Total após descontar taxas e despesas
- **Inadimplência**: Pagamentos em atraso (status `overdue`)
- **Ocupação**: Percentual de imóveis alugados vs. total de imóveis
- **PIX Code**: Código/chave de pagamento PIX usado como identificação
- **Rowspan**: Técnica de agrupamento de linhas em tabelas HTML
- **Rescisão**: Encerramento antecipado de contrato de locação
- **Multa Rescisória**: Penalidade por quebra de contrato
- **IGPM**: Índice Geral de Preços do Mercado (usado para correção de caução)
- **Proporcional**: Cálculo de valor baseado em dias utilizados
- **RLS**: Row Level Security (segurança a nível de linha no Supabase)

---

## 🔧 Funcionalidades Técnicas

### Máscaras de Input
- CPF: 000.000.000-00
- CNPJ: 00.000.000/0000-00
- Telefone: (00) 00000-0000
- CEP: 00000-000
- Moeda: R$ 0.000,00

### Validações de Documento
- CPF: Validação de dígitos verificadores
- CNPJ: Validação de dígitos verificadores
- Email: Formato RFC 5322

### Upload de Arquivos
- **Imagens**: JPG, JPEG, PNG, WEBP (máx 5MB)
- **PDFs**: PDF (máx 10MB)
- **Armazenamento**: `public/uploads/`
- **Nomenclatura**: `[tipo]_[uuid].[extensão]`

### Integração com API Externa
- **IGPM Service**: Busca variação acumulada do IGPM para correção de caução
- **Endpoint**: API pública de índices econômicos
- **Uso**: Rescisão de contratos

### Responsividade
- Mobile First: Design otimizado para smartphones
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Tabelas: Scroll horizontal em telas pequenas
- Cards: Stack vertical em mobile, grid em desktop

### Performance
- **Paginação**: Tabelas longas (>100 itens)
- **Lazy Loading**: Imagens carregadas sob demanda
- **Cache**: Dados frequentes armazenados localmente
- **Debounce**: Busca/filtros com atraso de 300ms

---

**Versão**: 2.0  
**Data**: 2026-02-12  
**Sistema**: Gerenciador de Locações de Imóveis  
**Última Atualização**: Documentação completa com todas as telas, fluxos e regras de negócio
---

## 🗑️ Excluir uma locação

> Definido com o Cadu em **29/ago/2026**.

### A restrição de fundo

A tabela `payments` tem chave estrangeira `ON DELETE CASCADE` para `rentals`.
Apagar a locação apaga **todos** os recebimentos dela, pagos inclusive.
**Não existe** "apagar a locação e preservar o histórico" — o banco não
permite. Por isso a exclusão tem dois caminhos.

### Os dois caminhos

| Escolha | O que acontece com a locação | Recebimentos pagos/parciais | Recebimentos pendentes |
|---|---|---|---|
| **Deletar também os pagos** | apagada do banco | **apagados** (somem dos relatórios) | apagados |
| **Preservar os pagos** | recebe status `deleted` e some das telas | **intactos**, continuam no Financeiro | apagados |

Em ambos os casos os **pendentes sempre saem**: são cobrança futura de um
contrato que deixou de existir. Isso não é perguntado.

### O fluxo na tela

1. **Confirmação**: mostra quantos recebimentos pendentes e quantos
   pagos/parciais a locação tem, avisa que os pendentes serão removidos, e
   pergunta se quer prosseguir. Sim / Não.
2. **Se houver pagos**: pergunta se quer apagá-los também, explicando o
   efeito de cada resposta. Sem recebimentos pagos, este passo não aparece.

### O status `deleted`

Locação arquivada: existe no banco só para sustentar os recebimentos já
pagos, que sem ela seriam apagados pelo CASCADE. É filtrada de
`rentalService.getAll()` e não aparece em nenhuma tela de locações. Os
recebimentos dela **continuam** aparecendo no Financeiro — é justamente o
ponto.

`rentals.status` não tem restrição de valores no banco, então o status novo
não exigiu migração.
