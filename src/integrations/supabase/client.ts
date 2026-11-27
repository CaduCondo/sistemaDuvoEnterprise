import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Validação de chaves
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Chaves do Supabase não configuradas');
}

/**
 * Issue #54: toda chamada ao banco leva o id do usuário logado no cabeçalho
 * `x-sistema-user-id`. O banco (gatilhos da migration 20261126120000) lê esse
 * cabeçalho para gravar quem criou/alterou imóvel, inquilino, locação e
 * recebimento. O login do sistema é próprio (não usa o Supabase Auth), então
 * este é o único caminho para o banco saber quem fez a alteração.
 * Se não houver usuário logado (ex.: página pública), a chamada segue sem o cabeçalho.
 */
export function idDoUsuarioLogado(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const bruto = window.localStorage.getItem('auth_user');
    if (!bruto) return null;
    const id = JSON.parse(bruto)?.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

const fetchComAutor: typeof fetch = (input, init) => {
  const id = idDoUsuarioLogado();
  if (!id) return fetch(input, init);
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('x-sistema-user-id', id);
  return fetch(input, { ...init, headers });
};

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
    fetch: fetchComAutor,
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