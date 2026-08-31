import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper, { supabaseAdmin } from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

/**
 * Passos de gerenciamento de usuários pelo SERVIDOR (rotas /api/users/*).
 *
 * Mesmo espírito de auth-servidor.steps.ts: falam com as rotas direto, sem
 * passar pela tela, porque o que está sendo protegido é a gravação de
 * verdade acontecer no banco (o problema real era RLS calando a gravação em
 * silêncio) -- ver o cabeçalho de src/pages/api/users/index.ts.
 */

function endereco(caminho: string): string {
  return `${TEST_CONFIG.baseUrl.replace(/\/$/, '')}${caminho}`;
}

async function pedirLogin(identificador: string, senha: string) {
  const resposta = await fetch(endereco('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, senha }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  return { status: resposta.status, corpo };
}

async function chamarApi(
  caminho: string,
  metodo: string,
  token: string | undefined,
  corpo?: Record<string, any>
) {
  const resposta = await fetch(endereco(caminho), {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  const dados = await resposta.json().catch(() => ({}));
  return { status: resposta.status, corpo: dados };
}

Given('que estou autenticado como admin pelo servidor', async function (this: CustomWorld) {
  const { corpo } = await pedirLogin(TEST_CONFIG.users.admin.email, TEST_CONFIG.users.admin.password);
  expect(corpo.token, 'não consegui logar como admin para o teste').toBeTruthy();
  this.testData.tokenAtual = corpo.token;
});

Given(
  'que estou autenticado como {string} pelo servidor',
  async function (this: CustomWorld, papel: string) {
    // Hoje só "broker" é usado nos cenários (usuário "gestao" de TEST_CONFIG,
    // que tem role broker -- ver o comentário em test.config.ts).
    const credenciais =
      papel === 'broker'
        ? TEST_CONFIG.users.management
        : papel === 'financial'
        ? TEST_CONFIG.users.financial
        : TEST_CONFIG.users.admin;

    const { corpo } = await pedirLogin(credenciais.email, credenciais.password);
    expect(corpo.token, `não consegui logar como "${papel}" para o teste`).toBeTruthy();
    this.testData.tokenAtual = corpo.token;
  }
);

When('eu pedir para criar um usuário pelo servidor', async function (this: CustomWorld) {
  const email = `criacao.e2e.${Date.now()}@teste.com`;

  const resultado = await chamarApi('/api/users', 'POST', this.testData.tokenAtual, {
    name: 'Usuario Criado E2E',
    email,
    role: 'broker',
    password: 'Criado@123',
    temporary_password: true,
  });

  this.testData.ultimaCriacao = { ...resultado, email };
});

Then('o servidor deve aceitar a criação', function (this: CustomWorld) {
  const { status, corpo } = this.testData.ultimaCriacao;
  expect(status, `o servidor recusou: ${JSON.stringify(corpo)}`).toBe(201);
});

Then('o usuário deve existir de verdade no banco', async function (this: CustomWorld) {
  const { email } = this.testData.ultimaCriacao;

  const { data } = await supabaseAdmin
    .from('system_users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  expect(data, 'a criação "passou" na resposta mas a linha não está no banco').toBeTruthy();

  // Limpa o usuário descartável criado por este cenário.
  if (data?.id) {
    await supabaseAdmin.from('system_users').delete().eq('id', data.id);
  }
});

Then('o servidor deve recusar com {string}', function (this: CustomWorld, statusEsperado: string) {
  const { status, corpo } = this.testData.ultimaCriacao;
  expect(status, `esperava ${statusEsperado} mas o servidor respondeu ${status}: ${JSON.stringify(corpo)}`).toBe(
    Number(statusEsperado)
  );
});

Given(
  'que existe um usuário só para este teste de gerenciamento',
  async function (this: CustomWorld) {
    const email = `gerenciamento.e2e.${Date.now()}@teste.com`;
    const senha = 'Gerenciar@123';

    const usuario = await DatabaseHelper.ensureTestUser({
      email,
      username: email,
      password: senha,
      name: 'Usuario de Gerenciamento E2E',
      role: 'broker',
    });

    this.testData.usuarioDeGerenciamento = { id: (usuario as any).id, email, senha };

    const { corpo } = await pedirLogin(TEST_CONFIG.users.admin.email, TEST_CONFIG.users.admin.password);
    this.testData.tokenAtual = corpo.token;
  }
);

When(
  'eu editar o nome dele pelo servidor para {string}',
  async function (this: CustomWorld, novoNome: string) {
    const { id } = this.testData.usuarioDeGerenciamento;

    const resultado = await chamarApi(`/api/users/${id}`, 'PATCH', this.testData.tokenAtual, {
      name: novoNome,
    });

    expect(resultado.status, `edição recusada: ${JSON.stringify(resultado.corpo)}`).toBe(200);
  }
);

Then('o nome dele no banco deve ser {string}', async function (this: CustomWorld, nomeEsperado: string) {
  const { id } = this.testData.usuarioDeGerenciamento;

  const { data } = await supabaseAdmin.from('system_users').select('name').eq('id', id).single();

  expect(data?.name).toBe(nomeEsperado);
});

When(
  'ele troca a própria senha pelo servidor para {string}',
  async function (this: CustomWorld, novaSenha: string) {
    const { id, email, senha } = this.testData.usuarioDeGerenciamento;

    // Precisa ser o token DELE, não o do admin -- a rota é "dono ou admin", e
    // aqui o que está sendo testado é exatamente o caso "dono".
    const { corpo: loginDele } = await pedirLogin(email, senha);
    expect(loginDele.token, 'não consegui logar como o próprio usuário para trocar a senha').toBeTruthy();

    const resultado = await chamarApi(`/api/users/${id}/change-password`, 'POST', loginDele.token, {
      newPassword: novaSenha,
    });

    expect(resultado.status, `troca de senha recusada: ${JSON.stringify(resultado.corpo)}`).toBe(200);

    // Login antigo já era com a senha anterior; do ponto de vista do próximo
    // passo (conferir no banco) não precisamos mais dele.
  }
);

Then('a senha dele no banco deve ser {string}', async function (this: CustomWorld, senhaEsperada: string) {
  const { id } = this.testData.usuarioDeGerenciamento;

  const { data } = await supabaseAdmin
    .from('system_users')
    .select('password_hash')
    .eq('id', id)
    .single();

  // O sistema guarda a senha em texto puro em password_hash hoje (mesmo
  // comentário "TEMPORARY" citado em database.helper.ts) -- por isso dá
  // para comparar direto.
  expect(data?.password_hash).toBe(senhaEsperada);
});

When('eu excluir esse usuário pelo servidor', async function (this: CustomWorld) {
  const { id } = this.testData.usuarioDeGerenciamento;

  const resultado = await chamarApi(`/api/users/${id}`, 'DELETE', this.testData.tokenAtual);
  expect(resultado.status, `exclusão recusada: ${JSON.stringify(resultado.corpo)}`).toBe(200);
});

Then('ele não deve mais existir no banco', async function (this: CustomWorld) {
  const { id } = this.testData.usuarioDeGerenciamento;

  const { data } = await supabaseAdmin.from('system_users').select('id').eq('id', id).maybeSingle();

  expect(data, 'o usuário ainda está no banco depois da exclusão').toBeNull();
});

When(
  'eu pedir para desbloquear esse usuário pelo servidor',
  async function (this: CustomWorld) {
    const { id } = this.testData.usuarioDeBloqueio;

    const { corpo } = await pedirLogin(TEST_CONFIG.users.admin.email, TEST_CONFIG.users.admin.password);

    const resultado = await chamarApi(`/api/users/${id}/unblock`, 'POST', corpo.token);
    expect(resultado.status, `desbloqueio recusado: ${JSON.stringify(resultado.corpo)}`).toBe(200);
  }
);

Then('o bloqueio dele deve estar limpo no banco', async function (this: CustomWorld) {
  const { id } = this.testData.usuarioDeBloqueio;

  const { data } = await supabaseAdmin
    .from('system_users')
    .select('login_attempts, blocked_until')
    .eq('id', id)
    .single();

  expect(data?.blocked_until, 'o bloqueio não foi limpo').toBeNull();
  expect(data?.login_attempts, 'a contagem de tentativas não foi zerada').toBe(0);

  // Limpa o usuário descartável deste cenário.
  await supabaseAdmin.from('system_users').delete().eq('id', id);
});
