import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { supabaseAdmin } from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

/**
 * Trilha de autoria (issue #54): o banco grava quem criou/alterou cada registro
 * (colunas created_by / updated_by + linha em audit_logs), a partir do
 * cabeçalho `x-sistema-user-id` que o navegador manda.
 */

async function idDoUsuarioDeTeste(perfil: string): Promise<string> {
  const email = (TEST_CONFIG.users as Record<string, { email: string }>)[perfil]?.email;
  if (!email) throw new Error(`Perfil de teste desconhecido: ${perfil}`);
  const { data, error } = await supabaseAdmin
    .from('system_users')
    .select('id')
    .or(`email.eq.${email},username.eq.${email}`)
    .limit(1)
    .maybeSingle();
  expect(error, `não consegui ler o usuário de teste "${perfil}"`).toBeNull();
  expect(data?.id, `o usuário de teste "${perfil}" não existe no banco`).toBeTruthy();
  return data!.id as string;
}

async function imovelCriadoPelaTela(world: CustomWorld) {
  const complemento = world.testData.complementoDigitado;
  expect(complemento, 'o cenário não guardou o complemento do imóvel criado').toBeTruthy();
  // A gravação pode levar um instante depois do aviso de sucesso.
  for (let i = 0; i < 10; i++) {
    const { data } = await supabaseAdmin.from('properties').select('id, created_by, updated_by').eq('complement', complemento).limit(1).maybeSingle();
    if (data) return data as { id: string; created_by: string | null; updated_by: string | null };
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`o imóvel "${complemento}" não apareceu no banco`);
}

Then('o imóvel criado deve registrar o usuário {string} como autor', async function (this: CustomWorld, perfil: string) {
  const esperado = await idDoUsuarioDeTeste(perfil);
  const imovel = await imovelCriadoPelaTela(this);
  expect(imovel.created_by, 'o imóvel foi criado sem registrar quem criou (created_by vazio)').toBe(esperado);
  expect(imovel.updated_by, 'o imóvel foi criado sem registrar quem alterou por último (updated_by vazio)').toBe(esperado);
  this.testData.autoriaImovelId = imovel.id;
});

Then('o histórico de auditoria deve ter a criação desse imóvel com o mesmo autor', async function (this: CustomWorld) {
  const id = this.testData.autoriaImovelId;
  expect(id, 'nenhum imóvel foi conferido antes deste passo').toBeTruthy();
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('user_id, action_type, entity_type, metadata')
    .eq('entity_id', id)
    .eq('action_type', 'create');
  expect(error).toBeNull();
  expect((data || []).length, 'não há registro de criação do imóvel no histórico de auditoria').toBeGreaterThan(0);
  const esperado = await idDoUsuarioDeTeste('admin');
  const doBanco = (data || []).find((l: any) => l.metadata?.origem === 'banco');
  expect(doBanco, 'o registro de criação feito pelo banco não existe').toBeTruthy();
  expect(doBanco!.user_id, 'o registro de criação não traz o autor').toBe(esperado);
  expect(doBanco!.entity_type).toBe('property');
});
