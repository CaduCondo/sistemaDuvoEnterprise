import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Validação de chaves
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Chaves do Supabase não configuradas');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: "public",
  },
  global: {
    headers: {
      "X-Client-Info": "supabase-js-web",
    },
  },
});

// Monitorar eventos de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token atualizado');
  } else if (event === 'SIGNED_OUT') {
    console.log('Usuário desconectado');
  } else if (event === 'SIGNED_IN') {
    console.log('Usuário autenticado');
  }
});

// Conexão estabelecida - sem health check
console.log("✅ Cliente Supabase inicializado");