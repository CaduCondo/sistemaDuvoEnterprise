export interface Permission {
  id: string;
  code: string;
  description: string;
}

export interface RoleMenuPermission {
  id: string;
  role: "admin" | "financial" | "broker";
  menu: string;
  menu_id?: string; // Compatibility
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserLocationPermission {
  id: string;
  user_id: string;
  location_id: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  category: "contract" | "deposit" | "other";
  uploadedAt: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: "admin" | "financial" | "broker";
  active: boolean;
  status: string;
  cpf: string;
  rg?: string; // Added property
  phone?: string; // Added property
  photo?: string; // Added property
  birthDate?: string; // Added property
  auth_user_id: string | null;
  created_at: string;
  usuario?: string;
  password_hash?: string; // Senha hasheada (bcrypt) - usado para autenticação
  password?: string; // Optional for updates
  blocked_until?: string | null; // Bloqueio temporário por falhas de login
  login_attempts?: number; // Contador de tentativas de login
}

export interface CompanyConfig {
  id: string;
  company_name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  city?: string; // Added property
  state?: string; // Added property
  zip_code?: string; // Added property
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  updated_at: string;
  
  // Financial configs
  admin_fee_percentage?: number;
  management_fee_percentage?: number;
  broker_fee_percentage?: number;
  late_fee_percentage?: number;
  interest_rate_percentage?: number;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  manager_id: string | null;
  active: boolean;
  is_active?: boolean; // Compatibility
  created_at: string;
  updated_at: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  complement?: string;
}

export interface Property {
  id: string;
  locationId: string;
  location_id?: string; // Compatibility
  location: string;
  propertyIdentifier: string;
  property_identifier?: string; // Compatibility
  complement: string;
  description: string;
  rooms: number;
  bathrooms: number;
  area: number;
  value: number;
  hasGarage: boolean;
  has_garage?: boolean; // Compatibility
  hasFurniture: boolean;
  has_furniture?: boolean; // Compatibility
  acceptsPets: boolean;
  accepts_pets?: boolean; // Compatibility
  hasBarbecue?: boolean;
  has_barbecue?: boolean; // Compatibility
  status: "available" | "occupied" | "unavailable";
  listingType?: "rent" | "sale"; // Tipo de anúncio: Locação ou Venda
  listing_type?: "rent" | "sale"; // Compatibility
  images: string[];
  createdAt: string;
  created_at?: string; // Compatibility
  updatedAt?: string;
  updated_at?: string; // Compatibility
  address: string;
  features: string[];
  locationDetails?: any;
  // Dashboard specific props
  type?: string; 
  monthlyRent?: number;
  
  // Address details
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Image optimization
  allImages?: string[]; // Todas as imagens do imóvel (usado na página pública)

  // Código curto e sequencial usado na URL pública (ex: 0001), gerado automaticamente pelo banco.
  // O ID de verdade (UUID) continua sendo a chave interna do sistema.
  publicCode?: number;
  public_code?: number; // Compatibility
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  document?: string;
  documentType?: string;
  document_type?: string;
  occupation?: string;
  maritalStatus?: string;
  marital_status?: string;
  monthlyIncome?: number | null;
  monthly_income?: number | null;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  status: "active" | "rented" | "inactive";
  createdAt?: string;
  created_at?: string;
}

export interface Rental {
  id: string;
  propertyId: string;
  property_id?: string; // Compatibility
  tenantId: string;
  tenant_id?: string; // Compatibility
  startDate: string;
  start_date?: string; // Compatibility
  endDate: string | null;
  end_date?: string | null; // Compatibility
  value: number;
  monthlyRent: number;
  monthly_rent?: number; // Compatibility
  paymentDay: number;
  payment_day?: number; // Compatibility
  depositAmount: number;
  deposit_amount?: number; // Compatibility
  security_deposit?: number; // Compatibility
  status: "active" | "ended" | "terminated";
  isActive: boolean;
  is_active?: boolean; // Compatibility
  attachments: (Attachment | string)[] | any[]; // Updated to support object structure
  contractAttachments: string[];
  contract_attachments?: string[]; // Compatibility
  hasGarage: boolean;
  has_garage?: boolean; // Compatibility
  garageValue?: number; // Added
  garage_value?: number; // Compatibility
  hasPartnerBroker: boolean;
  has_partner_broker?: boolean; // Compatibility
  partnerBrokerName?: string; // Added if needed
  partner_broker_name?: string; // Compatibility
  pixCode?: string;
  
  // Deposit Installments
  depositInstallments?: number;
  depositInstallmentsList?: DepositInstallment[]; // Array de parcelas carregadas do banco
  depositInstallment1?: number; // Added alias for consistency
  depositInstallment1PaymentDate?: string; // Added alias
  depositInstallment1PixCode?: string; // Added alias
  depositInstallment1DueDate?: string; // Added property
  
  depositPaymentDate?: string; // Added for first installment compatibility
  depositPixCode?: string; // Added for first installment compatibility
  depositDueDate?: string; // Data de vencimento da 1ª parcela

  depositInstallment2?: number;
  depositInstallment2PaymentDate?: string;
  depositInstallment2PixCode?: string;
  depositInstallment2DueDate?: string; // Data de vencimento da 2ª parcela
  
  depositInstallment3?: number;
  depositInstallment3PaymentDate?: string;
  depositInstallment3PixCode?: string;
  depositInstallment3DueDate?: string; // Data de vencimento da 3ª parcela
  
