# 🗄️ Esquema do Banco de Dados

Este documento detalha o esquema completo do banco de dados PostgreSQL.

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

```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  address TEXT NOT NULL,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  monthly_rent DECIMAL(10,2) NOT NULL CHECK (monthly_rent > 0),
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking_spaces INTEGER,
  area DECIMAL(10,2),
  description TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'unavailable')),
  images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_properties_location ON properties(location_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_rent ON properties(monthly_rent);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `location_id` | UUID | Localização | FK → locations(id) |
| `address` | TEXT | Endereço completo | NOT NULL |
| `neighborhood` | TEXT | Bairro | - |
| `city` | TEXT | Cidade | - |
| `state` | TEXT | Estado (UF) | - |
| `zip_code` | TEXT | CEP | - |
| `monthly_rent` | DECIMAL(10,2) | Valor do aluguel | NOT NULL, > 0 |
| `property_type` | TEXT | Tipo (casa, apto, etc) | - |
| `bedrooms` | INTEGER | Quartos | - |
| `bathrooms` | INTEGER | Banheiros | - |
| `parking_spaces` | INTEGER | Vagas de garagem | - |
| `area` | DECIMAL(10,2) | Área (m²) | - |
| `description` | TEXT | Descrição | - |
| `status` | TEXT | Status | CHECK (4 valores) |
| `images` | TEXT[] | URLs das imagens | - |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Status possíveis:**
- `available` - Disponível
- `occupied` - Ocupado
- `maintenance` - Em manutenção
- `unavailable` - Indisponível

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

```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_day INTEGER NOT NULL CHECK (payment_day BETWEEN 1 AND 28),
  monthly_rent DECIMAL(10,2) NOT NULL CHECK (monthly_rent > 0),
  deposit DECIMAL(10,2),
  deposit_installments INTEGER DEFAULT 1 CHECK (deposit_installments IN (1, 2, 3)),
  deposit_installment_1 DECIMAL(10,2),
  deposit_installment_2 DECIMAL(10,2),
  deposit_installment_3 DECIMAL(10,2),
  deposit_installment_1_payment_date DATE,
  deposit_installment_2_payment_date DATE,
  deposit_installment_3_payment_date DATE,
  deposit_installment_1_pix_code TEXT,
  deposit_installment_2_pix_code TEXT,
  deposit_installment_3_pix_code TEXT,
  parking_value DECIMAL(10,2),
  broker_commission DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'terminated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (end_date > start_date)
);

-- Índices
CREATE INDEX idx_rentals_property ON rentals(property_id);
CREATE INDEX idx_rentals_tenant ON rentals(tenant_id);
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_dates ON rentals(start_date, end_date);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `property_id` | UUID | Propriedade locada | FK → properties(id) |
| `tenant_id` | UUID | Inquilino | FK → tenants(id) |
| `start_date` | DATE | Data de início | NOT NULL |
| `end_date` | DATE | Data de término | NOT NULL, > start_date |
| `payment_day` | INTEGER | Dia de pagamento | 1-28 |
| `monthly_rent` | DECIMAL(10,2) | Valor do aluguel | NOT NULL, > 0 |
| `deposit` | DECIMAL(10,2) | Valor do caução | - |
| `deposit_installments` | INTEGER | Nº de parcelas caução | 1, 2 ou 3 |
| `deposit_installment_1` | DECIMAL(10,2) | 1ª parcela caução | - |
| `deposit_installment_2` | DECIMAL(10,2) | 2ª parcela caução | - |
| `deposit_installment_3` | DECIMAL(10,2) | 3ª parcela caução | - |
| `deposit_installment_1_payment_date` | DATE | Data vencimento 1ª parcela | - |
| `deposit_installment_2_payment_date` | DATE | Data vencimento 2ª parcela | - |
| `deposit_installment_3_payment_date` | DATE | Data vencimento 3ª parcela | - |
| `deposit_installment_1_pix_code` | TEXT | PIX 1ª parcela | - |
| `deposit_installment_2_pix_code` | TEXT | PIX 2ª parcela | - |
| `deposit_installment_3_pix_code` | TEXT | PIX 3ª parcela | - |
| `parking_value` | DECIMAL(10,2) | Valor vaga garagem | - |
| `broker_commission` | DECIMAL(10,2) | Comissão corretor | - |
| `status` | TEXT | Status | 'active' ou 'terminated' |
| `created_at` | TIMESTAMP | Data de criação | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Data de atualização | DEFAULT NOW() |

**Novo campo:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `returned_deposit_amount` | DECIMAL(10,2) | Valor do caução devolvido | - |

**Uso:** Registra o valor efetivamente devolvido ao inquilino quando o contrato é cancelado. Pode ser diferente do valor original devido a descontos por danos.

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
  parking_amount DECIMAL(10,2),
  admin_fee DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  broker_commission DECIMAL(10,2),
  late_fee DECIMAL(10,2),
  interest DECIMAL(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_method TEXT,
  reference_month TEXT NOT NULL,
  reference_year TEXT NOT NULL,
  installment INTEGER,
  total_installments INTEGER,
  type TEXT,
  attachment TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_payments_rental ON payments(rental_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_reference ON payments(reference_year, reference_month);
```

**Colunas:**

| Coluna | Tipo | Descrição | Constraints |
|--------|------|-----------|-------------|
| `id` | UUID | Identificador único | PRIMARY KEY |
| `rental_id` | UUID | Locação | FK → rentals(id) CASCADE |
| `due_date` | DATE | Data de vencimento | NOT NULL |
| `amount` | DECIMAL(10,2) | Valor total | NOT NULL |
| `rent_amount` | DECIMAL(10,2) | Valor do aluguel | - |
| `parking_amount` | DECIMAL(10,2) | Valor da vaga | - |
| `admin_fee` | DECIMAL(10,2) | Taxa administrativa | - |
| `deposit_amount` | DECIMAL(10,2) | Parcela do caução | - |
| `broker_commission` | DECIMAL(10,2) | Comissão corretor | - |
| `late_fee` | DECIMAL(10,2) | Multa por atraso | - |
| `interest` | DECIMAL(10,2) | Juros por atraso | - |
| `status` | TEXT | Status | 4 valores possíveis |
| `payment_date` | DATE | Data efetiva pagamento | - |
| `payment_method` | TEXT | Método de pagamento | - |
| `reference_month` | TEXT | Mês de referência | NOT NULL |
| `reference_year` | TEXT | Ano de referência | NOT NULL |
| `installment` | INTEGER | Número da parcela | - |
| `total_installments` | INTEGER | Total de parcelas | - |
| `type` | TEXT | Tipo de pagamento | - |
| `attachment` | TEXT | URL do comprovante | - |
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
- [Regras de Negócio](BUSINESS_RULES.md)
- [Documentação de API](API_DOCUMENTATION.md)
- [Guia de Deploy](DEPLOYMENT.md)