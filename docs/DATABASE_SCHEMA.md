# 🗄️ Esquema do Banco de Dados

Este documento detalha o esquema completo do banco de dados PostgreSQL.

> ℹ️ **Revisão de 2026-08:** as tabelas `properties`, `rentals`, `payments` e
> `deposit_installments` foram conferidas e corrigidas contra o schema real
> gerado em `src/integrations/supabase/database.types.ts` (fonte de verdade —
> regenere esse arquivo via CLI do Supabase sempre que o schema mudar). As
> demais tabelas (`locations`, `tenants`, `system_users`,
> `user_location_permissions`, `admin_fee_exemptions`, `location_expenses`) não
> foram reconferidas nesta revisão; se notar divergência, o `database.types.ts`
> é sempre a referência mais confiável.
>
> ℹ️ **Atualização 18/08/2026:** adicionada a coluna `partial_payments` em
> `deposit_installments` (histórico de pagamentos de caução + recibo por
> entrada, mesmo padrão de `payments.partial_payments`). Ver seção da tabela
> `deposit_installments` abaixo.
>
> ℹ️ **Atualização 12-16/08/2026:** adicionadas em `properties` as colunas
> `has_barbecue` (churrasqueira), `listing_type` (Locação/Venda) e
> `public_code` (código curto da URL pública do imóvel). Ver seção da tabela
> `properties` abaixo.

---

## 📋 Índice

