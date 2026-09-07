import { createClient } from '@supabase/supabase-js';
import TEST_CONFIG from '../config/test.config';

/**
 * Helper de API
 * Funções para testar endpoints da API Supabase
 */

// #66: mesmo problema do supabaseAdmin em database.helper.ts -- sem timeout,
// uma instabilidade do Supabase trava a chamada em silêncio até o
// Node/undici desistir sozinho, podendo consumir o limite de tempo do job
// inteiro. Ver comentário completo em database.helper.ts.
const SUPABASE_TEST_TIMEOUT_MS = 15_000;

function fetchComTimeout(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TEST_TIMEOUT_MS);

  return fetch(url, { ...options, signal: controller.signal })
    .catch((erro) => {
      if (erro?.name === 'AbortError') {
        throw new Error(
          `Supabase não respondeu em ${SUPABASE_TEST_TIMEOUT_MS / 1000}s -- possível ` +
          'instabilidade do serviço (não é bug do teste). Ver issue #66.'
        );
      }
      throw erro;
    })
    .finally(() => clearTimeout(timeoutId));
}

const supabase = createClient(
  TEST_CONFIG.supabase.url,
  TEST_CONFIG.supabase.anonKey,
  {
    global: {
      fetch: fetchComTimeout,
    },
  }
);

export class ApiHelper {
  /**
   * Testar autenticação via API
   */
  static async testLogin(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      return {
        success: !error,
        data,
        error
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error
      };
    }
  }

  /**
   * Testar busca de imóveis
   */
  static async testGetProperties() {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .limit(10);

      return {
        success: !error,
        data,
        error,
        count: data?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error,
        count: 0
      };
    }
  }

  /**
   * Testar health check da API
   */
  static async testHealthCheck() {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('count')
        .limit(1)
        .single();

      return {
        success: !error,
        healthy: !error
      };
    } catch (error) {
      return {
        success: false,
        healthy: false
      };
    }
  }
}

export default ApiHelper;