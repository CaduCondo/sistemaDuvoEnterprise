import { createClient } from '@supabase/supabase-js';
import TEST_CONFIG from '../config/test.config';

/**
 * Helper de Banco de Dados
 *
 * Funções para manipular dados diretamente no banco (setup/teardown de testes),
 * usando a Service Role Key para ignorar RLS.
 *
 * IMPORTANTE: O sistema Duvo Enterprise usa autenticação 100% própria contra a
 * tabela `system_users` (ver src/services/authService.ts) — NÃO usa o Supabase
 * Auth. Por isso os usuários de teste são criados diretamente em `system_users`,
 * nunca via `supabase.auth.admin.createUser`.
 */

const supabaseAdmin = createClient(
  TEST_CONFIG.supabase.url,
  TEST_CONFIG.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Rastreamento de dados criados nesta execução, para limpeza ao final
const createdIds = {
  systemUsers: [] as string[],
  locations: [] as string[],
  properties: [] as string[],
  tenants: [] as string[],
  rentals: [] as string[], // deposit_installments e payments são removidos em cascata
};

function track(bucket: keyof typeof createdIds, id?: string | null) {
  if (id) createdIds[bucket].push(id);
}

export class DatabaseHelper {
  // ==================== USUÁRIOS DE TESTE ====================

  /**
   * Cria (ou reaproveita) um usuário de teste em `system_users`.
   * A senha é gravada em texto puro em `password_hash`, pois é assim que
   * `authService.validatePassword` compara hoje (ver comentário "TEMPORARY"
   * no serviço real).
   */
  static async ensureTestUser(userData: {
    email: string;
    username?: string;
    password: string;
    name: string;
    role: 'admin' | 'financial' | 'broker';
    theme?: 'light' | 'dark';
  }) {
    const { data: existing } = await supabaseAdmin
      .from('system_users')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();

    if (existing) {
      // Garantir que a senha/role estão como o teste espera. IMPORTANTE:
      // reseta requires_password_change/temporary_password para false — sem
      // isso, um usuário reaproveitado de uma execução anterior (ex.: que
      // passou pelo teste de "esqueci minha senha" ou de reset de admin)
      // fica preso na tela de troca de senha em TODO login subsequente,
      // porque src/components/public/PublicHeader.tsx never navega para
      // /dashboard enquanto requires_password_change for true (mostra o
      // PasswordChangeDialog em vez disso). Isso já causou uma cascata de
      // falsos negativos em quase toda a suíte (2026-08).
      await supabaseAdmin
        .from('system_users')
        .update({
          password_hash: userData.password,
          role: userData.role,
          active: true,
          login_attempts: 0,
          blocked_until: null,
          requires_password_change: false,
          temporary_password: false,
          ...(userData.theme ? { theme: userData.theme } : {}),
        })
        .eq('id', existing.id);
      return existing;
    }

    const { data, error } = await supabaseAdmin
      .from('system_users')
      .insert({
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        name: userData.name,
        role: userData.role,
        password_hash: userData.password,
        active: true,
        requires_password_change: false,
        temporary_password: false,
        ...(userData.theme ? { theme: userData.theme } : {}),
      })
      .select()
      .single();

    if (error) {
      // Com os cenários rodando em paralelo, dois workers podem chegar
      // aqui ao mesmo tempo: os dois consultam, os dois não encontram o
      // usuário, e os dois tentam inserir. O segundo bate na restrição de
      // e-mail único e falharia — mas o usuário que ele queria JÁ EXISTE,
      // que é tudo o que este método promete. Então consulta de novo e
      // devolve o que o outro worker acabou de criar.
      const { data: criadoPorOutroWorker } = await supabaseAdmin
        .from('system_users')
        .select('id')
        .eq('email', userData.email)
        .maybeSingle();

      if (criadoPorOutroWorker) return criadoPorOutroWorker;

      throw new Error(`Falha ao criar usuário de teste: ${error.message}`);
    }
    track('systemUsers', data.id);
    return data;
  }

  /**
   * Cria (ou reaproveita) um usuário de teste com senha temporária pendente
   * (`requires_password_change: true`), para testar o fluxo de troca
   * obrigatória de senha no primeiro login (PasswordChangeDialog).
   */
  static async ensureTemporaryPasswordUser(userData: {
    email: string;
    username?: string;
    password: string;
    name: string;
    role: 'admin' | 'financial' | 'broker';
  }) {
    const { data: existing } = await supabaseAdmin
      .from('system_users')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();

    const payload = {
      email: userData.email,
      username: userData.username || userData.email.split('@')[0],
      name: userData.name,
      role: userData.role,
      password_hash: userData.password,
      active: true,
      login_attempts: 0,
      blocked_until: null,
      requires_password_change: true,
      temporary_password: true,
    };

    if (existing) {
      await supabaseAdmin.from('system_users').update(payload).eq('id', existing.id);
      return existing;
    }

    const { data, error } = await supabaseAdmin
      .from('system_users')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar usuário com senha temporária: ${error.message}`);
    track('systemUsers', data.id);
    return data;
  }

  /** Garante que os 3 usuários padrão de teste (admin/financeiro/corretor) existem */
  static async ensureDefaultTestUsers() {
    await this.ensureTestUser({ ...TEST_CONFIG.users.admin, role: 'admin' });
    await this.ensureTestUser({ ...TEST_CONFIG.users.financial, role: 'financial' });
    await this.ensureTestUser({ ...TEST_CONFIG.users.management, role: 'broker' });
  }

  // ==================== LOCALIZAÇÕES ====================

  static async createLocation(overrides: Partial<{
    name: string; city: string; state: string; neighborhood: string;
  }> = {}) {
    const suffix = Date.now().toString().slice(-6);
    const { data, error } = await supabaseAdmin
      .from('locations')
      .insert({
        name: overrides.name || `Localização Teste ${suffix}`,
        city: overrides.city || 'São Paulo',
        state: overrides.state || 'SP',
        neighborhood: overrides.neighborhood || 'Centro',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar localização: ${error.message}`);
    track('locations', data.id);
    return data;
  }

  static async findLocationByName(name: string) {
    const { data } = await supabaseAdmin.from('locations').select('*').ilike('name', `%${name}%`).limit(1).maybeSingle();
    return data;
  }

  // ==================== IMÓVEIS ====================

  static async createProperty(overrides: Partial<{
    location_id: string; property_identifier: string; complement: string;
    value: number; status: string; rooms: number; bathrooms: number; area: number;
    has_garage: boolean;
  }> = {}) {
    let locationId = overrides.location_id;
    if (!locationId) {
      const location = await this.createLocation();
      locationId = location.id;
    }

    const suffix = Date.now().toString().slice(-6);
    const { data, error } = await supabaseAdmin
      .from('properties')
      .insert({
        location_id: locationId,
        property_identifier: overrides.property_identifier || `IMO-${suffix}`,
        complement: overrides.complement || 'Casa Teste',
        value: overrides.value ?? 1000,
        status: overrides.status || 'available',
        rooms: overrides.rooms ?? 2,
        bathrooms: overrides.bathrooms ?? 1,
        area: overrides.area ?? 60,
        has_garage: overrides.has_garage ?? false,
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar imóvel: ${error.message}`);
    track('properties', data.id);
    return data;
  }

  static async findPropertyByIdentifier(identifier: string) {
    const { data } = await supabaseAdmin.from('properties').select('*').eq('property_identifier', identifier).maybeSingle();
    return data;
  }

  static async findPropertyByComplement(complement: string) {
    const { data } = await supabaseAdmin.from('properties').select('*').ilike('complement', `%${complement}%`).limit(1).maybeSingle();
    return data;
  }

  static async updateProperty(id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin.from('properties').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`Falha ao atualizar imóvel: ${error.message}`);
    return data;
  }

  /** Remove um imóvel específico por id (ex.: limpeza de imóvel criado via UI). */
  static async deleteProperty(id: string) {
    await supabaseAdmin.from('properties').delete().eq('id', id);
  }

  // ==================== INQUILINOS ====================

  static async createTenant(overrides: Partial<{
    name: string; document: string; document_type: string; cpf: string;
    phone: string; email: string; status: string;
  }> = {}) {
    const suffix = Date.now().toString().slice(-6);
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: overrides.name || `Inquilino Teste ${suffix}`,
        document: overrides.document || `${suffix}00000`,
        document_type: overrides.document_type || 'cpf',
        cpf: overrides.cpf,
        phone: overrides.phone || '11999990000',
        email: overrides.email || `inquilino${suffix}@teste.com`,
        status: overrides.status || 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar inquilino: ${error.message}`);
    track('tenants', data.id);
    return data;
  }

  static async findTenantByName(name: string) {
    const { data } = await supabaseAdmin.from('tenants').select('*').ilike('name', `%${name}%`).limit(1).maybeSingle();
    return data;
  }

  /** Remove um inquilino específico por id (ex.: limpeza de inquilino criado via UI). */
  static async deleteTenant(id: string) {
    await supabaseAdmin.from('tenants').delete().eq('id', id);
  }

  // ==================== LOCAÇÕES ====================

  static async createRental(overrides: Partial<{
    property_id: string; tenant_id: string; start_date: string; end_date: string;
    rent_due_day: number; rent_value: number; monthly_rent: number; security_deposit: number;
    deposit_installments: number; has_garage: boolean; garage_value: number;
    has_partner_broker: boolean; partner_broker_value: number; status: string;
    // aliases aceitos para conveniência dos step definitions:
    deposit_payment_date: string;
    deposit_installment2_payment_date: string;
    deposit_installment3_payment_date: string;
  }> = {}) {
    let propertyId = overrides.property_id;
    let tenantId = overrides.tenant_id;

    if (!propertyId) {
      const property = await this.createProperty({ status: 'available' });
      propertyId = property.id;
    }
    if (!tenantId) {
      const tenant = await this.createTenant();
      tenantId = tenant.id;
    }

    const rentValue = overrides.rent_value ?? overrides.monthly_rent ?? 1000;

    const { data, error } = await supabaseAdmin
      .from('rentals')
      .insert({
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: overrides.start_date || '2026-01-01',
        end_date: overrides.end_date || '2026-12-31',
        rent_due_day: overrides.rent_due_day ?? 10,
        rent_value: rentValue,
        security_deposit: overrides.security_deposit ?? rentValue,
        deposit_installments: overrides.deposit_installments ?? 1,
        has_garage: overrides.has_garage ?? false,
        garage_value: overrides.garage_value,
        has_partner_broker: overrides.has_partner_broker ?? false,
        partner_broker_value: overrides.partner_broker_value,
        status: overrides.status || 'active',
        is_active: (overrides.status || 'active') === 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar locação: ${error.message}`);
    track('rentals', data.id);

    // Marcar imóvel como ocupado quando a locação é ativa (espelha o trigger real)
    if ((overrides.status || 'active') === 'active') {
      await this.updateProperty(propertyId, { status: 'occupied' });
    }

    // Criar parcelas de caução na tabela filha `deposit_installments`
    const totalInstallments = overrides.deposit_installments ?? 1;
    const installmentAmount = Math.round(((overrides.security_deposit ?? rentValue) / totalInstallments) * 100) / 100;
    const firstDueDate = overrides.deposit_payment_date || overrides.start_date || '2026-01-01';

    for (let n = 1; n <= totalInstallments; n++) {
      let dueDate = firstDueDate;
      if (n === 2) dueDate = overrides.deposit_installment2_payment_date || firstDueDate;
      if (n === 3) dueDate = overrides.deposit_installment3_payment_date || firstDueDate;

      await this.createDepositInstallment({
        rental_id: data.id,
        installment_number: n,
        installment_total: totalInstallments,
        amount: installmentAmount,
        due_date: dueDate,
      });
    }

    return data;
  }

  static async getRental(id: string) {
    const { data, error } = await supabaseAdmin.from('rentals').select('*').eq('id', id).single();
    if (error) throw new Error(`Falha ao buscar locação: ${error.message}`);
    return data;
  }

  static async updateRental(id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin.from('rentals').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`Falha ao atualizar locação: ${error.message}`);
    return data;
  }

  // ==================== PARCELAS DE CAUÇÃO ====================

  static async createDepositInstallment(overrides: {
    rental_id: string; installment_number: number; installment_total: number;
    amount: number; due_date: string; status?: string; pix_code?: string;
    partner_commission?: number; internal_commission?: number;
  }) {
    const { data, error } = await supabaseAdmin
      .from('deposit_installments')
      .insert({
        rental_id: overrides.rental_id,
        installment_number: overrides.installment_number,
        installment_total: overrides.installment_total,
        amount: overrides.amount,
        due_date: overrides.due_date,
        status: overrides.status || 'pending',
        pix_code: overrides.pix_code,
        partner_commission: overrides.partner_commission,
        internal_commission: overrides.internal_commission,
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar parcela de caução: ${error.message}`);
    return data;
  }

  static async getDepositInstallments(rentalId: string) {
    const { data, error } = await supabaseAdmin
      .from('deposit_installments')
      .select('*')
      .eq('rental_id', rentalId)
      .order('installment_number', { ascending: true });
    if (error) throw new Error(`Falha ao buscar parcelas de caução: ${error.message}`);
    return data || [];
  }

  static async getAllDepositInstallments() {
    const { data, error } = await supabaseAdmin
      .from('deposit_installments')
      .select('*')
      .order('due_date', { ascending: true });
    if (error) throw new Error(`Falha ao buscar parcelas de caução: ${error.message}`);
    return data || [];
  }

  static async updateDepositInstallment(id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from('deposit_installments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Falha ao atualizar parcela de caução: ${error.message}`);
    return data;
  }

  // ==================== PAGAMENTOS ====================

  static async getPaymentsByRental(rentalId: string) {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('rental_id', rentalId)
      .order('due_date', { ascending: true });
    if (error) throw new Error(`Falha ao buscar pagamentos: ${error.message}`);
    return data || [];
  }

  static async updatePayment(id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin.from('payments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`Falha ao atualizar pagamento: ${error.message}`);
    return data;
  }

  /**
   * Cria (ou atualiza, se já existir para o mesmo mês/ano de referência) um
   * pagamento de uma locação. Útil em cenários de BDD que partem de um
   * pagamento já existente com status/valor específicos
   * (ex.: "o pagamento de Janeiro/2026 está 'Pago' com valor de 'X'").
   */
  static async upsertPayment(overrides: {
    rental_id: string; reference_month: string; reference_year: string;
    due_date: string; expected_amount: number; status: string;
    paid_amount?: number; payment_date?: string;
  }) {
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('rental_id', overrides.rental_id)
      .eq('reference_month', overrides.reference_month)
      .eq('reference_year', overrides.reference_year)
      .maybeSingle();

    const payload = {
      rental_id: overrides.rental_id,
      reference_month: overrides.reference_month,
      reference_year: overrides.reference_year,
      due_date: overrides.due_date,
      expected_amount: overrides.expected_amount,
      status: overrides.status,
      paid_amount: overrides.paid_amount,
      payment_date: overrides.payment_date,
    };

    if (existing) {
      const { data, error } = await supabaseAdmin.from('payments').update(payload).eq('id', existing.id).select().single();
      if (error) throw new Error(`Falha ao atualizar pagamento: ${error.message}`);
      return data;
    }

    const { data, error } = await supabaseAdmin.from('payments').insert(payload).select().single();
    if (error) throw new Error(`Falha ao criar pagamento: ${error.message}`);
    return data;
  }

  /**
   * Cria diretamente um "Recebimento de Rescisão" (payment_kind='termination'),
   * exatamente como terminationService.ts grava na aba Cauções (#49) — usado
   * por cenários que testam a EXIBIÇÃO desse recebimento (colunas, cor) sem
   * precisar rodar uma rescisão inteira pela tela.
   */
  static async createTerminationPayment(overrides: {
    rental_id: string; due_date: string; reference_month: string; reference_year: string;
    termination_corrected_deposit?: number; termination_additional_expenses?: number;
    termination_discount?: number; expected_amount?: number; status?: string;
    notes?: string; breakdown?: any[];
  }) {
    const correctedDeposit = overrides.termination_corrected_deposit ?? 0;
    const additionalExpenses = overrides.termination_additional_expenses ?? 0;
    const discount = overrides.termination_discount ?? 0;
    const expectedAmount = overrides.expected_amount ??
      Math.round((correctedDeposit + additionalExpenses + discount) * 100) / 100;

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        rental_id: overrides.rental_id,
        due_date: overrides.due_date,
        reference_month: overrides.reference_month,
        reference_year: overrides.reference_year,
        expected_amount: expectedAmount,
        status: overrides.status || 'pending',
        payment_kind: 'termination',
        termination_corrected_deposit: correctedDeposit,
        termination_additional_expenses: additionalExpenses,
        termination_discount: discount,
        breakdown: overrides.breakdown || [],
        notes: overrides.notes ||
          `Recebimento de Rescisão - Rescisão de Contrato - Data de saída: ${overrides.due_date}.`,
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar Recebimento de Rescisão: ${error.message}`);
    return data;
  }

  static async getPaymentById(id: string) {
    const { data, error } = await supabaseAdmin.from('payments').select('*').eq('id', id).single();
    if (error) throw new Error(`Falha ao buscar pagamento: ${error.message}`);
    return data;
  }

  // ==================== ESTATÍSTICAS ====================

  static getTestDataStats() {
    const stats = {
      users: createdIds.systemUsers.length,
      locations: createdIds.locations.length,
      properties: createdIds.properties.length,
      tenants: createdIds.tenants.length,
      rentals: createdIds.rentals.length,
      total:
        createdIds.systemUsers.length +
        createdIds.locations.length +
        createdIds.properties.length +
        createdIds.tenants.length +
        createdIds.rentals.length,
    };
    return stats;
  }

  // ==================== LIMPEZA ====================

  /** Remove todos os dados criados nesta execução (ordem respeita FKs). */
  static async cleanupAllTestData() {
    console.log('\n🧹 Limpando dados de teste...\n');

    for (const id of createdIds.rentals) {
      await supabaseAdmin.from('deposit_installments').delete().eq('rental_id', id);
      await supabaseAdmin.from('payments').delete().eq('rental_id', id);
      await supabaseAdmin.from('rentals').delete().eq('id', id);
    }
    for (const id of createdIds.tenants) {
      await supabaseAdmin.from('tenants').delete().eq('id', id);
    }
    for (const id of createdIds.properties) {
      await supabaseAdmin.from('properties').delete().eq('id', id);
    }
    for (const id of createdIds.locations) {
      await supabaseAdmin.from('locations').delete().eq('id', id);
    }
    // Usuários de teste (admin/financeiro/corretor) são fixos e reaproveitados
    // entre execuções — não são removidos aqui de propósito.

    createdIds.rentals = [];
    createdIds.tenants = [];
    createdIds.properties = [];
    createdIds.locations = [];

    console.log('✅ Limpeza concluída!\n');
  }
}

export default DatabaseHelper;
