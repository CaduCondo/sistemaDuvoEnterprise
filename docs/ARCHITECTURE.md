# 🏗️ Arquitetura do Sistema

Este documento descreve a arquitetura técnica completa do Sistema de Gerenciamento de Locações.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura de Alto Nível](#arquitetura-de-alto-nível)
- [Frontend](#frontend)
- [Backend](#backend)
- [Banco de Dados](#banco-de-dados)
- [Autenticação e Autorização](#autenticação-e-autorização)
- [Fluxo de Dados](#fluxo-de-dados)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Padrões de Código](#padrões-de-código)

---

## 🎯 Visão Geral

### Stack Tecnológica

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  Next.js 15 + TypeScript + Tailwind CSS + Shadcn/UI   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/REST + Real-time
                     │
┌────────────────────▼────────────────────────────────────┐
│                     BACKEND                             │
│        Supabase (PostgreSQL + Auth + Storage)          │
└─────────────────────────────────────────────────────────┘
```

### Princípios Arquiteturais

1. **Separação de Responsabilidades**: Frontend (UI) separado do Backend (lógica)
2. **Componentização**: Componentes reutilizáveis e modulares
3. **Type Safety**: TypeScript em todo o código
4. **Real-time**: Atualizações em tempo real via Supabase
5. **Security First**: RLS no banco + autenticação JWT
6. **Mobile First**: Design responsivo

---

## 🏛️ Arquitetura de Alto Nível

### Camadas da Aplicação

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  - Pages (Next.js)                                          │
│  - Components (React)                                       │
│  - UI Components (Shadcn/UI)                                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    APPLICATION LAYER                        │
│  - Hooks (Custom React Hooks)                               │
│  - Contexts (State Management)                              │
│  - Services (API Calls)                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      DATA LAYER                             │
│  - Supabase Client                                          │
│  - Database (PostgreSQL)                                    │
│  - Storage (S3-compatible)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Frontend

### Tecnologias

- **Framework**: Next.js 15 (Pages Router)
- **Linguagem**: TypeScript 5.0
- **Estilização**: Tailwind CSS 3.4
- **Componentes**: Shadcn/UI
- **Formulários**: React Hook Form + Zod
- **Animações**: Framer Motion
- **Estado**: React Context + Custom Hooks

### Estrutura de Componentes

```
src/components/
├── ui/                    # Componentes base (Button, Input, etc.)
├── dashboard/             # Componentes específicos do dashboard
├── properties/            # Componentes de propriedades
├── tenants/               # Componentes de inquilinos
├── rentals/               # Componentes de locações
├── payments/              # Componentes de pagamentos
├── financial/             # Componentes financeiros
├── settings/              # Componentes de configurações
├── public/                # Componentes públicos (site de divulgação)
│   ├── PublicHeader.tsx  # Header com dropdown de login
│   ├── PropertyPublicCard.tsx
│   └── ...
├── animations/            # Componentes de animação
├── Layout.tsx             # Layout principal
├── SEO.tsx                # Componente de SEO
├── ThemeSwitch.tsx        # Alternador de tema
├── PasswordChangeDialog.tsx  # Dialog de troca de senha obrigatória
├── EditProfileDialog.tsx     # Dialog de edição de perfil
└── ConnectionStatusToast.tsx # Toast de status de conexão
```

### Páginas (Rotas)

```
src/pages/
├── index.tsx              # Página inicial/anúncios (pública com dropdown de login)
├── dashboard.tsx          # Painel de Gestão (renomeado de Dashboard)
├── properties/
│   ├── index.tsx         # Lista de propriedades
│   └── [id].tsx          # Detalhes da propriedade
├── tenants/
│   ├── index.tsx         # Lista de inquilinos
│   └── [id].tsx          # Detalhes do inquilino
├── rentals/
│   ├── index.tsx         # Lista de locações
│   └── [id].tsx          # Detalhes da locação
├── payments/
│   ├── index.tsx         # Lista de pagamentos
│   ├── [id].tsx          # Detalhes do pagamento
│   └── manage/[id].tsx   # Gerenciar pagamento
├── financial.tsx          # Página financeira
├── settings.tsx           # Configurações
├── imovel/
│   └── [id].tsx          # Página pública de imóvel
└── api/                   # API Routes
    ├── upload.ts         # Upload de arquivos
    └── properties/       # APIs de propriedades
```

### Custom Hooks

```typescript
// Exemplos de hooks customizados

// useProperties.ts - Gestão de propriedades
const { properties, loading, createProperty, updateProperty, deleteProperty } = useProperties();

// useRentals.ts - Gestão de locações
const { rentals, loading, createRental, terminateRental } = useRentals();

// usePayments.ts - Gestão de pagamentos
const { payments, loading, markAsPaid, applyLateFees } = usePayments();

// useDashboardData.ts - Dados do dashboard
const { metrics, charts, loading } = useDashboardData(period);

// usePermissions.ts - Verificação de permissões
const { canCreate, canEdit, canDelete, hasAccess } = usePermissions();
```

---

## 🔧 Backend

### Supabase

Utilizamos **Supabase** como Backend-as-a-Service completo:

#### Database (PostgreSQL)

- **ORM**: Supabase Client (auto-generated types)
- **Migrações**: SQL migrations na pasta `supabase/migrations/`
- **Segurança**: Row Level Security (RLS) em todas as tabelas

#### Authentication

- **Provider**: Supabase Auth
- **Método**: Email/Password
- **JWT**: Tokens gerados automaticamente
- **Sessão**: Gerenciada pelo Supabase Client

#### Storage

- **Uploads**: Imagens de propriedades, documentos, contratos
- **Buckets**: 
  - `property-images` - Imagens de propriedades
  - `documents` - Documentos diversos
  - `contracts` - Contratos de locação
- **Segurança**: RLS aplicado nos buckets

### Serviços (src/services/)

Camada de abstração para chamadas ao Supabase:

```
src/services/
├── authService.ts                    # Autenticação
├── propertyService.ts                # Gestão de propriedades
├── tenantService.ts                  # Gestão de inquilinos
├── rentalService.ts                  # Gestão de locações
├── paymentService.ts                 # Gestão de pagamentos
├── terminationService.ts             # Rescisão de contratos
├── depositInstallmentService.ts      # Parcelas de caução
├── locationService.ts                # Localizações
├── locationExpenseService.ts         # Despesas de localização
├── adminFeeExemptionService.ts       # Isenções de taxa
├── configService.ts                  # Configurações
├── igpmService.ts                    # Correção por IGPM
├── roleMenuPermissionService.ts      # Permissões de menu
├── locationPermissionService.ts      # Permissões de localização
├── systemUserService.ts              # Usuários do sistema
├── userLocationPermissionService.ts  # Permissões de usuário
└── cacheService.ts                   # Cache em memória
```

### Exemplo de Serviço

```typescript
// src/services/propertyService.ts

import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types";

export async function fetchProperties(locationId?: string): Promise<Property[]> {
  let query = supabase
    .from("properties")
    .select(`
      *,
      location:locations(id, name)
    `)
    .order("created_at", { ascending: false });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Property[];
}

export async function createProperty(property: Partial<Property>): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .insert(property)
    .select()
    .single();

  if (error) throw error;
  return data as Property;
}
```

---

## 🗄️ Banco de Dados

### Esquema Lógico

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│  locations  │       │  properties  │       │   rentals   │
├─────────────┤       ├──────────────┤       ├─────────────┤
│ id (PK)     │◄──────┤ location_id  │◄──────┤ property_id │
│ name        │       │ address      │       │ tenant_id   │
│ admin_fee   │       │ monthly_rent │       │ start_date  │
└─────────────┘       │ status       │       │ end_date    │
                      └──────────────┘       │ deposit     │
                                             └─────────────┘
                                                    │
                                                    │
                      ┌──────────────┐             │
                      │   tenants    │             │
                      ├──────────────┤             │
                      │ id (PK)      │◄────────────┘
                      │ name         │
                      │ cpf          │
                      │ phone        │
                      └──────────────┘
                             │
                             │
                      ┌──────▼───────┐
                      │   payments   │
                      ├──────────────┤
                      │ id (PK)      │
                      │ rental_id    │
                      │ due_date     │
                      │ amount       │
                      │ status       │
                      │ payment_date │
                      └──────────────┘
```

### Tabelas Principais

#### 1. locations (Localizações)
```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  admin_fee_percentage DECIMAL(5,2) DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. properties (Propriedades)
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID REFERENCES locations(id),
  address TEXT NOT NULL,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  monthly_rent DECIMAL(10,2) NOT NULL,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking_spaces INTEGER,
  area DECIMAL(10,2),
  description TEXT,
  status TEXT DEFAULT 'available',
  images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. tenants (Inquilinos)
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  rg TEXT,
  birth_date DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. rentals (Locações)
```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  tenant_id UUID REFERENCES tenants(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_day INTEGER NOT NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2),
  deposit_installments INTEGER DEFAULT 1,
  deposit_installment_1 DECIMAL(10,2),
  deposit_installment_2 DECIMAL(10,2),
  deposit_installment_3 DECIMAL(10,2),
  parking_value DECIMAL(10,2),
  broker_commission DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. payments (Pagamentos)
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID REFERENCES rentals(id),
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  rent_amount DECIMAL(10,2),
  parking_amount DECIMAL(10,2),
  admin_fee DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  broker_commission DECIMAL(10,2),
  late_fee DECIMAL(10,2),
  interest DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  payment_date DATE,
  payment_method TEXT,
  reference_month TEXT,
  reference_year TEXT,
  installment INTEGER,
  total_installments INTEGER,
  type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado com políticas baseadas em:

1. **Autenticação**: Apenas usuários autenticados podem acessar
2. **Permissões de Localização**: Usuários só veem dados das localizações que têm permissão
3. **Perfil de Usuário**: Admin vê tudo, outros perfis têm restrições

Exemplo de política RLS:

```sql
-- Políticas para a tabela properties

-- SELECT: Usuários só veem propriedades das suas localizações
CREATE POLICY "Users can view properties from their locations"
ON properties FOR SELECT
USING (
  location_id IN (
    SELECT location_id 
    FROM user_location_permissions 
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Apenas Admin e Gerente podem criar
CREATE POLICY "Admin and Manager can insert properties"
ON properties FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM system_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);
```

---

## 🔐 Autenticação e Autorização

### Sistema de Autenticação Atualizado

#### Fluxo de Autenticação com Dropdown

```
┌─────────┐       ┌──────────────┐       ┌──────────┐       ┌──────────┐
│  User   │──────▶│ Dropdown de  │──────▶│ Supabase │──────▶│   JWT    │
│ Browser │       │ Login (Header│       │   Auth   │       │  Token   │
└─────────┘       │   Público)   │       └──────────┘       └──────────┘
     │            └──────────────┘              │                  │
     │                                          │                  │
     └──────────────────────────────────────────┴──────────────────┘
                Armazena JWT + Tema no localStorage
```

#### Sistema de 3 Tentativas e Bloqueio

```
┌──────────────────────────────────────────────────────────────┐
│                   TENTATIVA DE LOGIN                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  Senha correta?         │
        └─────┬──────────────┬────┘
              │              │
           SIM│              │NÃO
              │              │
    ┌─────────▼────┐  ┌─────▼──────────────┐
    │ Login OK     │  │ Incrementa tentativa│
    │ Reset tries  │  │ login_attempts++    │
    │ Load theme   │  └─────┬──────────────┘
    └──────────────┘        │
                    ┌───────▼────────┐
                    │ Tentativas >= 3?│
                    └───┬────────┬───┘
                        │        │
                     SIM│        │NÃO
                        │        │
            ┌───────────▼──┐  ┌─▼──────────────┐
            │ BLOQUEAR     │  │ Mostrar mensagem│
            │ 30 minutos   │  │ "X tentativas"  │
            │blocked_until │  └────────────────┘
            └──────────────┘
```

#### Fluxo de Senha Temporária

```
┌────────────────────────────────────────────────────────┐
│              PRIMEIRO LOGIN (Senha Temporária)         │
└────────────────────┬───────────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │ requires_password_change? │
        └─────┬──────────────┬──────┘
              │              │
           SIM│              │NÃO
              │              │
    ┌─────────▼─────────┐   │
    │ Mostrar Dialog de │   │
    │ Troca de Senha    │   │
    │ (no dropdown)     │   │
    └─────────┬─────────┘   │
              │              │
    ┌─────────▼─────────┐   │
    │ Validação Visual  │   │
    │ em Tempo Real:    │   │
    │ ✓ Maiúscula       │   │
    │ ✓ Minúscula       │   │
    │ ✓ Número          │   │
    │ ✓ 6-12 chars      │   │
    │ ✓ Senhas iguais   │   │
    └─────────┬─────────┘   │
              │              │
    ┌─────────▼─────────┐   │
    │ Salvar Nova Senha │   │
    │ requires_password │   │
    │ _change = false   │   │
    └─────────┬─────────┘   │
              │              │
              └──────┬───────┘
                     │
          ┌──────────▼──────────┐
          │ Redirecionar para   │
          │ Painel de Gestão    │
          └─────────────────────┘
```

#### Fluxo de Recuperação de Senha

```
┌────────────────────────────────────────────────────────┐
│         "Esqueci minha senha" (no dropdown)            │
└────────────────────┬───────────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Digitar email             │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Email existe?             │
        └─────┬──────────────┬──────┘
              │              │
           SIM│              │NÃO
              │              │
    ┌─────────▼─────────┐   │
    │ Gerar senha temp  │   │
    │ (12 caracteres)   │   │
    └─────────┬─────────┘   │
              │              │
    ┌─────────▼─────────┐   │
    │ Atualizar banco:  │   │
    │ - Nova senha      │   │
    │ - requires_pass=T │   │
    │ - login_tries=0   │   │
    │ - blocked=null    │   │
    └─────────┬─────────┘   │
              │              │
    ┌─────────▼─────────┐   │
    │ Enviar email com  │   │
    │ senha temporária  │   │
    └─────────┬─────────┘   │
              │              │
              │          ┌───▼────────┐
              │          │ Erro: email│
              │          │ não existe │
              │          └────────────┘
              │
    ┌─────────▼─────────┐
    │ Mostrar sucesso   │
    │ Voltar para login │
    └───────────────────┘
```

### Sistema de Tema por Usuário

#### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                   GESTÃO DE TEMA                        │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Banco de Dados            │
        │ system_users.theme        │
        │ ('light' | 'dark')        │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ AuthContext               │
        │ (carrega tema no login)   │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ ThemeProvider             │
        │ (aplica classe no <html>) │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ localStorage              │
        │ (cache para evitar flash) │
        └───────────────────────────┘
```

#### Persistência Multi-Dispositivo

1. **Login:** Tema carregado do banco de dados
2. **Troca:** Atualizado no banco + localStorage + aplicado
3. **Logout:** Tema removido do localStorage
4. **Próximo login:** Mesmo tema em qualquer dispositivo

### Gestão de Usuários

#### Criação de Usuário (Fluxo Completo)

```
┌────────────────────────────────────────────────────────┐
│               CRIAR NOVO USUÁRIO (Admin)               │
└────────────────────┬───────────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Preencher formulário:     │
        │ - Nome (obrigatório)      │
        │ - Email/User (único, @)   │
        │ - Telefone (máscara)      │
        │ - Perfil (obrigatório)    │
        │ - Status (padrão: ativo)  │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Validações                │
        │ ✓ Email contém @          │
        │ ✓ Email único no sistema  │
        │ ✓ Telefone 10 ou 11 dígitos│
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Gerar senha temporária    │
        │ (automático, 12 chars)    │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Criar registro no banco:  │
        │ - password_hash = temp    │
        │ - requires_change = true  │
        │ - temporary_pass = true   │
        │ - active = status         │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Enviar email boas-vindas  │
        │ (senha temporária + link) │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Toast: "Usuário criado!"  │
        │ Email enviado com sucesso │
        └───────────────────────────┘
```

### Perfis de Usuário (Atualizado)

```typescript
enum UserRole {
  ADMIN = "admin",           // Acesso total + gestão de usuários
  BROKER = "broker",         // Gestão de imóveis e locações
  FINANCIAL = "financial"    // Gestão financeira e pagamentos
}
```

**Nota:** Perfis `manager`, `operator` e `viewer` foram substituídos por permissões granulares por localização.

### Matriz de Permissões

| Funcionalidade | Admin | Manager | Operator | Viewer |
|----------------|-------|---------|----------|--------|
| Criar Propriedades | ✅ | ✅ | ✅ | ❌ |
| Editar Propriedades | ✅ | ✅ | ✅ | ❌ |
| Deletar Propriedades | ✅ | ✅ | ❌ | ❌ |
| Criar Inquilinos | ✅ | ✅ | ✅ | ❌ |
| Criar Locações | ✅ | ✅ | ✅ | ❌ |
| Rescindir Contratos | ✅ | ✅ | ✅ | ❌ |
| Marcar Pagamentos | ✅ | ✅ | ✅ | ❌ |
| Ver Dashboard | ✅ | ✅ | ✅ | ✅ |
| Configurações | ✅ | ✅ | ❌ | ❌ |
| Gerenciar Usuários | ✅ | ❌ | ❌ | ❌ |

### Implementação de Permissões

```typescript
// src/hooks/usePermissions.ts

export function usePermissions() {
  const { user } = useAuth();

  const canCreate = (resource: string) => {
    return ["admin", "manager", "operator"].includes(user?.role);
  };

  const canEdit = (resource: string) => {
    return ["admin", "manager", "operator"].includes(user?.role);
  };

  const canDelete = (resource: string) => {
    if (resource === "properties") {
      return ["admin", "manager"].includes(user?.role);
    }
    return user?.role === "admin";
  };

  return { canCreate, canEdit, canDelete };
}
```

---

## 🔄 Fluxo de Dados

### Criação de Locação (Exemplo Completo)

```
1. USUÁRIO preenche formulário
   ↓
2. VALIDAÇÃO com Zod
   ↓
3. HOOK useRentalForm processa dados
   ↓
4. SERVICE rentalService.createRental()
   ↓
5. SUPABASE cria registro na tabela rentals
   ↓
6. TRIGGER automático no banco:
   - Atualiza status da propriedade para "occupied"
   - Cria pagamentos mensais na tabela payments
   ↓
7. RETORNO para o frontend com dados criados
   ↓
8. ATUALIZAÇÃO do estado local (React)
   ↓
9. FEEDBACK visual para o usuário
```

### Marcação de Pagamento como Pago

```
1. USUÁRIO clica em "Marcar como Pago"
   ↓
2. DIALOG de confirmação abre
   ↓
3. USUÁRIO insere:
   - Data de pagamento
   - Método de pagamento
   - Anexo (opcional)
   ↓
4. VALIDAÇÃO dos dados
   ↓
5. SERVICE paymentService.markAsPaid()
   ↓
6. CÁLCULO de multa/juros (se aplicável)
   ↓
7. SUPABASE atualiza registro
   ↓
8. ATUALIZAÇÃO do cache local
   ↓
9. NOTIFICAÇÃO de sucesso
```

---

## 📂 Estrutura de Pastas Detalhada

```
gerenciador-locacoes/
├── src/
│   ├── components/              # Componentes React
│   │   ├── ui/                 # Componentes base (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── dashboard/          # Dashboard
│   │   │   ├── MetricCard.tsx
│   │   │   ├── FinancialCharts.tsx
│   │   │   └── ...
│   │   ├── properties/         # Propriedades
│   │   │   ├── PropertyCard.tsx
│   │   │   ├── PropertyFormDialog.tsx
│   │   │   └── ...
│   │   ├── rentals/            # Locações
│   │   │   ├── RentalFormDialog.tsx
│   │   │   ├── RentalTerminationDialog.tsx
│   │   │   └── ...
│   │   ├── payments/           # Pagamentos
│   │   │   ├── PaymentCard.tsx
│   │   │   ├── ManagePaymentForm.tsx
│   │   │   └── ...
│   │   ├── Layout.tsx          # Layout principal
│   │   └── SEO.tsx             # SEO component
│   ├── contexts/               # Contextos React
│   │   ├── AuthContext.tsx
│   │   └── ThemeProvider.tsx
│   ├── hooks/                  # Custom hooks
│   │   ├── useProperties.ts
│   │   ├── useRentals.ts
│   │   ├── usePayments.ts
│   │   ├── useDashboardData.ts
│   │   └── usePermissions.ts
│   ├── integrations/           # Integrações
│   │   └── supabase/
│   │       ├── client.ts       # Cliente Supabase
│   │       ├── types.ts        # Tipos TypeScript
│   │       └── database.types.ts # Tipos auto-gerados
│   ├── lib/                    # Bibliotecas e utilitários
│   │   ├── utils.ts            # Utilitários gerais
│   │   ├── masks.ts            # Máscaras de input
│   │   ├── storage.ts          # LocalStorage helper
│   │   ├── permissions.ts      # Sistema de permissões
│   │   └── rentalCalculations.ts # Cálculos de locação
│   ├── pages/                  # Páginas Next.js
│   │   ├── _app.tsx           # App wrapper
│   │   ├── _document.tsx      # Document wrapper
│   │   ├── index.tsx          # Home page
│   │   ├── login.tsx          # Login page
│   │   ├── dashboard.tsx      # Dashboard
│   │   ├── properties/
│   │   ├── tenants/
│   │   ├── rentals/
│   │   ├── payments/
│   │   ├── financial.tsx
│   │   ├── settings.tsx
│   │   └── api/               # API Routes
│   ├── services/              # Serviços de API
│   │   ├── authService.ts
│   │   ├── propertyService.ts
│   │   ├── rentalService.ts
│   │   ├── paymentService.ts
│   │   └── ...
│   ├── styles/                # Estilos
│   │   └── globals.css
│   └── types/                 # Tipos TypeScript
│       └── index.ts
├── supabase/                  # Supabase
│   ├── functions/             # Edge Functions
│   └── migrations/            # Migrações SQL
├── public/                    # Arquivos estáticos
│   ├── favicon.ico
│   └── uploads/               # Uploads (dev)
├── docs/                      # Documentação
│   ├── ARCHITECTURE.md
│   ├── BUSINESS_RULES.md
│   ├── API_DOCUMENTATION.md
│   └── ...
├── .env.local                 # Variáveis de ambiente
├── next.config.mjs            # Configuração Next.js
├── tailwind.config.ts         # Configuração Tailwind
├── tsconfig.json              # Configuração TypeScript
└── package.json               # Dependências
```

---

## 📝 Padrões de Código

### Nomenclatura

- **Componentes**: PascalCase (`PropertyCard.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useProperties.ts`)
- **Services**: camelCase com sufixo `Service` (`propertyService.ts`)
- **Types**: PascalCase (`Property`, `Rental`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Variáveis**: camelCase (`propertyData`)

### Organização de Imports

```typescript
// 1. React e bibliotecas externas
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

// 2. Componentes
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/properties/PropertyCard";

// 3. Hooks customizados
import { useProperties } from "@/hooks/useProperties";

// 4. Serviços
import { fetchProperties } from "@/services/propertyService";

// 5. Tipos
import type { Property } from "@/types";

// 6. Utilitários
import { formatCurrency } from "@/lib/utils";
```

### Exemplo de Componente Padrão

```typescript
// src/components/properties/PropertyCard.tsx

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Property } from "@/types";

interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void;
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, onEdit, onDelete }: PropertyCardProps) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold">{property.address}</h3>
      <p className="text-muted-foreground">{property.neighborhood}</p>
      <Badge variant={property.status === "available" ? "success" : "secondary"}>
        {property.status}
      </Badge>
      <p className="text-xl font-bold mt-2">
        {formatCurrency(property.monthly_rent)}
      </p>
    </Card>
  );
}
```

### Exemplo de Hook Customizado

```typescript
// src/hooks/useProperties.ts