- [Diagrama ER](#diagrama-er)
- [Tabelas](#tabelas)
- [Relacionamentos](#relacionamentos)
- [Índices](#índices)
- [Triggers](#triggers)
- [Row Level Security](#row-level-security)
- [Migrações](#migrações)

---

## 📊 Diagrama ER (Entity-Relationship)

```
┌─────────────────────┐
│     locations       │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ admin_fee_percentage│
│ created_at          │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐       ┌─────────────────────┐
│    properties       │       │      tenants        │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │
│ location_id (FK)    │       │ name                │
│ address             │       │ cpf (UNIQUE)        │
│ monthly_rent        │       │ phone               │
│ status              │       │ email               │
│ ...                 │       │ ...                 │
└──────────┬──────────┘       └──────────┬──────────┘
           │                             │
           │ 1:N                         │ 1:N
           │                             │
           └──────────┬──────────────────┘
                      │
                      │
           ┌──────────▼──────────┐
           │      rentals        │
           ├─────────────────────┤
           │ id (PK)             │
           │ property_id (FK)    │
           │ tenant_id (FK)      │
           │ start_date          │
           │ end_date            │
           │ payment_day         │
           │ monthly_rent        │
           │ deposit             │
           │ status              │
           │ ...                 │
           └──────────┬──────────┘
                      │
                      │ 1:N
                      │
           ┌──────────▼──────────┐
           │      payments       │
           ├─────────────────────┤
           │ id (PK)             │
           │ rental_id (FK)      │
           │ due_date            │
           │ amount              │
           │ status              │
           │ payment_date        │
           │ ...                 │
           └─────────────────────┘
```

---

## 📋 Tabelas

### 1. locations (Localizações)

**Descrição:** Cidades/regiões onde a empresa atua

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  admin_fee_percentage DECIMAL(5,2) DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `name` | TEXT | Nome da localização | NOT NULL, UNIQUE |
| `admin_fee_percentage` | DECIMAL(5,2) | Taxa administrativa (%) | DEFAULT 10.00 |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Exemplo de dados:**
```sql
INSERT INTO locations (name, admin_fee_percentage) VALUES
  ('São Paulo', 10.00),
  ('Rio de Janeiro', 12.00),
  ('Belo Horizonte', 8.00);
```

---

### 2. properties (Propriedades)

**Descrição:** Imóveis gerenciados

> ⚠️ **Atualizado em 2026-08** a partir do schema real gerado em
> `src/integrations/supabase/database.types.ts` (fonte de verdade). A versão
> anterior deste documento descrevia colunas (`address`, `monthly_rent`,
> `property_type`, `bedrooms`, `parking_spaces`) que **não existem mais** — o
> imóvel não tem mais campo de endereço próprio nem "tipo"; o endereço vem da
> `location` associada, e o campo livre de complemento é `complement`
> (renomeado de "Endereço" para "Complemento" na UI — ver tarefa
> "Padronizar Tabela de Imóveis" no board do projeto).

```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  property_identifier TEXT,
  complement TEXT,
  description TEXT,
  rooms INTEGER,
  bathrooms INTEGER,
  area NUMERIC,
  value NUMERIC,
  has_garage BOOLEAN DEFAULT false,
  has_furniture BOOLEAN DEFAULT false,
  has_barbecue BOOLEAN DEFAULT false,
  accepts_pets BOOLEAN DEFAULT false,
  listing_type TEXT DEFAULT 'rent', -- 'rent' | 'sale'
  public_code TEXT,
  status TEXT NOT NULL, -- 'available' | 'occupied' | 'unavailable'
  images JSONB,
  image_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `location_id` | UUID | Localização | FK → locations(id), NOT NULL |
| `property_identifier` | TEXT | Código/identificador do imóvel | - |
| `complement` | TEXT | Complemento (ex: "Apto 102, Bloco A") — antigo "Endereço" na UI | - |
| `description` | TEXT | Descrição livre | - |
| `rooms` | INTEGER | Quartos | rótulo na UI: "Quartos" |
| `bathrooms` | INTEGER | Banheiros | - |
| `area` | NUMERIC | Área (m²) | rótulo na UI: "Área Útil" |
| `value` | NUMERIC | Valor do aluguel | rótulo na UI: "Valor" |
| `has_garage` | BOOLEAN | Possui vaga de garagem | DEFAULT false |
| `has_furniture` | BOOLEAN | Móveis planejados | DEFAULT false |
| `has_barbecue` | BOOLEAN | Possui churrasqueira | DEFAULT false — adicionado 12/08/2026 |
| `accepts_pets` | BOOLEAN | Aceita pets | DEFAULT false |
| `listing_type` | TEXT | Tipo de anúncio: `rent` (Locação) ou `sale` (Venda) | DEFAULT 'rent' — adicionado 12/08/2026. Quando `sale`, o anúncio público mostra "Valor Venda" (sem "/mês") |
| `public_code` | TEXT | Código curto usado na URL pública do imóvel (ex: `/imovel/AB12`, em vez do UUID completo) | adicionado 16/08/2026, ver `src/lib/propertyCode.ts` |
| `status` | TEXT | Status do imóvel | NOT NULL |
| `images` | JSONB | Metadados das imagens | - |
| `image_count` | INTEGER | Nº de imagens (contagem materializada) | DEFAULT 0 |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Status possíveis** (ver `SelectItem` em `PropertyFormDialog.tsx`):
- `available` - Disponível
- `occupied` - Ocupado
- `unavailable` - Indisponível

Não existe mais `maintenance`. O endereço completo do imóvel (rua, bairro,
cidade, CEP) fica na tabela `locations`, não em `properties`.

---

### 3. tenants (Inquilinos)

**Descrição:** Locatários dos imóveis

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT,
  document TEXT,
  document_type TEXT DEFAULT 'cpf' CHECK (document_type IN ('cpf', 'cnpj')),
  rg TEXT,
  occupation VARCHAR(255),
  marital_status VARCHAR(50),
  monthly_income DECIMAL(10,2),
  phone TEXT,
  email TEXT,
  zip_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'rented')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE UNIQUE INDEX idx_tenants_cpf ON tenants(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_document ON tenants(document) WHERE document IS NOT NULL;
CREATE INDEX idx_tenants_status ON tenants(status);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `name` | TEXT | Nome completo | NOT NULL |
| `cpf` | TEXT | CPF (apenas quando document_type='cpf') | - |
| `document` | TEXT | Documento (CPF ou CNPJ) | - |
| `document_type` | TEXT | Tipo do documento | 'cpf' ou 'cnpj', DEFAULT 'cpf' |
| `rg` | TEXT | RG | - |
| `occupation` | VARCHAR(255) | Profissão do inquilino | - |
| `marital_status` | VARCHAR(50) | Estado civil | - |
| `monthly_income` | DECIMAL(10,2) | Renda mensal em R$ | - |
| `phone` | TEXT | Telefone | - |
| `email` | TEXT | Email | - |
| `zip_code` | TEXT | CEP | - |
| `street` | TEXT | Rua/Avenida | - |
| `number` | TEXT | Número | - |
| `complement` | TEXT | Complemento | - |
| `neighborhood` | TEXT | Bairro | - |
| `city` | TEXT | Cidade | - |
| `state` | TEXT | Estado (UF) | - |
| `status` | TEXT | Status | 'active', 'inactive', 'rented' |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Valores possíveis para marital_status:**
- `solteiro` - Solteiro(a)
- `casado` - Casado(a)
- `divorciado` - Divorciado(a)
- `viuvo` - Viúvo(a)
- `uniao_estavel` - União Estável

**Observações:**
- Os campos `occupation`, `marital_status` e `monthly_income` são **OPCIONAIS** (podem ser NULL)
- Para inquilinos existentes, esses campos ficam vazios até serem preenchidos manualmente
- `monthly_income` é armazenado sem formatação (número decimal puro, ex: 5500.00)
- Na interface, `monthly_income` é exibido com máscara R$ XX.XXX,XX (ex: R$ 5.500,00)
- `document_type` define se o inquilino é Pessoa Física (CPF) ou Jurídica (CNPJ)
- Campo `cpf` é mantido por compatibilidade, mas `document` é o campo principal

---

### 4. rentals (Locações)

**Descrição:** Contratos de locação

> ⚠️ **Atualizado em 2026-08.** As parcelas de caução **não ficam mais em
> colunas `deposit_installment_1/2/3` na própria `rentals`** — foram
> normalizadas para a tabela filha `deposit_installments` (seção 6). Vários
> nomes de coluna também mudaram: `monthly_rent` → `rent_value`,
> `payment_day` → `rent_due_day`, `deposit` → `security_deposit`/`deposit_value`,
> `broker_commission` → `partner_broker_value`.

```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  start_date DATE NOT NULL,
  end_date DATE,
  rent_due_day INTEGER,
  rent_value NUMERIC,
  security_deposit NUMERIC,
  deposit_value NUMERIC,
  deposit_installments INTEGER,
  has_garage BOOLEAN DEFAULT false,
  garage_value NUMERIC,
  has_partner_broker BOOLEAN DEFAULT false,
  partner_broker_value NUMERIC,
  pix_code TEXT,
  returned_deposit_amount NUMERIC,
  attachments JSONB,
  contract_attachments JSONB,
  status TEXT DEFAULT 'active', -- 'active' | 'terminated'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `property_id` | UUID | Imóvel locado | FK → properties(id), NOT NULL |
| `tenant_id` | UUID | Inquilino | FK → tenants(id), NOT NULL |
| `start_date` | DATE | Data de início | NOT NULL |
| `end_date` | DATE | Data de término | - |
| `rent_due_day` | INTEGER | Dia de vencimento do aluguel | rótulo na UI: "Dia vencimento" |
| `rent_value` | NUMERIC | Valor do aluguel | rótulo na UI: "Aluguel" |
| `security_deposit` | NUMERIC | Valor total do caução | usado como total ao gerar as parcelas |
| `deposit_value` | NUMERIC | Valor do caução (campo legado/alternativo) | ver observação abaixo |
| `deposit_installments` | INTEGER | Nº de parcelas do caução | 1, 2 ou 3 — gera linhas em `deposit_installments` |
| `has_garage` | BOOLEAN | Possui vaga de garagem | DEFAULT false |
| `garage_value` | NUMERIC | Valor da vaga de garagem | - |
| `has_partner_broker` | BOOLEAN | Tem corretor parceiro | DEFAULT false |
| `partner_broker_value` | NUMERIC | Comissão do corretor parceiro | - |
| `pix_code` | TEXT | Código PIX do contrato | - |
| `returned_deposit_amount` | NUMERIC | Valor do caução devolvido ao encerrar | pode diferir do original por descontos |
| `attachments` | JSONB | Anexos gerais da locação | - |
| `contract_attachments` | JSONB | Anexos do contrato | - |
| `status` | TEXT | Status | 'active' ou 'terminated' |
| `is_active` | BOOLEAN | Flag de locação ativa | usada em filtros/joins |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

> **Nota sobre `security_deposit` vs `deposit_value`:** o schema tem os dois
> campos; o fluxo de criação de locação (`useRentalForm.ts` /
> `DatabaseHelper.createRental`) usa `security_deposit` como o valor total do
> caução para calcular as parcelas. Antes de tratar `deposit_value` como
> autoritativo em uma integração nova, confira qual dos dois o formulário
> atual está de fato gravando.

---

### 5. payments (Recebimentos)

**Descrição:** Pagamentos mensais das locações

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  rent_amount DECIMAL(10,2),
  admin_fee NUMERIC,
  late_fee NUMERIC,
  late_fee_waived BOOLEAN DEFAULT false,
  interest NUMERIC,
  interest_waived BOOLEAN DEFAULT false,
  discount_amount NUMERIC,
  status TEXT NOT NULL, -- 'pending' | 'paid' | 'overdue' | 'cancelled' (ver uso real no código)
  is_paid BOOLEAN DEFAULT false,
  payment_date DATE,
  payment_time TEXT,
  payment_method TEXT,
  payment_code TEXT,
  payment_location TEXT,
  pix_code TEXT,
  pix_code_type TEXT,
  reference_month TEXT NOT NULL,
  reference_year TEXT NOT NULL,
  installment INTEGER,
  total_installments INTEGER,
  breakdown JSONB,
  partial_payments JSONB,
  attachments JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

> ⚠️ **Atualizado em 2026-08.** A versão anterior deste documento listava
> colunas (`amount`, `rent_amount`, `parking_amount`, `deposit_amount`,
> `broker_commission`, `type`, `attachment`) que **não existem** no schema
> real. O valor esperado do pagamento é `expected_amount` (não `amount`), o
> valor efetivamente pago é `paid_amount`, e o detalhamento por componente
> (aluguel, garagem, taxa admin, comissão etc.) fica no JSON `breakdown`, não
> em colunas separadas. Anexos (comprovantes) ficam no JSON `attachments`.

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `rental_id` | UUID | Locação | FK → rentals(id), NOT NULL |
| `due_date` | DATE | Data de vencimento | NOT NULL |
| `expected_amount` | NUMERIC | Valor esperado do pagamento | NOT NULL |
| `paid_amount` | NUMERIC | Valor efetivamente pago | - |
| `admin_fee` | NUMERIC | Taxa administrativa | - |
| `late_fee` | NUMERIC | Multa por atraso | - |
| `late_fee_waived` | BOOLEAN | Multa perdoada/isentada | DEFAULT false |
| `interest` | NUMERIC | Juros por atraso | - |
| `interest_waived` | BOOLEAN | Juros perdoados/isentados | DEFAULT false |
| `discount_amount` | NUMERIC | Desconto aplicado | - |
| `status` | TEXT | Status | NOT NULL |
| `is_paid` | BOOLEAN | Flag de pagamento quitado | DEFAULT false |
| `payment_date` | DATE | Data efetiva do pagamento | - |
| `payment_time` | TEXT | Hora do pagamento | - |
| `payment_method` | TEXT | Método de pagamento | - |
| `payment_code` | TEXT | Código/identificador do pagamento | - |
| `payment_location` | TEXT | Local do pagamento | - |
| `pix_code` | TEXT | Código PIX (copia e cola) | - |
| `pix_code_type` | TEXT | Tipo do código PIX | - |
| `reference_month` | TEXT | Mês de referência | NOT NULL |
| `reference_year` | TEXT | Ano de referência | NOT NULL |
| `installment` | INTEGER | Número da parcela | - |
| `total_installments` | INTEGER | Total de parcelas | - |
| `breakdown` | JSONB | Detalhamento do valor (aluguel, garagem, taxas, comissões) | - |
| `partial_payments` | JSONB | Histórico de pagamentos parciais | - |
| `attachments` | JSONB | Comprovantes anexados | - |
| `notes` | TEXT | Observações | - |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Status possíveis:**
- `pending` - Aguardando pagamento
- `paid` - Pago
- `overdue` - Atrasado
- `cancelled` - Cancelado

---

### 6. deposit_installments (Parcelas de Caução)

**Descrição:** Parcelas do caução de cada locação

```sql
CREATE TABLE deposit_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number >= 1 AND installment_number <= 3),
  installment_total INTEGER NOT NULL CHECK (installment_total >= 1 AND installment_total <= 3),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  payment_date DATE,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  payment_method TEXT,
  pix_code TEXT,
  partner_commission DECIMAL(10,2),
  internal_commission DECIMAL(10,2),
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_deposit_installments_rental_id ON deposit_installments(rental_id);
CREATE INDEX idx_deposit_installments_status ON deposit_installments(status);
CREATE INDEX idx_deposit_installments_due_date ON deposit_installments(due_date);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `rental_id` | UUID | Referência para locação | FK → rentals(id) CASCADE |
| `installment_number` | INTEGER | Número da parcela | 1-3 |
| `installment_total` | INTEGER | Total de parcelas | 1-3 |
| `amount` | DECIMAL(10,2) | Valor da parcela | NOT NULL, > 0 |
| `due_date` | DATE | Data de vencimento | NOT NULL |
| `payment_date` | DATE | Data de pagamento | - |
| `paid_amount` | DECIMAL(10,2) | Valor pago | DEFAULT 0 |
| `status` | TEXT | Status da parcela | 4 valores possíveis |
| `payment_method` | TEXT | Método de pagamento | - |
| `pix_code` | TEXT | Código PIX | - |
| `partner_commission` | DECIMAL(10,2) | Comissão corretor parceiro | - |
| `internal_commission` | DECIMAL(10,2) | Comissão corretor interno | - |
| `notes` | TEXT | Observações | - |
| `attachments` | JSONB | Array de anexos | DEFAULT '[]' |
| `payment_code` | TEXT | Código/identificador do pagamento da parcela | adicionado depois da 1ª versão deste doc |
| `payment_location` | TEXT | Local do pagamento | idem |
| `discount_amount` | NUMERIC | Desconto aplicado na parcela | idem |
| `interest_amount` | NUMERIC | Juros aplicados na parcela (multa/juros congelados quando a parcela já está paga) | idem |
| `penalty_amount` | NUMERIC | Multa aplicada na parcela (idem — congelada quando paga) | idem |
| `receipt_url` | TEXT | URL do recibo gerado | idem |
| `reference_month` / `reference_year` | INTEGER | Mês/ano de referência da parcela | idem |
| `total_installments` | INTEGER | Campo legado, redundante com `installment_total` | opcional — prefira `installment_total` |
| `partial_payments` | JSONB | Histórico de pagamentos (total ou parciais) desta parcela — mesmo padrão de `payments.partial_payments` | DEFAULT '[]'::jsonb, adicionado na migração `20260818120000_add_partial_payments_to_deposit_installments.sql` (agosto/2026) |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Status possíveis:**
- `pending` - Aguardando pagamento
- `paid` - Pago
- `partial` - Pagamento parcial
- `overdue` - Atrasado

**Observações importantes:**
- Parcelas são criadas automaticamente ao criar uma locação com caução
- `pix_code` serve como comprovante de recebimento (quando preenchido = recebido)
- Comissões são valores únicos por locação (não por parcela)
- Datas de vencimento vêm dos campos `deposit_payment_date`, `deposit_installment2_payment_date` e `deposit_installment3_payment_date` da tabela `rentals`

> ✅ **Agosto/2026 — Recebimentos de caução na tela de Recebimentos.** Além do
> relatório "Detalhamento dos Cauções" (Financeiro), as parcelas de caução
> agora também aparecem na tela **Recebimentos**, junto com as de aluguel,
> com o mesmo comportamento: histórico de pagamentos por entrada em
> `partial_payments` (cada entrada = `{ amount, expected_amount,
> payment_date, payment_method, notes, attachments, registered_at }`), um
> recibo em PDF/WhatsApp por entrada do histórico (`DepositReceipt.tsx`), e a
> tela trava para edição quando a parcela está `paid` (multa/juros
> congelados em `penalty_amount`/`interest_amount`) — só libera clicando em
> "Editar", igual já funciona no recebimento de aluguel
> (`ManagePaymentForm.tsx`). Ver `docs/REGRAS_DE_NEGOCIO.md` seção "💰
> Caução" para o detalhamento das regras de negócio.

---

### 7. system_users (Usuários do Sistema)

**Descrição:** Usuários com permissões

```sql
CREATE TABLE system_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE UNIQUE INDEX idx_system_users_user_id ON system_users(user_id);
CREATE INDEX idx_system_users_role ON system_users(role);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `user_id` | UUID | ID do auth.users | FK → auth.users(id) |
| `name` | TEXT | Nome do usuário | NOT NULL |
| `email` | TEXT | Email | NOT NULL |
| `role` | TEXT | Perfil | admin/manager/operator/viewer |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Perfis (Roles):**
- `admin` - Administrador (acesso total)
- `manager` - Gerente (gestão completa)
- `operator` - Operador (CRUD básico)
- `viewer` - Visualizador (somente leitura)

---

### 8. user_location_permissions (Permissões por Localização)

**Descrição:** Define quais localizações cada usuário pode acessar

```sql
CREATE TABLE user_location_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, location_id)
);

-- Índices
CREATE INDEX idx_ulp_user ON user_location_permissions(user_id);
CREATE INDEX idx_ulp_location ON user_location_permissions(location_id);
```

---

### 9. admin_fee_exemptions (Isenções de Taxa)

**Descrição:** Inquilinos isentos de taxa administrativa

```sql
CREATE TABLE admin_fee_exemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id)
);

-- Índices
CREATE UNIQUE INDEX idx_exemptions_tenant ON admin_fee_exemptions(tenant_id);
```

---

### 10. location_expenses (Despesas de Localização)

**Descrição:** Despesas operacionais por localização

```sql
CREATE TABLE location_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_expenses_location ON location_expenses(location_id);
CREATE INDEX idx_expenses_date ON location_expenses(expense_date);
```

---

## 🔗 Relacionamentos

### 1:N (Um para Muitos)

#### locations → properties
```sql
-- Uma localização tem muitas propriedades
ALTER TABLE properties
  ADD CONSTRAINT fk_properties_location
  FOREIGN KEY (location_id)
  REFERENCES locations(id)
  ON DELETE RESTRICT;
```

#### properties → rentals
```sql
-- Uma propriedade tem muitas locações (histórico)
ALTER TABLE rentals
  ADD CONSTRAINT fk_rentals_property
  FOREIGN KEY (property_id)
  REFERENCES properties(id)
  ON DELETE RESTRICT;
```

#### tenants → rentals
```sql
-- Um inquilino pode ter muitas locações
ALTER TABLE rentals
  ADD CONSTRAINT fk_rentals_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(id)
  ON DELETE RESTRICT;
```

#### rentals → payments
```sql
-- Uma locação tem muitos pagamentos
ALTER TABLE payments
  ADD CONSTRAINT fk_payments_rental
  FOREIGN KEY (rental_id)
  REFERENCES rentals(id)
  ON DELETE CASCADE; -- Deleta pagamentos ao deletar locação
```

---

## 📑 Índices

### Índices por Tabela

#### properties
```sql
CREATE INDEX idx_properties_location ON properties(location_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_rent ON properties(monthly_rent);
CREATE INDEX idx_properties_search ON properties USING gin(to_tsvector('portuguese', address || ' ' || COALESCE(neighborhood, '') || ' ' || COALESCE(city, '')));
```

#### tenants
```sql
CREATE UNIQUE INDEX idx_tenants_cpf ON tenants(cpf);
CREATE INDEX idx_tenants_name ON tenants(name);
```

#### rentals
```sql
CREATE INDEX idx_rentals_property ON rentals(property_id);
CREATE INDEX idx_rentals_tenant ON rentals(tenant_id);
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_dates ON rentals(start_date, end_date);
```

#### payments
```sql
CREATE INDEX idx_payments_rental ON payments(rental_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_reference ON payments(reference_year, reference_month);
```

---

## ⚡ Triggers

### 1. Atualizar updated_at automaticamente

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas relevantes
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rentals_updated_at
  BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 2. Atualizar status da propriedade ao criar locação

```sql
CREATE OR REPLACE FUNCTION update_property_status_on_rental_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE properties
  SET status = 'occupied'
  WHERE id = NEW.property_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_property_status
  AFTER INSERT ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_property_status_on_rental_create();
```

---

### 3. Atualizar status da propriedade ao rescindir locação

```sql
CREATE OR REPLACE FUNCTION update_property_status_on_rental_terminate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'terminated' AND OLD.status = 'active' THEN
    UPDATE properties
    SET status = 'available'
    WHERE id = NEW.property_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_property_status_terminate
  AFTER UPDATE ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_property_status_on_rental_terminate();
```

---

## 🔒 Row Level Security (RLS)

**RLS habilitado em todas as tabelas** para segurança em nível de linha.

### Políticas de Segurança

#### properties

```sql
-- Habilitar RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Visualização: Apenas propriedades das localizações permitidas
CREATE POLICY "Users can view properties from their locations"
ON properties FOR SELECT
USING (
  location_id IN (
    SELECT location_id 
    FROM user_location_permissions 
    WHERE user_id = auth.uid()
  )
);

-- Inserção: Apenas Admin e Manager
CREATE POLICY "Admin and Manager can insert properties"
ON properties FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM system_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Atualização: Apenas Admin e Manager
CREATE POLICY "Admin and Manager can update properties"
ON properties FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM system_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Deleção: Apenas Admin
CREATE POLICY "Admin can delete properties"
ON properties FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM system_users 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
```

---

#### rentals

```sql
-- Habilitar RLS
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- Visualização: Apenas locações de propriedades permitidas
CREATE POLICY "Users can view rentals from their locations"
ON rentals FOR SELECT
USING (
  property_id IN (
    SELECT id FROM properties
    WHERE location_id IN (
      SELECT location_id 
      FROM user_location_permissions 
      WHERE user_id = auth.uid()
    )
  )
);

-- Inserção: Admin, Manager e Operator
CREATE POLICY "Admin, Manager and Operator can insert rentals"
ON rentals FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM system_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'operator')
  )
);
```

---

#### payments

```sql
-- Habilitar RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Visualização: Apenas pagamentos de locações permitidas
CREATE POLICY "Users can view payments from their rentals"
ON payments FOR SELECT
USING (
  rental_id IN (
    SELECT id FROM rentals
    WHERE property_id IN (
      SELECT id FROM properties
      WHERE location_id IN (
        SELECT location_id 
        FROM user_location_permissions 
        WHERE user_id = auth.uid()
      )
    )
  )
);
```

---

## 🔄 Migrações

Todas as migrações SQL estão na pasta:
```
supabase/migrations/
```

### Ordem de Execução

As migrações são executadas em ordem cronológica por timestamp:

```
20260115100545_migration_18896768.sql  # Criação inicial de tabelas
20260115170856_migration_7b1b59df.sql  # Adicionar campos
20260115210624_migration_4322d879.sql  # Adicionar índices
...
```

### Executar Migrações

**Via Supabase Dashboard:**
1. Acesse SQL Editor
2. Copie conteúdo do arquivo de migration
3. Execute

**Via Supabase CLI:**
```bash
supabase migration up
```

---

## 📊 Views Úteis

### view_active_rentals

**Descrição:** Locações ativas com dados completos

```sql
CREATE VIEW view_active_rentals AS
SELECT 
  r.*,
  p.address AS property_address,
  p.neighborhood AS property_neighborhood,
  p.city AS property_city,
  t.name AS tenant_name,
  t.cpf AS tenant_cpf,
  t.phone AS tenant_phone,
  l.name AS location_name
FROM rentals r
JOIN properties p ON r.property_id = p.id
JOIN tenants t ON r.tenant_id = t.id
JOIN locations l ON p.location_id = l.id
WHERE r.status = 'active';
```

---

### view_overdue_payments

**Descrição:** Pagamentos atrasados

```sql
CREATE VIEW view_overdue_payments AS
SELECT 
  pay.*,
  r.property_id,
  r.tenant_id,
  p.address AS property_address,
  t.name AS tenant_name,
  t.phone AS tenant_phone,
  DATE_PART('day', NOW() - pay.due_date) AS days_overdue
FROM payments pay
JOIN rentals r ON pay.rental_id = r.id
JOIN properties p ON r.property_id = p.id
JOIN tenants t ON r.tenant_id = t.id
WHERE pay.status = 'overdue'
ORDER BY pay.due_date ASC;
```

---

## 🎯 Consultas Úteis

### Propriedades disponíveis por localização

```sql
SELECT 
  l.name AS location,
  COUNT(*) AS total_available
FROM properties p
JOIN locations l ON p.location_id = l.id
WHERE p.status = 'available'
GROUP BY l.name
ORDER BY total_available DESC;
```

---

### Taxa de ocupação

```sql
SELECT 
  l.name AS location,
  COUNT(CASE WHEN p.status = 'occupied' THEN 1 END) AS occupied,
  COUNT(CASE WHEN p.status = 'available' THEN 1 END) AS available,
  ROUND(
    COUNT(CASE WHEN p.status = 'occupied' THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(*)::NUMERIC, 0) * 100, 
    2
  ) AS occupancy_rate
FROM properties p
JOIN locations l ON p.location_id = l.id
GROUP BY l.name
ORDER BY occupancy_rate DESC;
```

---

### Recebimentos do mês

```sql
SELECT 
  TO_CHAR(NOW(), 'YYYY-MM') AS month,
  COUNT(*) AS total_payments,
  SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending,
  SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) AS overdue
FROM payments
WHERE reference_year = TO_CHAR(NOW(), 'YYYY')
  AND reference_month = TO_CHAR(NOW(), 'MM');
```

---

### Inquilinos inadimplentes

```sql
SELECT 
  t.name,
  t.cpf,
  t.phone,
  p.address,
  COUNT(pay.id) AS overdue_count,
  SUM(pay.amount) AS total_overdue
FROM tenants t
JOIN rentals r ON t.id = r.tenant_id
JOIN properties p ON r.property_id = p.id
JOIN payments pay ON r.id = pay.rental_id
WHERE pay.status = 'overdue'
  AND r.status = 'active'
GROUP BY t.id, t.name, t.cpf, t.phone, p.address
ORDER BY total_overdue DESC;
```

---

**Próximos documentos:**
- [Arquitetura do Sistema](ARCHITECTURE.md)
- [Regras de Negócio](REGRAS_DE_NEGOCIO.md)
- [Documentação de API](API_DOCUMENTATION.md)
- [Guia de Deploy](DEPLOYMENT.md)