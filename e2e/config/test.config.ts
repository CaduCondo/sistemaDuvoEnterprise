import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * CRÍTICO: Carregar .env.local ANTES de qualquer outra coisa
 * Este arquivo é importado pelos helpers, então precisa carregar as variáveis aqui
 */
const envPath = path.resolve(__dirname, '../../.env.local');
console.log('🔍 [TEST CONFIG] Carregando .env.local de:', envPath);

const result = dotenv.config({ path: envPath, override: true });

// Em CI (GitHub Actions) o .env.local nao existe de proposito (fica no .gitignore) --
// as variaveis ja chegam prontas via `env:` do workflow, direto em process.env.
// So tratamos como erro fatal se as variaveis realmente nao estiverem disponiveis
// de nenhuma forma (nem .env.local, nem process.env ja populado pelo CI).
if (result.error && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ [TEST CONFIG] ERRO ao carregar .env.local:', result.error);
  throw new Error(`Falha ao carregar .env.local: ${result.error.message}`);
}

if (result.error) {
  console.log('⚠️ [TEST CONFIG] .env.local nao encontrado (normal em CI) -- usando variaveis de ambiente ja definidas (secrets do GitHub Actions).');
} else {
  console.log('✅ [TEST CONFIG] .env.local carregado com sucesso!');
}
console.log('🔍 [TEST CONFIG] NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');
console.log('🔍 [TEST CONFIG] NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
console.log('🔍 [TEST CONFIG] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');

/**
 * Configuração de testes E2E
 * 
 * Centraliza todas as credenciais e configurações aqui.
 * As variáveis de ambiente são carregadas do .env.local
 */

const TEST_CONFIG = {
  // URLs do Supabase (do .env.local)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },

  // URL base da aplicação
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',

  // Usuários de teste (ALTERE estas credenciais conforme seu ambiente)
  users: {
    admin: {
      email: 'admin@teste.com',
      password: 'Admin@123',
      name: 'Admin Teste',
      role: 'admin'
    },
    financial: {
      email: 'financeiro@teste.com',
      password: 'Financeiro@123',
      name: 'Financeiro Teste',
      role: 'financial'
    },
    management: {
      email: 'gestao@teste.com',
      password: 'Gestao@123',
      name: 'Gestão Teste',
      // ⚠️ O enum real de `system_users.role` é 'admin' | 'financial' | 'broker'
      // (ver src/components/settings/UserDialog.tsx) — não existe role
      // "management". O DatabaseHelper força role: 'broker' ao criar este
      // usuário; o campo abaixo é só documentação.
      role: 'broker'
    },
    // Credenciais propositalmente inválidas, para testar o fluxo de erro
    invalid: {
      email: 'usuario-invalido@teste.com',
      password: 'SenhaErrada123',
      name: 'Inválido',
      role: 'admin'
    }
  },

  // Timeouts (em milissegundos)
  timeouts: {
    short: 2000,
    medium: 5000,
    long: 10000,
    navigation: 30000
  }
};

// Validar variáveis obrigatórias
if (!TEST_CONFIG.supabase.url) {
  console.error('❌ [TEST CONFIG] NEXT_PUBLIC_SUPABASE_URL está vazia!');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL é obrigatória no .env.local');
}

if (!TEST_CONFIG.supabase.anonKey) {
  console.error('❌ [TEST CONFIG] NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia!');
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória no .env.local');
}

if (!TEST_CONFIG.supabase.serviceRoleKey) {
  console.error('❌ [TEST CONFIG] SUPABASE_SERVICE_ROLE_KEY está vazia!');
  throw new Error('SUPABASE_SERVICE_ROLE_KEY é obrigatória no .env.local');
}

console.log('✅ [TEST CONFIG] Todas as variáveis obrigatórias carregadas!');

export default TEST_CONFIG;