  // Compatibility snake_case
  deposit_installments?: number;
  deposit_installment_1?: number;
  deposit_payment_date?: string;
  deposit_pix_code?: string;
  deposit_installment_2?: number;
  deposit_installment_2_payment_date?: string;
  deposit_installment_2_pix_code?: string;
  deposit_installment_3?: number;
  deposit_installment_3_payment_date?: string;
  deposit_installment_3_pix_code?: string;
  
  installments?: number; // Added property
  totalInstallments?: number; // Added property

  // Relations
  property?: Property;
  tenant?: Tenant;
  locationId?: string; // For compatibility
}

export interface Payment {
  id: string;
  rentalId: string;
  propertyId: string;
  tenantId: string;
  referenceMonth: number;
  referenceYear: number;
  dueDate: string;
  expectedAmount: number;
  /**
   * Tipo do recebimento (#49):
   *   'rent'        -> recebimento de aluguel, entra na base das taxas;
   *   'termination' -> Recebimento de Rescisao (devolucao de caucao,
   *                    despesas e desconto), NAO entra na base das taxas.
   * Recebimentos anteriores a migracao vem indefinidos e valem como 'rent'.
   */
  paymentKind?: "rent" | "termination";
  paidAmount: number;
  status: "paid" | "pending" | "overdue" | "partial";
  paymentDate: string | null;
  paymentMethod: string | null;
  notes: string | null;
  lateFee: number;
  interest: number;
  breakdown: any;
  installment?: number;
  totalInstallments?: number;
  attachments?: string[];
  depositType?: string;
  rental?: Rental;
  property?: Property;
  tenant?: Tenant;
  receiptUrl?: string;
  discount?: number;
  pixCode?: string;
  paymentTime?: string;
  partialPayments?: any[];
  // ✅ Recebimentos de caução (deposit_installments) aparecem misturados nesta
  // mesma lista, cada um no mês de referência da sua data de vencimento, com
  // as mesmas regras de cor (azul/amarelo/vermelho/verde) dos recebimentos de
  // aluguel. isDeposit distingue os dois na hora de exibir/etiquetar/clicar.
  isDeposit?: boolean;
  depositInstallment?: DepositInstallment;
}

export interface PaymentInstallment {
  installment: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  status: "pending" | "paid" | "overdue";
}

export interface PaymentFilters {
  status?: string;
  location_id?: string;
  month?: number;
  year?: number;
  search?: string;
}

export interface DashboardMetric {
  label: string;
  value: string | number;
  change?: number;
  trend?: "up" | "down" | "neutral";
  icon?: any;
}

export interface LocationExpense {
  id: string;
  locationId: string;
  location_id?: string; // For compatibility
  expenseType: "water" | "electricity" | "gas" | "internet" | "maintenance" | "other";
  expense_type?: "water" | "electricity" | "gas" | "internet" | "maintenance" | "other"; // Compatibility
  description: string;
  amount: number;
  referenceMonth: number;
  reference_month?: number; // Compatibility
  referenceYear: number;
  reference_year?: number; // Compatibility
  dueDate?: string; // Optional in DB, but good to have
  due_date?: string; // Compatibility
  date?: string; // Compatibility
  paymentDate?: string | null;
  payment_date?: string | null; // Compatibility
  status: "pending" | "paid" | "overdue";
  notes?: string;
  attachments: string[];
  updatedAt?: string;
  updated_at?: string; // Compatibility
  category?: string; // For compatibility
  recurrent?: boolean;
  locationName?: string;
}

// User type for compatibility with storage.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "financial" | "broker";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    username: string;
    role: "admin" | "financial" | "broker";
    photo?: string | null;
    phone?: string | null;
    cpf?: string | null;
    rg?: string | null;
    theme?: string | null;
  };
  error?: string;
}

// ✅ Cada pagamento (total ou parcial) registrado numa parcela de caução vira
// uma entrada aqui, igual já funciona em `payments.partial_payments` pro
// aluguel - permite ter histórico de pagamentos e gerar recibo por entrada.
export interface DepositPartialPaymentEntry {
  amount: number;
  expected_amount: number;
  payment_date: string;
  payment_method: string;
  notes: string | null;
  attachments: { url: string; name: string; description?: string }[];
  registered_at: string;
}

export interface DepositInstallment {
  id: string;
  rental_id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  payment_date: string | null;
  paid_amount: number;
  status: "pending" | "paid" | "partial" | "overdue" | "cancelled";
  payment_method: string | null;
  pix_code: string | null; // ✅ ADICIONADO: código PIX da parcela
  notes: string | null;
  attachments: string[];
  partial_payments?: DepositPartialPaymentEntry[];
  penalty_amount?: number | null;
  interest_amount?: number | null;
  created_at: string;
  updated_at: string;
}

export type KanbanCategory = "bug" | "feature" | "melhoria" | "divida_tecnica";
export type KanbanStatus = "backlog" | "todo" | "in_progress" | "done";
export type KanbanPriority = "urgente" | "alta" | "media" | "baixa";

export interface KanbanCard {
  id: string;
  title: string;
  category: KanbanCategory;
  status: KanbanStatus;
  priority: KanbanPriority;
  module: string | null;
  problem_description: string | null;
  action_plan: string | null;
  how_to: string | null;
  position: number;
  created_by: string | null;
  created_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanCardComment {
  id: string;
  card_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

export interface KanbanCardTask {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}