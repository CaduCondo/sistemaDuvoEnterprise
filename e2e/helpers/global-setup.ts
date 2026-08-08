import DatabaseHelper from './database.helper';

/**
 * Global Setup
 * Executado UMA VEZ antes de TODOS os testes Playwright.
 *
 * Cria (ou reaproveita) os 3 usuários de teste padrão diretamente em
 * `system_users` — o sistema não usa Supabase Auth (ver database.helper.ts).
 */
async function globalSetup() {
  console.log('\n🚀 Iniciando setup global dos testes...\n');

  try {
    await DatabaseHelper.ensureDefaultTestUsers();
    console.log('\n✅ Setup global concluído com sucesso!\n');
  } catch (error) {
    console.error('\n❌ Erro no setup global:', error);
    // Não falhar os testes se usuários já existem
  }
}

export default globalSetup;
