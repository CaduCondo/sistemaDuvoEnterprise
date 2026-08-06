# 📡 Documentação de API

Este documento detalha todas as APIs, serviços e integrações do sistema.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Autenticação](#autenticação)
- [Serviços Frontend](#serviços-frontend)
- [API Routes](#api-routes)
- [Integrações Externas](#integrações-externas)
- [Tipos TypeScript](#tipos-typescript)

---

## 🎯 Visão Geral

O sistema utiliza uma arquitetura de serviços que abstrai as chamadas ao Supabase:

```
┌─────────────────────────────────────────────────────────┐
│                    COMPONENTES REACT                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   CUSTOM HOOKS                          │
│  useProperties, useRentals, usePayments, etc.          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                     SERVICES                            │
│  propertyService, rentalService, paymentService, etc.   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  SUPABASE CLIENT                        │
│  Database, Auth, Storage                               │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Autenticação

### authService.ts

**Localização:** `src/services/authService.ts`

#### Métodos Disponíveis

##### 1. signIn
```typescript
async function signIn(email: string, password: string): Promise<User>
```

**Descrição:** Autentica usuário com email e senha

**Parâmetros:**
- `email` (string) - Email do usuário
- `password` (string) - Senha do usuário

**Retorno:** Objeto `User` do Supabase Auth

**Exemplo:**
```typescript
import { signIn } from "@/services/authService";

try {
  const user = await signIn("user@example.com", "senha123");
  console.log("Usuário autenticado:", user);
} catch (error) {
  console.error("Erro ao fazer login:", error);
}
```

**Erros Possíveis:**
- `Invalid login credentials` - Email ou senha incorretos
- `Email not confirmed` - Email não verificado

---

##### 2. signOut
```typescript
async function signOut(): Promise<void>
```

**Descrição:** Desloga o usuário atual

**Exemplo:**
```typescript
import { signOut } from "@/services/authService";

await signOut();
```

---

##### 3. getCurrentUser
```typescript
async function getCurrentUser(): Promise<User | null>
```

**Descrição:** Retorna o usuário autenticado atual

**Retorno:** Objeto `User` ou `null` se não autenticado

**Exemplo:**
```typescript
import { getCurrentUser } from "@/services/authService";

const user = await getCurrentUser();
if (user) {
  console.log("Usuário logado:", user.email);
}
```

---

##### 4. getSession
```typescript
async function getSession(): Promise<Session | null>
```

**Descrição:** Retorna a sessão atual com token JWT

**Retorno:** Objeto `Session` ou `null`

**Exemplo:**
```typescript
import { getSession } from "@/services/authService";

const session = await getSession();
if (session) {
  console.log("Token JWT:", session.access_token);
}
```

---

### Sistema de Autenticação Completo

#### 1. login (via authService)

```typescript
async function login(credentials: {
  email: string;
  password: string;
}): Promise<LoginResult>
```

**Descrição:** Autentica usuário com sistema de 3 tentativas

**Parâmetros:**
- `email` (string) - Email ou username
- `password` (string) - Senha do usuário

**Retorno:**
```typescript
interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    username: string;
    role: "admin" | "financial" | "broker";
    theme?: string;
  };
  error?: string;
}
```

**Validações Automáticas:**

1. **Verificação de bloqueio:**
   - Se `blocked_until` > agora → erro de bloqueio
   - Mostra tempo restante em minutos

2. **Validação de senha:**
   - Senha correta → login bem-sucedido, reset tentativas
   - Senha incorreta → incrementa tentativas

3. **Sistema de 3 tentativas:**
   - 1ª erro: "Senha incorreta. Você tem mais 2 tentativas."
   - 2ª erro: "Senha incorreta. Você tem mais 1 tentativa."
   - 3ª erro: Bloqueio por 30 minutos

4. **Troca de senha obrigatória:**
   - Se `requires_password_change = true` → redireciona para tela de troca

**Exemplo:**
```typescript
import { login } from "@/lib/auth";

const result = await login({
  email: "usuario@exemplo.com",
  password: "senha123"
});

if (result.success && result.user) {
  // Verificar se precisa trocar senha
  if (result.user.requires_password_change) {
    // Mostrar tela de troca de senha
  } else {
    // Redirecionar para dashboard
    window.location.href = "/dashboard";
  }
} else {
  console.error(result.error);
}
```

---

#### 2. forgotPassword

```typescript
async function forgotPassword(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}>
```

**Descrição:** Gera senha temporária e envia email de recuperação

**Parâmetros:**
- `email` (string) - Email do usuário

**Processo:**

1. Valida se email existe no sistema
2. Gera senha temporária (12 caracteres)
3. Atualiza banco de dados:
   - `password_hash` = nova senha
   - `requires_password_change = true`
   - `temporary_password = true`
   - `login_attempts = 0`
   - `blocked_until = null`
4. Envia email com senha temporária
5. Retorna sucesso

**Retorno:**
```typescript
{
  success: true,
  message: "Email enviado com sucesso"
}
```

**Erros:**
```typescript
{
  success: false,
  error: "E-mail não encontrado no sistema"
}
```

**Exemplo:**
```typescript
const result = await forgotPassword("usuario@exemplo.com");

if (result.success) {
  toast({
    title: "Email enviado!",
    description: "Verifique sua caixa de entrada"
  });
}
```

---

#### 3. changePassword

```typescript
async function changePassword(
  userId: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}>
```

**Descrição:** Atualiza senha do usuário após validação

**Parâmetros:**
- `userId` (string) - ID do usuário
- `newPassword` (string) - Nova senha

**Validações da nova senha:**
- ✅ Pelo menos 1 letra maiúscula
- ✅ Pelo menos 1 letra minúscula
- ✅ Pelo menos 1 número
- ✅ Mínimo 6 caracteres
- ✅ Máximo 12 caracteres

**Processo:**

1. Valida requisitos da senha
2. Atualiza `password_hash`
3. Define `requires_password_change = false`
4. Define `temporary_password = false`
5. Reseta `login_attempts = 0`

**Exemplo:**
```typescript
const result = await changePassword(userId, "NovaSenha123");

if (result.success) {
  toast({ title: "Senha atualizada!" });
  window.location.href = "/dashboard";
}
```

---

## 👥 Serviços de Usuários

### systemUserService.ts

**Localização:** `src/services/systemUserService.ts`

#### Métodos Disponíveis

##### 1. fetchUsers

```typescript
async function fetchUsers(): Promise<SystemUser[]>
```

**Descrição:** Busca todos os usuários do sistema

**Retorno:** Array de `SystemUser`

**Exemplo:**
```typescript
import { fetchUsers } from "@/services/systemUserService";

const users = await fetchUsers();
console.log("Total de usuários:", users.length);
```

---

##### 2. createUser

```typescript
async function createUser(userData: {
  name: string;
  email: string;
  username?: string;
  phone?: string | null;
  role: "admin" | "broker" | "financial";
  password: string;
  active?: boolean;
  requires_password_change?: boolean;
  temporary_password?: boolean;
}): Promise<SystemUser>
```

**Descrição:** Cria novo usuário com senha temporária

**Parâmetros:**
- `name` (string, obrigatório) - Nome completo
- `email` (string, obrigatório) - Email (único)
- `username` (string, opcional) - Username (único)
- `phone` (string, opcional) - Telefone
- `role` (string, obrigatório) - Perfil
- `password` (string, obrigatório) - Senha temporária
- `active` (boolean, opcional) - Status (padrão: true)
- `requires_password_change` (boolean, opcional) - Forçar troca
- `temporary_password` (boolean, opcional) - Senha é temporária

**Validações:**
- Email deve conter @
- Email deve ser único
- Telefone deve ter 10 ou 11 dígitos (se informado)

**Retorno:** Objeto `SystemUser` criado

**Exemplo:**
```typescript
import { createUser } from "@/services/systemUserService";

const newUser = await createUser({
  name: "João Silva",
  email: "joao@exemplo.com",
  phone: "(11) 98765-4321",
  role: "broker",
  password: "TempPass123", // Gerada automaticamente
  requires_password_change: true,
  temporary_password: true
});
```

---

##### 3. updateUser

```typescript
async function updateUser(
  id: string,
  updates: Partial<SystemUser>
): Promise<SystemUser>
```

**Descrição:** Atualiza dados de um usuário

**Parâmetros:**
- `id` (string) - ID do usuário
- `updates` (Partial<SystemUser>) - Campos a atualizar

**Campos editáveis:**
- `name` - Nome completo
- `email` - Email
- `phone` - Telefone
- `role` - Perfil
- `active` - Status
- `theme` - Tema (light/dark)

**Não editáveis diretamente:**
- `password` - Use `resetPassword` ou `changePassword`

**Exemplo:**
```typescript
const updated = await updateUser("user-123", {
  name: "João Silva Santos",
  phone: "(11) 99999-8888",
  active: true,
  theme: "dark"
});
```

---

##### 4. deleteUser

```typescript
async function deleteUser(id: string): Promise<void>
```

**Descrição:** Deleta um usuário

**Parâmetros:**
- `id` (string) - ID do usuário

**Validações:**
- Apenas Admin pode deletar
- Não pode deletar usuário ativo com permissões

**Exemplo:**
```typescript
await deleteUser("user-123");
```

---

##### 5. resetUserPassword

```typescript
async function resetUserPassword(userId: string): Promise<{
  success: boolean;
  temporaryPassword?: string;
  error?: string;
}>
```

**Descrição:** Reseta senha do usuário e envia email

**Parâmetros:**
- `userId` (string) - ID do usuário

**Processo:**

1. Busca dados do usuário (nome, email)
2. Gera senha temporária (12 caracteres)
3. Atualiza banco de dados:
   - `password_hash` = nova senha
   - `requires_password_change = true`
   - `temporary_password = true`
   - `login_attempts = 0`
   - `blocked_until = null`
4. Envia email informando sobre reset
5. Retorna senha temporária

**Retorno:**
```typescript
{
  success: true,
  temporaryPassword: "Ab3kT9mN2pQ1"
}
```

**Exemplo:**
```typescript
const result = await resetUserPassword("user-123");

if (result.success) {
  toast({
    title: "Senha resetada!",
    description: `Nova senha: ${result.temporaryPassword}`
  });
}
```

---

##### 6. updateUserTheme

```typescript
async function updateUserTheme(
  userId: string,
  theme: "light" | "dark"
): Promise<void>
```

**Descrição:** Atualiza tema do usuário

**Parâmetros:**
- `userId` (string) - ID do usuário
- `theme` (string) - "light" ou "dark"

**Exemplo:**
```typescript
await updateUserTheme("user-123", "dark");

// Aplicar tema na interface
document.documentElement.classList.toggle("dark", theme === "dark");
```

---

### Tipo SystemUser

```typescript
interface SystemUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string | null;
  cpf?: string | null;
  rg?: string | null;
  photo?: string | null;
  role: "admin" | "financial" | "broker";
  active: boolean;
  theme?: string | null;
  requires_password_change?: boolean;
  temporary_password?: boolean;
  login_attempts?: number;
  blocked_until?: string | null;
  created_at: string;
  updated_at?: string;
}
```

---

## 🏠 Serviços de Propriedades

### propertyService.ts

**Localização:** `src/services/propertyService.ts`

#### Métodos Disponíveis

##### 1. fetchProperties
```typescript
async function fetchProperties(
  locationId?: string,
  filters?: PropertyFilters
): Promise<Property[]>
```

**Descrição:** Busca todas as propriedades com filtros opcionais

**Parâmetros:**
- `locationId` (string, opcional) - Filtrar por localização
- `filters` (PropertyFilters, opcional) - Filtros adicionais

**Tipo PropertyFilters:**
```typescript
interface PropertyFilters {
  status?: "available" | "occupied" | "maintenance" | "unavailable";
  propertyType?: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  bathrooms?: number;
  search?: string; // Busca em endereço, bairro, cidade
}
```

**Retorno:** Array de `Property`

**Exemplo:**
```typescript
import { fetchProperties } from "@/services/propertyService";

// Buscar todas as propriedades
const allProperties = await fetchProperties();

// Buscar apenas disponíveis
const available = await fetchProperties(undefined, {
  status: "available"
});

// Buscar por localização e filtros
const filtered = await fetchProperties("location-id-123", {
  status: "available",
  minRent: 1000,
  maxRent: 2000,
  bedrooms: 2
});
```

---

##### 2. fetchPropertyById
```typescript
async function fetchPropertyById(id: string): Promise<Property>
```

**Descrição:** Busca uma propriedade específica por ID

**Parâmetros:**
- `id` (string) - ID da propriedade

**Retorno:** Objeto `Property`

**Exemplo:**
```typescript
import { fetchPropertyById } from "@/services/propertyService";

const property = await fetchPropertyById("abc-123");
console.log("Propriedade:", property.address);
```

**Erros Possíveis:**
- `Property not found` - Propriedade não existe ou sem permissão

---

##### 3. createProperty
```typescript
async function createProperty(property: PropertyInsert): Promise<Property>
```

**Descrição:** Cria nova propriedade

**Parâmetros:**
- `property` (PropertyInsert) - Dados da propriedade

**Tipo PropertyInsert:**
```typescript
interface PropertyInsert {
  location_id: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  monthly_rent: number;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  area?: number;
  description?: string;
  images?: string[];
}
```

**Retorno:** Objeto `Property` criado

**Exemplo:**
```typescript
import { createProperty } from "@/services/propertyService";

const newProperty = await createProperty({
  location_id: "location-123",
  address: "Rua das Flores, 123",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  zip_code: "01234-567",
  monthly_rent: 1500.00,
  property_type: "apartamento",
  bedrooms: 2,
  bathrooms: 1,
  parking_spaces: 1,
  area: 65.00,
  description: "Apartamento bem localizado"
});
```

**Validações:**
- ✅ `location_id` obrigatório
- ✅ `address` obrigatório
- ✅ `monthly_rent` deve ser > 0
- ✅ Usuário deve ter permissão de criação

---

##### 4. updateProperty
```typescript
async function updateProperty(
  id: string,
  updates: Partial<PropertyInsert>
): Promise<Property>
```

**Descrição:** Atualiza uma propriedade existente

**Parâmetros:**
- `id` (string) - ID da propriedade
- `updates` (Partial<PropertyInsert>) - Campos a atualizar

**Retorno:** Objeto `Property` atualizado

**Exemplo:**
```typescript
import { updateProperty } from "@/services/propertyService";

const updated = await updateProperty("abc-123", {
  monthly_rent: 1800.00,
  description: "Nova descrição"
});
```

---

##### 5. deleteProperty
```typescript
async function deleteProperty(id: string): Promise<void>
```

**Descrição:** Deleta uma propriedade

**Parâmetros:**
- `id` (string) - ID da propriedade

**Exemplo:**
```typescript
import { deleteProperty } from "@/services/propertyService";

await deleteProperty("abc-123");
```

**Validações:**
- ✅ Propriedade não pode ter locações ativas
- ✅ Apenas Admin/Manager podem deletar

---

##### 6. uploadPropertyImages
```typescript
async function uploadPropertyImages(
  propertyId: string,
  files: File[]
): Promise<string[]>
```

**Descrição:** Faz upload de imagens da propriedade

**Parâmetros:**
- `propertyId` (string) - ID da propriedade
- `files` (File[]) - Array de arquivos de imagem

**Retorno:** Array de URLs das imagens

**Exemplo:**
```typescript
import { uploadPropertyImages } from "@/services/propertyService";

const files = [file1, file2, file3];
const imageUrls = await uploadPropertyImages("abc-123", files);

// Atualizar propriedade com as novas imagens
await updateProperty("abc-123", {
  images: imageUrls
});
```

**Validações:**
- ✅ Máximo 20 imagens por propriedade
- ✅ Tamanho máximo: 5MB por imagem
- ✅ Formatos aceitos: JPG, PNG, WEBP

---

## 👥 Serviços de Inquilinos

### tenantService.ts

**Localização:** `src/services/tenantService.ts`

#### Métodos Disponíveis

##### 1. fetchTenants
```typescript
async function fetchTenants(filters?: TenantFilters): Promise<Tenant[]>
```

**Descrição:** Busca todos os inquilinos com filtros opcionais

**Parâmetros:**
- `filters` (TenantFilters, opcional) - Filtros

**Tipo TenantFilters:**
```typescript
interface TenantFilters {
  search?: string; // Busca em nome, CPF, email
  hasActiveRental?: boolean;
}
```

**Retorno:** Array de `Tenant`

**Exemplo:**
```typescript
import { fetchTenants } from "@/services/tenantService";

// Buscar todos
const all = await fetchTenants();

// Buscar apenas com locações ativas
const active = await fetchTenants({ hasActiveRental: true });

// Buscar por nome/CPF
const filtered = await fetchTenants({ search: "João" });
```

---

##### 2. createTenant
```typescript
async function createTenant(tenant: TenantInsert): Promise<Tenant>
```

**Descrição:** Cria novo inquilino

**Parâmetros:**
- `tenant` (TenantInsert) - Dados do inquilino

**Tipo TenantInsert:**
```typescript
interface TenantInsert {
  name: string;
  cpf: string;
  rg?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
}
```

**Retorno:** Objeto `Tenant` criado

**Exemplo:**
```typescript
import { createTenant } from "@/services/tenantService";

const tenant = await createTenant({
  name: "João Silva",
  cpf: "123.456.789-00",
  rg: "12.345.678-9",
  phone: "(11) 98765-4321",
  email: "joao@example.com"
});
```

**Validações:**
- ✅ `name` obrigatório (mínimo 3 caracteres)
- ✅ `cpf` obrigatório e único
- ✅ `cpf` deve ser válido (validação de dígitos)
- ✅ `email` deve ser válido (se informado)

---

## 📝 Serviços de Locações

### rentalService.ts

**Localização:** `src/services/rentalService.ts`

#### Métodos Disponíveis

##### 1. createRental
```typescript
async function createRental(rental: RentalInsert): Promise<Rental>
```

**Descrição:** Cria nova locação e gera recebimentos automaticamente

**Parâmetros:**
- `rental` (RentalInsert) - Dados da locação

**Tipo RentalInsert:**
```typescript
interface RentalInsert {
  property_id: string;
  tenant_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payment_day: number; // 1-28
  monthly_rent: number;
  deposit?: number;
  deposit_installments?: number; // 1, 2 ou 3
  deposit_installment_1?: number;
  deposit_installment_2?: number;
  deposit_installment_3?: number;
  deposit_installment_1_payment_date?: string;
  deposit_installment_2_payment_date?: string;
  deposit_installment_3_payment_date?: string;
  deposit_installment_1_pix_code?: string;
  deposit_installment_2_pix_code?: string;
  deposit_installment_3_pix_code?: string;
  parking_value?: number;
  broker_commission?: number;
}
```

**Retorno:** Objeto `Rental` criado

**Exemplo:**
```typescript
import { createRental } from "@/services/rentalService";

const rental = await createRental({
  property_id: "prop-123",
  tenant_id: "tenant-456",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  payment_day: 5,
  monthly_rent: 1000.00,
  deposit: 1200.00,
  deposit_installments: 3,
  deposit_installment_1: 400.00,
  deposit_installment_2: 400.00,
  deposit_installment_3: 400.00,
  parking_value: 200.00,
  broker_commission: 1200.00
});
```

**Validações:**
- ✅ Propriedade deve estar `available`
- ✅ `end_date` deve ser maior que `start_date`
- ✅ `payment_day` entre 1 e 28
- ✅ `monthly_rent` > 0
- ✅ Soma das parcelas de caução = valor total do caução

**Ações Automáticas:**
1. Cria locação no banco
2. Atualiza status da propriedade para `occupied`
3. Gera recebimentos mensais (aluguel + taxa admin)
4. Gera parcelas de caução (se parcelado)
5. Gera comissão de corretor (se informada)

---

##### 2. terminateRental
```typescript
async function terminateRental(
  rentalId: string,
  terminationDate: string
): Promise<void>
```

**Descrição:** Rescinde contrato e recalcula valores

**Parâmetros:**
- `rentalId` (string) - ID da locação
- `terminationDate` (string) - Data da rescisão (YYYY-MM-DD)

**Exemplo:**
```typescript
import { terminateRental } from "@/services/terminationService";

await terminateRental("rental-123", "2026-04-10");
```

**Ações Automáticas:**
1. Calcula aluguel proporcional
2. Busca/cria recebimento do mês da rescisão
3. Calcula caução corrigido pelo IGPM
4. Atualiza recebimento do mês (valores proporcionais - caução)
5. Deleta todos os recebimentos futuros
6. Recalcula números de parcelas
7. Atualiza data fim da locação
8. Muda status da propriedade para `available`

---

## 💰 Serviços de Pagamentos

### paymentService.ts

**Localização:** `src/services/paymentService.ts`

#### Métodos Disponíveis

##### 1. fetchPayments
```typescript
async function fetchPayments(
  rentalId?: string,
  filters?: PaymentFilters
): Promise<Payment[]>
```

**Descrição:** Busca pagamentos com filtros

**Parâmetros:**
- `rentalId` (string, opcional) - Filtrar por locação
- `filters` (PaymentFilters, opcional) - Filtros adicionais

**Tipo PaymentFilters:**
```typescript
interface PaymentFilters {
  status?: "pending" | "paid" | "overdue" | "cancelled";
  startDate?: string;
  endDate?: string;
  locationId?: string;
}
```

**Retorno:** Array de `Payment`

**Exemplo:**
```typescript
import { fetchPayments } from "@/services/paymentService";

// Buscar todos os pagamentos
const all = await fetchPayments();

// Buscar pagamentos de uma locação
const rentalPayments = await fetchPayments("rental-123");

// Buscar apenas atrasados
const overdue = await fetchPayments(undefined, {
  status: "overdue"
});
```

---

##### 2. markAsPaid
```typescript
async function markAsPaid(
  paymentId: string,
  data: MarkAsPaidData
): Promise<Payment>
```

**Descrição:** Marca pagamento como pago

**Parâmetros:**
- `paymentId` (string) - ID do pagamento
- `data` (MarkAsPaidData) - Dados do pagamento

**Tipo MarkAsPaidData:**
```typescript
interface MarkAsPaidData {
  payment_date: string; // YYYY-MM-DD
  payment_method: string; // "pix", "transferencia", "dinheiro", etc.
  attachment?: string; // URL do comprovante
  notes?: string;
  apply_late_fees?: boolean; // Default: true
}
```

**Retorno:** Objeto `Payment` atualizado

**Exemplo:**
```typescript
import { markAsPaid } from "@/services/paymentService";

const paid = await markAsPaid("payment-123", {
  payment_date: "2026-01-15",
  payment_method: "pix",
  apply_late_fees: true
});
```

**Ações Automáticas:**
- Se `payment_date` > `due_date` e `apply_late_fees = true`:
  - Calcula multa (2% sobre aluguel)
  - Calcula juros (1% a.m. proporcional)
  - Adiciona ao valor total

---

##### 3. calculateLateFees
```typescript
async function calculateLateFees(
  paymentId: string
): Promise<{ late_fee: number; interest: number }>
```

**Descrição:** Calcula multa e juros de um pagamento

**Parâmetros:**
- `paymentId` (string) - ID do pagamento

**Retorno:** Objeto com `late_fee` e `interest`

**Exemplo:**
```typescript
import { calculateLateFees } from "@/services/paymentService";

const fees = await calculateLateFees("payment-123");
console.log("Multa:", fees.late_fee);
console.log("Juros:", fees.interest);
```

---

##### 4. generateReceipt
```typescript
async function generateReceipt(paymentId: string): Promise<Blob>
```

**Descrição:** Gera PDF do recibo de pagamento

**Parâmetros:**
- `paymentId` (string) - ID do pagamento

**Retorno:** Blob do PDF

**Exemplo:**
```typescript
import { generateReceipt } from "@/services/paymentService";

const pdfBlob = await generateReceipt("payment-123");

// Download automático
const url = URL.createObjectURL(pdfBlob);
const a = document.createElement("a");
a.href = url;
a.download = "recibo.pdf";
a.click();
```

---

## 💼 Serviços de Cauções

### depositInstallmentService.ts

**Localização:** `src/services/depositInstallmentService.ts`

#### Métodos Disponíveis

##### 1. createDepositInstallments
```typescript
async function createDepositInstallments(
  rentalId: string,
  installments: Array<{
    installment_number: number;
    total_installments: number;
    amount: number;
    due_date: string;
    payment_date?: string | null;
    pix_code?: string | null;
    status?: "pending" | "paid" | "partial";
    paid_amount?: number;
    payment_method?: string | null;
  }>
): Promise<DepositInstallment[]>
```

**Descrição:** Cria parcelas de caução para uma locação

**Parâmetros:**
- `rentalId` (string) - ID da locação
- `installments` (Array) - Array com dados de cada parcela

**Retorno:** Array de `DepositInstallment` criado

**Validação:** Verifica se já existem parcelas antes de criar (evita duplicatas)

**Exemplo:**
```typescript
import { createDepositInstallments } from "@/services/depositInstallmentService";

const installments = await createDepositInstallments("rental-123", [
  {
    installment_number: 1,
    total_installments: 3,
    amount: 400.00,
    due_date: "2026-01-01",
    status: "pending"
  },
  {
    installment_number: 2,
    total_installments: 3,
    amount: 400.00,
    due_date: "2026-02-01",
    status: "pending"
  },
  {
    installment_number: 3,
    total_installments: 3,
    amount: 400.00,
    due_date: "2026-03-01",
    status: "pending"
  }
]);
```

---

##### 2. getDepositInstallmentsByRental
```typescript
async function getDepositInstallmentsByRental(
  rentalId: string
): Promise<DepositInstallment[]>
```

**Descrição:** Busca todas as parcelas de caução de uma locação

**Parâmetros:**
- `rentalId` (string) - ID da locação

**Retorno:** Array de `DepositInstallment` ordenado por `installment_number`

**Exemplo:**
```typescript
import { getDepositInstallmentsByRental } from "@/services/depositInstallmentService";

const installments = await getDepositInstallmentsByRental("rental-123");
console.log("Parcelas:", installments.length);
```

---

##### 3. updateDepositInstallment
```typescript
async function updateDepositInstallment(
  id: string,
  updates: Partial<DepositInstallment>
): Promise<DepositInstallment>
```

**Descrição:** Atualiza uma parcela de caução

**Parâmetros:**
- `id` (string) - ID da parcela
- `updates` (Partial<DepositInstallment>) - Campos a atualizar

**Retorno:** Objeto `DepositInstallment` atualizado

**Campos editáveis:**
- `amount` - Valor da parcela
- `pix_code` - Código PIX
- `partner_commission` - Comissão parceiro
- `internal_commission` - Comissão interno
- `payment_date` - Data de pagamento
- `paid_amount` - Valor pago
- `status` - Status
- `notes` - Observações

**Exemplo:**
```typescript
import { updateDepositInstallment } from "@/services/depositInstallmentService";

// Marcar como recebido via PIX
const updated = await updateDepositInstallment("installment-123", {
  pix_code: "00020126580014br.gov.bcb.pix...",
  status: "paid",
  payment_date: "2026-01-05"
});
```

---

##### 4. markDepositInstallmentAsPaid
```typescript
async function markDepositInstallmentAsPaid(
  id: string,
  paymentDate: string,
  paymentMethod: string,
  notes?: string,
  attachments?: string[]
): Promise<DepositInstallment>
```

**Descrição:** Marca uma parcela de caução como paga

**Parâmetros:**
- `id` (string) - ID da parcela
- `paymentDate` (string) - Data do pagamento (YYYY-MM-DD)
- `paymentMethod` (string) - Método de pagamento
- `notes` (string, opcional) - Observações
- `attachments` (string[], opcional) - URLs de comprovantes

**Retorno:** Objeto `DepositInstallment` atualizado

**Exemplo:**
```typescript
import { markDepositInstallmentAsPaid } from "@/services/depositInstallmentService";

const paid = await markDepositInstallmentAsPaid(
  "installment-123",
  "2026-01-05",
  "PIX",
  "Recebido via PIX",
  ["https://storage.supabase.co/comprovante.pdf"]
);
```

---

##### 5. deleteDepositInstallmentsByRental
```typescript
async function deleteDepositInstallmentsByRental(
  rentalId: string
): Promise<void>
```

**Descrição:** Deleta todas as parcelas de caução de uma locação

**Parâmetros:**
- `rentalId` (string) - ID da locação

**Uso:** Chamado automaticamente ao deletar uma locação (CASCADE)

**Exemplo:**
```typescript
import { deleteDepositInstallmentsByRental } from "@/services/depositInstallmentService";

await deleteDepositInstallmentsByRental("rental-123");
```

---

### Tipo DepositInstallment

```typescript
interface DepositInstallment {
  id: string;
  rental_id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  payment_date: string | null;
  paid_amount: number;
  payment_method: string | null;
  pix_code: string | null;
  partner_commission?: number;
  internal_commission?: number;
  status: "pending" | "paid" | "partial" | "overdue";
  notes: string | null;
  attachments: string[];
  created_at: string;
  updated_at: string;
}
```

---

## 🔌 API Routes

### Next.js API Routes

**Localização:** `src/pages/api/`

#### 1. Upload de Arquivos

**Endpoint:** `POST /api/upload`

**Descrição:** Upload de imagens e documentos

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer {JWT_TOKEN}
```

**Body (FormData):**
```typescript
{
  file: File;
  type: "property-image" | "document" | "receipt";
}
```

**Response:**
```typescript
{
  success: true,
  url: string; // URL do arquivo
}
```

**Exemplo (Frontend):**
```typescript
const formData = new FormData();
formData.append("file", file);
formData.append("type", "property-image");

const response = await fetch("/api/upload", {
  method: "POST",
  body: formData,
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});

const data = await response.json();
console.log("URL:", data.url);
```

---

#### 2. Propriedades Disponíveis

**Endpoint:** `GET /api/properties/available`

**Descrição:** Lista propriedades disponíveis (público)

**Query Params:**
```typescript
{
  location?: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  bathrooms?: number;
}
```

**Response:**
```typescript
{
  properties: Property[];
  total: number;
}
```

**Exemplo:**
```bash
GET /api/properties/available?location=sao-paulo&minRent=1000&maxRent=2000
```

---

#### 3. POST /api/tenants

**Descrição**: Cria um novo inquilino

**Autenticação**: Bearer Token (JWT)

**Permissões**: Admin, Manager, Operator

**Request Body**:
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "(11) 98765-4321",
  "document_type": "cpf",
  "document": "123.456.789-00",
  "rg": "12.345.678-9",
  "occupation": "Engenheiro Civil",
  "marital_status": "casado",
  "monthly_income": 5500.00,
  "cep": "01310-100",
  "street": "Av. Paulista",
  "number": "1000",
  "complement": "Apto 101",
  "neighborhood": "Bela Vista",
  "city": "São Paulo",
  "state": "SP",
  "status": "active"
}
```

**Campos obrigatórios**:
- `name` (string): Nome completo
- `email` (string): E-mail válido e único
- `phone` (string): Telefone no formato (XX) XXXXX-XXXX
- `document_type` (string): "cpf" ou "cnpj"
- `document` (string): CPF ou CNPJ formatado

**Campos opcionais**:
- `rg` (string): RG do inquilino
- `occupation` (string): Profissão do inquilino (máx 255 caracteres)
- `marital_status` (string): Estado civil - valores: "solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"
- `monthly_income` (number): Renda mensal em R$ (formato decimal: 5500.00)
- `cep` (string): CEP no formato 00000-000
- `street` (string): Logradouro
- `number` (string): Número
- `complement` (string): Complemento
- `neighborhood` (string): Bairro
- `city` (string): Cidade
- `state` (string): Estado (sigla UF)
- `status` (string): "active", "rented", "inactive" (padrão: "active")

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "(11) 98765-4321",
    "document_type": "cpf",
    "document": "123.456.789-00",
    "rg": "12.345.678-9",
    "occupation": "Engenheiro Civil",
    "marital_status": "casado",
    "monthly_income": 5500.00,
    "cep": "01310-100",
    "street": "Av. Paulista",
    "number": "1000",
    "complement": "Apto 101",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "status": "active",
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```

**Validações**:
- Email deve ser único no sistema
- CPF/CNPJ deve ser válido e único
- Telefone deve estar no formato brasileiro
- `occupation`: máximo 255 caracteres
- `marital_status`: deve ser um dos valores aceitos
- `monthly_income`: deve ser >= 0

**Response de Erro (400 Bad Request)**:
```json
{
  "success": false,
  "error": "E-mail já cadastrado no sistema"
}
```

**Response de Erro (422 Unprocessable Entity)**:
```json
{
  "success": false,
  "error": "Estado civil inválido. Valores aceitos: solteiro, casado, divorciado, viuvo, uniao_estavel"
}
```

---

## 🌐 Integrações Externas

### IGPM (Índice Geral de Preços do Mercado)

**API:** Banco Central do Brasil

**Endpoint:** `https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados`

**Uso:** Correção do caução na rescisão de contratos

**Serviço:** `src/services/igpmService.ts`

#### fetchIGPMData
```typescript
async function fetchIGPMData(
  startDate: string,
  endDate: string
): Promise<IGPMData[]>
```

**Descrição:** Busca dados do IGPM no período

**Parâmetros:**
- `startDate` (string) - Data início (DD/MM/YYYY)
- `endDate` (string) - Data fim (DD/MM/YYYY)

**Retorno:** Array de dados IGPM

**Exemplo:**
```typescript
import { fetchIGPMData, calculateAccumulatedIGPM } from "@/services/igpmService";

const igpmData = await fetchIGPMData("01/01/2025", "31/12/2025");
const accumulated = calculateAccumulatedIGPM(igpmData);

console.log("IGPM acumulado:", accumulated, "%");

// Aplicar correção
const deposit = 1200.00;
const correctedDeposit = deposit * (1 + accumulated / 100);
console.log("Caução corrigido:", correctedDeposit);
```

---

## 📊 Tipos TypeScript

### Property
```typescript
interface Property {
  id: string;
  location_id: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  monthly_rent: number;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  area?: number;
  description?: string;
  status: "available" | "occupied" | "maintenance" | "unavailable";
  images?: string[];
  created_at: string;
  updated_at?: string;
}
```

---

### Tenant
```typescript
interface Tenant {
  id: string;
  name: string;
  cpf: string;
  rg?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
  updated_at?: string;
}
```

---

### Rental
```typescript
interface Rental {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  payment_day: number;
  monthly_rent: number;
  deposit?: number;
  deposit_installments?: number;
  deposit_installment_1?: number;
  deposit_installment_2?: number;
  deposit_installment_3?: number;
  deposit_installment_1_payment_date?: string;
  deposit_installment_2_payment_date?: string;
  deposit_installment_3_payment_date?: string;
  deposit_installment_1_pix_code?: string;
  deposit_installment_2_pix_code?: string;
  deposit_installment_3_pix_code?: string;
  parking_value?: number;
  broker_commission?: number;
  status: "active" | "terminated";
  created_at: string;
  updated_at?: string;
  
  // Relações
  property?: Property;
  tenant?: Tenant;
}
```

---

### Payment
```typescript
interface Payment {
  id: string;
  rental_id: string;
  due_date: string;
  amount: number;
  rent_amount?: number;
  parking_amount?: number;
  admin_fee?: number;
  deposit_amount?: number;
  broker_commission?: number;
  late_fee?: number;
  interest?: number;
  status: "pending" | "paid" | "overdue" | "cancelled";
  payment_date?: string;
  payment_method?: string;
  reference_month: string;
  reference_year: string;
  installment?: number;
  total_installments?: number;
  type?: string;
  created_at: string;
  updated_at?: string;
  
  // Relações
  rental?: Rental;
}
```

---

## 🔒 Autenticação de Requisições

Todas as requisições aos serviços requerem autenticação via JWT token do Supabase.

**Exemplo de requisição autenticada:**

```typescript
import { supabase } from "@/integrations/supabase/client";

// O token JWT é automaticamente incluído nas requisições
const { data, error } = await supabase
  .from("properties")
  .select("*");
```

**Token JWT é obtido no login:**

```typescript
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "senha123"
});

const jwtToken = session?.access_token;
```

---

## 📝 Tratamento de Erros

### Padrão de Erros

Todos os serviços lançam erros no seguinte formato:

```typescript
interface APIError {
  message: string;
  code?: string;
  details?: any;
}
```

**Exemplo de tratamento:**

```typescript
import { createProperty } from "@/services/propertyService";

try {
  const property = await createProperty(data);
  console.log("Sucesso:", property);
} catch (error) {
  if (error.code === "23505") {
    console.error("Propriedade já existe");
  } else if (error.code === "42501") {
    console.error("Sem permissão");
  } else {
    console.error("Erro:", error.message);
  }
}
```

---

## 🧪 Exemplos de Uso Completo

### Fluxo Completo: Criar Locação

```typescript
import { createProperty } from "@/services/propertyService";
import { createTenant } from "@/services/tenantService";
import { createRental } from "@/services/rentalService";

// 1. Criar propriedade
const property = await createProperty({
  location_id: "location-123",
  address: "Rua das Flores, 123",
  monthly_rent: 1000.00,
  bedrooms: 2,
  bathrooms: 1
});

// 2. Criar inquilino
const tenant = await createTenant({
  name: "João Silva",
  cpf: "123.456.789-00",
  phone: "(11) 98765-4321"
});

// 3. Criar locação (gera recebimentos automaticamente)
const rental = await createRental({
  property_id: property.id,
  tenant_id: tenant.id,
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  payment_day: 5,
  monthly_rent: 1000.00,
  deposit: 1200.00,
  deposit_installments: 3,
  parking_value: 200.00
});

console.log("Locação criada:", rental);
// Sistema gerou automaticamente:
// - 12 recebimentos mensais (aluguel + vaga + taxa admin)
// - 3 parcelas de caução (R$ 400 cada)
// - Status da propriedade mudou para "occupied"
```

---

**Próximos documentos:**
- [Arquitetura do Sistema](ARCHITECTURE.md)
- [Regras de Negócio](BUSINESS_RULES.md)
- [Esquema do Banco de Dados](DATABASE_SCHEMA.md)
- [Guia de Deploy](DEPLOYMENT.md)

---

## 🎨 AlertContext API

### Localização
`src/contexts/AlertContext.tsx`

### Descrição
Context global para gerenciar alertas centralizados exibidos no meio da tela.

### Hook: useAlert

```typescript
const { showAlert } = useAlert();
```

### Método: showAlert

```typescript
function showAlert(options: {
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}): void
```

**Parâmetros:**
- `title` (string) - Título do alerta
- `message` (string) - Mensagem do alerta
- `type` (string) - Tipo do alerta (success, error, warning, info)

**Exemplo:**
```typescript
import { useAlert } from "@/contexts/AlertContext";

function MyComponent() {
  const { showAlert } = useAlert();
  
  const handleSave = async () => {
    try {
      await saveData();
      showAlert({
        title: "Sucesso!",
        message: "Dados salvos com sucesso",
        type: "success"
      });
    } catch (error) {
      showAlert({
        title: "Erro",
        message: error.message,
        type: "error"
      });
    }
  };
  
  return <button onClick={handleSave}>Salvar</button>;
}
```

### Características

- ✅ Alertas exibidos no centro da tela
- ✅ Substituem os toasts do rodapé
- ✅ Fechamento automático ou manual
- ✅ Suporte a título e mensagem personalizados
- ✅ 4 tipos visuais (success, error, warning, info)

---

## 🔄 Funções SQL com Verificação

### update_tenant_guaranteed()

**Localização:** Banco de dados Supabase (função SQL)

**Descrição:** Atualiza inquilino com verificação campo por campo para garantir persistência

**Parâmetros:**
```sql
p_id UUID,
p_name TEXT,
p_email TEXT,
p_phone TEXT,
p_cpf TEXT,
p_rg TEXT,
p_occupation TEXT,
p_document TEXT,
p_marital_status TEXT,
p_monthly_income NUMERIC,
p_document_type TEXT,
p_zip_code TEXT,
p_street TEXT,
p_number TEXT,
p_complement TEXT,
p_neighborhood TEXT,
p_city TEXT,
p_state TEXT,
p_status TEXT
```

**Retorno:** Record do inquilino atualizado

**Processo:**
1. Executa UPDATE com todos os campos
2. Busca o registro atualizado
3. Verifica campo por campo se valores foram persistidos
4. Se algum campo não persistiu → lança ERRO com detalhes
5. Se todos persistiram → retorna o registro verificado

**Uso via Supabase RPC:**
```typescript
const { data, error } = await supabase.rpc('update_tenant_guaranteed', {
  p_id: tenantId,
  p_name: "João Silva",
  p_email: "joao@email.com",
  p_phone: "(11) 98765-4321",
  p_cpf: "123.456.789-00",
  p_rg: "12.345.678-9",
  p_occupation: "Engenheiro",
  p_document: "",
  p_marital_status: "casado",
  p_monthly_income: 5500.00,
  p_document_type: "cpf",
  p_zip_code: "01310-100",
  p_street: "Av. Paulista",
  p_number: "1000",
  p_complement: "Apto 101",
  p_neighborhood: "Bela Vista",
  p_city: "São Paulo",
  p_state: "SP",
  p_status: "active"
});

if (error) {
  console.error("Erro na atualização:", error.message);
  // Error contém detalhes de quais campos não foram persistidos
}
```

**Tratamento de Erros:**
```typescript
// Se a função detectar que campos não foram persistidos:
{
  code: "P0001",
  message: "VERIFICAÇÃO FALHOU: Campo 'occupation' não foi persistido. Esperado='Engenheiro', Obtido='Analista'"
}
```

---

### manual_update_tenant()

**Localização:** Banco de dados Supabase (função SQL)

**Descrição:** Função SQL para atualização manual via Supabase Dashboard (útil para testes e debugging)

**Parâmetros:**
```sql
tenant_id UUID,
new_name TEXT DEFAULT NULL,
new_email TEXT DEFAULT NULL,
new_phone TEXT DEFAULT NULL,
new_cpf TEXT DEFAULT NULL,
new_rg TEXT DEFAULT NULL,
new_occupation TEXT DEFAULT NULL,
new_marital_status TEXT DEFAULT NULL,
new_monthly_income NUMERIC DEFAULT NULL,
new_zip_code TEXT DEFAULT NULL,
new_street TEXT DEFAULT NULL,
new_number TEXT DEFAULT NULL,
new_complement TEXT DEFAULT NULL,
new_neighborhood TEXT DEFAULT NULL,
new_city TEXT DEFAULT NULL,
new_state TEXT DEFAULT NULL
```

**Retorno:** Record do inquilino atualizado com NOTICE de verificação

**Uso via SQL Editor:**
```sql
-- Atualizar apenas campos específicos
SELECT * FROM manual_update_tenant(
  tenant_id := '072672d3-889c-4be4-be92-850a546c860c'::uuid,
  new_occupation := 'Engenheiro de Software',
  new_monthly_income := 8000.00
);

-- Atualizar múltiplos campos
SELECT * FROM manual_update_tenant(
  tenant_id := '072672d3-889c-4be4-be92-850a546c860c'::uuid,
  new_name := 'João Silva Santos',
  new_phone := '(11) 99999-8888',
  new_occupation := 'Arquiteto',
  new_marital_status := 'casado',
  new_monthly_income := 7500.00,
  new_city := 'São Paulo',
  new_state := 'SP'
);
```

**NOTICE Output:**
```
NOTICE: 🔍 Dados ANTIGOS:
NOTICE: {"name":"João Silva","occupation":"Analista","monthly_income":5000}

NOTICE: ✅ UPDATE executado com sucesso!

NOTICE: 🔍 Dados NOVOS (verificados):
NOTICE: {"name":"João Silva Santos","occupation":"Arquiteto","monthly_income":7500}

NOTICE: ✅ TODOS OS CAMPOS FORAM PERSISTIDOS CORRETAMENTE!
```

**Características:**
- ✅ Campos NULL são ignorados (mantém valor atual)
- ✅ Apenas campos informados são atualizados
- ✅ Verificação de persistência em tempo real
- ✅ NOTICE detalhado para debugging
- ✅ Útil para testes manuais no Supabase Dashboard

---

## 🔄 Reativação de Locações

### reactivateRental()

**Localização:** `src/services/rentalService.ts`

**Descrição:** Reativa locação encerrada ao editar data fim, recriando pagamentos faltantes

**Parâmetros:**
```typescript
async function reactivateRental(
  rentalId: string,
  newEndDate: string
): Promise<void>
```

**Processo:**

1. **Verifica se locação está encerrada** (`is_active = false`)
2. **Compara nova data fim com data atual**
3. **Se nova data fim > data atual:**
   - Busca último pagamento existente
   - Se último pagamento estava proporcional → ajusta para valor cheio
   - Recria pagamentos faltantes até nova data fim
   - Calcula novo último pagamento proporcional
   - Marca locação como ativa novamente

**Exemplo:**
```typescript
import { reactivateRental } from "@/services/rentalService";

// Locação encerrada em 31/03/2026
// Usuário edita data fim para 31/12/2026

await reactivateRental("rental-123", "2026-12-31");

// Sistema:
// 1. Ajusta pagamento de março/2026 (era proporcional, agora é cheio)
// 2. Recria pagamentos: abril, maio, junho... dezembro/2026
// 3. Último pagamento (dezembro) fica proporcional
// 4. Marca locação como ativa
```

**Regras de Negócio:**
- ✅ Só funciona para locações encerradas
- ✅ Nova data fim deve ser maior que data atual
- ✅ Respeita todas as regras de criação de pagamentos
- ✅ Calcula dias proporcionais para último pagamento
- ✅ Aplica taxa administrativa conforme configuração
- ✅ Inclui valor de garagem se houver

**Chamada Automática:**
```typescript
// No updateRental() do rentalService
if (!oldRental.is_active && newEndDate > today) {
  await reactivateRental(rentalId, newEndDate);
}
```