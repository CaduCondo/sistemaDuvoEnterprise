import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper, { supabaseAdmin } from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

/**
 * Passos do login pelo SERVIDOR (rota /api/auth/login).
 *
 * Estes passos NÃO passam pela tela de propósito: o que eles protegem é o
 * contrato do servidor -- o que ele aceita, o que ele devolve e o que ele
 * NUNCA devolve. Um cenário de tela não conseguiria ver que a senha parou de
 * viajar; só olhando a resposta crua dá para afirmar isso.
 */

function enderecoDoLogin(): string {
  return `${TEST_CONFIG.baseUrl.replace(/\/$/, '')}/api/auth/login`;
}

async function pedirLogin(identificador: string, senha: string) {
  const resposta = await fetch(enderecoDoLogin(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, senha }),
  });

  const corpo = await resposta.json().catch(() => ({}));
  return { status: resposta.status, corpo };
}

function registrarResultadoDeLogin(world: CustomWorld, resultado: { status: number; corpo: any }) {
  world.testData.respostasDeLogin = world.testData.respostasDeLogin || [];
  world.testData.respostasDeLogin.push(resultado);
  world.testData.ultimaRespostaDeLogin = resultado;
}

When(
  'eu pedir login ao servidor com {string} e a senha {string}',
  async function (this: CustomWorld, identificador: string, senha: string) {
    const resultado = await pedirLogin(identificador, senha);
    registrarResultadoDeLogin(this, resultado);
  }
);

// Variante usada quando o e-mail não pode estar escrito no próprio cenário
// porque é gerado na hora (usuário descartável) -- ver "que existe um
// usuário só para este teste" abaixo. Nunca aponta para uma conta
// compartilhada (como admin@teste.com): errar a senha dela de propósito
// derrubou a suíte inteira em 01/set/2026 (conta ficou bloqueada por 30min
// depois que tentativas acumuladas entre pushes de CI bateram o limite).
When(
  'eu pedir login ao servidor com o e-mail desse usuário e a senha {string}',
  async function (this: CustomWorld, senha: string) {
    const { email } = this.testData.usuarioDeBloqueio;
    const resultado = await pedirLogin(email, senha);
    registrarResultadoDeLogin(this, resultado);
  }
);

Then('o servidor deve aceitar', function (this: CustomWorld) {
  const { status, corpo } = this.testData.ultimaRespostaDeLogin;
  expect(status, `o servidor recusou: ${JSON.stringify(corpo)}`).toBe(200);
});

Then('a resposta não pode conter nenhuma senha', function (this: CustomWorld) {
  const texto = JSON.stringify(this.testData.ultimaRespostaDeLogin.corpo);

  // Nem o campo, nem o valor. O nome da coluna engana (`password_hash`), mas
  // hoje ela guarda a senha como ela é -- por isso procuramos as duas coisas.
  expect(texto, 'a resposta do login traz o campo da senha').not.toContain('password_hash');
  expect(texto, 'a resposta do login traz a senha do usuário').not.toContain('Admin@123');
});

Then('a resposta deve trazer um token que identifica esse usuário', function (this: CustomWorld) {
  const { corpo } = this.testData.ultimaRespostaDeLogin;

  expect(corpo.token, 'o login não devolveu token').toBeTruthy();

  // O token é <conteúdo>.<assinatura>. O conteúdo é legível de propósito: ele
  // não guarda segredo nenhum. Quem garante que ninguém o adultera é a
  // assinatura, que só o servidor sabe fazer.
  const partes = String(corpo.token).split('.');
  expect(partes.length, `token com formato inesperado: ${corpo.token}`).toBe(2);

  const conteudo = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));

  expect(conteudo.userId, 'o token não diz de quem é').toBe(corpo.user.id);
  expect(conteudo.expiresAt, 'o token já nasce vencido').toBeGreaterThan(Date.now());
});

Then('as duas recusas devem dizer a mesma coisa', function (this: CustomWorld) {
  const respostas = this.testData.respostasDeLogin as Array<{ status: number; corpo: any }>;
  expect(respostas.length, 'faltou pedir os dois logins').toBeGreaterThanOrEqual(2);

  const [primeira, segunda] = respostas.slice(-2);

  expect(primeira.status, 'a senha errada de um usuário que existe deveria ser recusada').toBe(401);
  expect(segunda.status, 'o usuário inexistente deveria ser recusado igual').toBe(401);
  expect(
    segunda.corpo.error,
    `respostas diferentes entregam quais logins existem: "${primeira.corpo.error}" x "${segunda.corpo.error}"`
  ).toBe(primeira.corpo.error);
});

Given('que existe um usuário só para este teste', async function (this: CustomWorld) {
  // Usuário próprio, descartável: errar a senha bloqueia a conta por 30
  // minutos, e fazer isso com um usuário compartilhado derrubaria todos os
  // outros cenários da rodada.
  const email = `bloqueio.e2e.${Date.now()}@teste.com`;

  const usuario = await DatabaseHelper.ensureTestUser({
    email,
    username: email,
    password: 'Bloqueio@123',
    name: 'Usuario de Bloqueio E2E',
    role: 'broker',
  });

  this.testData.usuarioDeBloqueio = { id: (usuario as any).id, email, senha: 'Bloqueio@123' };
});

When('eu errar a senha dele {int} vezes seguidas', async function (this: CustomWorld, vezes: number) {
  const { email } = this.testData.usuarioDeBloqueio;

  for (let i = 0; i < vezes; i++) {
    await pedirLogin(email, 'senha-errada-de-proposito');
  }
});

Then('a conta dele deve estar bloqueada no banco', async function (this: CustomWorld) {
  const { id } = this.testData.usuarioDeBloqueio;

  const { data } = await supabaseAdmin
    .from('system_users')
    .select('login_attempts, blocked_until')
    .eq('id', id)
    .single();

  this.testData.estadoDoBloqueio = data;

  expect(data?.blocked_until, 'a conta não foi bloqueada').toBeTruthy();
  expect(
    new Date(data!.blocked_until as string).getTime(),
    'o bloqueio já nasceu vencido'
  ).toBeGreaterThan(Date.now());
});

Then('a contagem de tentativas dele deve estar em {int}', function (this: CustomWorld, esperado: number) {
  expect(this.testData.estadoDoBloqueio?.login_attempts).toBe(esperado);
});

Then('a quarta tentativa, mesmo com a senha certa, deve ser recusada', async function (this: CustomWorld) {
  const { email, senha, id } = this.testData.usuarioDeBloqueio;

  const { status, corpo } = await pedirLogin(email, senha);

  expect(status, 'a conta bloqueada deixou entrar com a senha certa').toBe(423);
  expect(String(corpo.error)).toMatch(/bloqueada/i);

  // Limpa o usuário descartável deste cenário.
  await supabaseAdmin.from('system_users').delete().eq('id', id);
});