import { useState, useEffect } from "react";
import { fetchProperties, createProperty } from "@/services/propertyService";
import type { Property } from "@/types";

export function useProperties(locationId?: string) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, [locationId]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const data = await fetchProperties(locationId);
      setProperties(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const create = async (property: Partial<Property>) => {
    const newProperty = await createProperty(property);
    setProperties([...properties, newProperty]);
    return newProperty;
  };

  return {
    properties,
    loading,
    error,
    createProperty: create,
    refreshProperties: loadProperties,
  };
}
```

---

## 🔍 Debugging e Logging

### Logs no Console

```typescript
// Padrão de logs utilizado

console.log("🔍 [PropertyService] Fetching properties...");
console.log("✅ [PropertyService] Properties fetched:", data);
console.error("❌ [PropertyService] Error:", error);
console.warn("⚠️ [PropertyService] Warning:", warning);
```

### Supabase Logs

No Supabase Dashboard:
1. **Database Logs**: SQL queries executadas
2. **Auth Logs**: Tentativas de login
3. **Storage Logs**: Uploads de arquivos

---

## 🚀 Performance

### Otimizações Implementadas

1. **Lazy Loading**: Componentes carregados sob demanda
2. **Image Optimization**: Next.js Image component
3. **Code Splitting**: Automático pelo Next.js
4. **Memoization**: React.memo e useMemo onde necessário
5. **Debouncing**: Em campos de busca
6. **Caching**: Cache em memória para dados frequentes

### Métricas Alvo

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Lighthouse Score**: > 90

---

## 📊 Monitoramento

### Métricas Monitoradas

1. **Performance**: Core Web Vitals
2. **Erros**: Sentry (se configurado)
3. **Analytics**: Google Analytics (se configurado)
4. **Database**: Supabase Dashboard

---

**Próximos documentos:**
- [Regras de Negócio](BUSINESS_RULES.md)
- [Documentação de API](API_DOCUMENTATION.md)
- [Esquema do Banco de Dados](DATABASE_SCHEMA.md)