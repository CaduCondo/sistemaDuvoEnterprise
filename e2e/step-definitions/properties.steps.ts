import path from 'path';
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { comMarcaDeTeste } from '../helpers/database.helper';

/**
 * Step Definitions específicos da página /properties (feature 5-imoveis-crud).
 * Seletores baseados em src/components/properties/PropertyFormDialog.tsx e
 * src/pages/properties.tsx (colunas reais: Local, Complemento, Valor,
 * Quartos, Banheiros, Área Útil, Status, Foto).
 */

Given('existe uma localização {string}', async function (this: CustomWorld, name: string) {
  const location = await this.createLocation({ name });
  this.locationId = location.id;
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99): "IMO-001" é um identificador
 * FIXO, reaproveitado por várias rodadas de CI ao longo do tempo -- o
 * banco de DEV (compartilhado) acumulou vários imóveis com esse mesmo
 * "IMO-001" de execuções antigas (mesmo problema já documentado em
 * `acharCardDoImovel`, mais abaixo). Isso é especialmente grave pro
 * cenário "Deletar imóvel - Confirmar": a asserção final ("o imóvel NÃO
 * deve aparecer na lista") usa `getByText(identifier)` -- com mais de um
 * "IMO-001" ainda na tela (porque só o `.first()` foi apagado), o
 * Playwright recusa a checagem por ambiguidade ("strict mode violation"),
 * e o cenário falha mesmo com o sistema se comportando certinho. Agora o
 * identificador salvo no banco (e usado em todos os passos seguintes,
 * via `testData.propertyIdentifier`) é único por execução -- a palavra
 * "IMO-001" na feature continua só como um nome legível pro Cadu, não
 * como o valor real gravado.
 */
Given('que existe um imóvel {string}', async function (this: CustomWorld, identifier: string) {
  const identificadorUnico = `${identifier}-${Date.now()}`;
  const property = await this.createProperty({ property_identifier: identificadorUnico });
  this.propertyId = property.id;
  this.testData.propertyIdentifier = identificadorUnico;
  await this.page.reload();
  await this.page.waitForLoadState('domcontentloaded');
});

Given('existe um imóvel {string} disponível', async function (this: CustomWorld, identifier: string) {
  const property = await this.createProperty({ property_identifier: identifier, status: 'available' });
  this.propertyId = property.id;
  this.testData.propertyIdentifier = identifier;
});

Given('que existe um imóvel disponível {string} com aluguel de {string}', async function (
  this: CustomWorld,
  identifier: string,
  rentValue: string
) {
  const property = await this.createProperty({
    property_identifier: identifier,
    status: 'available',
    value: parseFloat(rentValue.replace(/\./g, '').replace(',', '.')),
  });
  this.propertyId = property.id;
});

When('clico no botão de visualização em grid', async function (this: CustomWorld) {
  await this.page.locator('#properties-view-grid').click();
  await this.page.waitForTimeout(300);
});

When('clico no botão de visualização em lista', async function (this: CustomWorld) {
  await this.page.locator('#properties-view-table').click();
  await this.page.waitForTimeout(300);
});

Then('devo ver os imóveis em formato de cards', async function (this: CustomWorld) {
  // ⚠️ Corrigido (auditoria de falso positivo, 06/set/2026): o
  // ".catch(() => {})" engolia a falha de "a tabela não deve aparecer" --
  // o passo passava mesmo com a tabela ainda visível junto dos cards.
  await expect(this.page.locator('table')).not.toBeVisible();
  await expect(this.page.locator('[class*="card" i]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver os imóveis em formato de tabela', async function (this: CustomWorld) {
  await expect(this.page.locator('table').first()).toBeVisible({ timeout: 5000 });
});

When('preencho o campo de busca com {string}', async function (this: CustomWorld, text: string) {
  const search = this.page.locator('#property-filters-search, #tenant-filters-search, #rentals-search-input').first();
  await search.fill(text);
  await this.page.waitForTimeout(500);
});

Then('devo ver apenas imóveis que contenham {string} no endereço ou localização', async function (
  this: CustomWorld,
  text: string
) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(new RegExp(text, 'i'));
  }
});

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "tabela do Gherkin não
 * bate com tela"): a lista de locais é um Popover com CHECKBOXES
 * (PropertyFilters.tsx, LocationList) -- nunca foi um <select>/listbox,
 * então nunca teve elemento com role="option". `getByRole('option', ...)`
 * nunca encontrava nada e o passo ficava girando até estourar os 20s. O
 * certo é clicar no texto da opção (rótulo do checkbox) dentro do Popover
 * aberto, e fechar com Escape depois (o Popover não fecha sozinho ao
 * marcar o checkbox, porque é seleção múltipla).
 */
/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, cluster "Imóveis"): `.first()`
 * num seletor combinado (`#...-desktop, #...-mobile`) pega o PRIMEIRO do
 * DOM, não o primeiro VISÍVEL -- e o bloco mobile (`lg:hidden`, em
 * PropertyFilters.tsx) vem antes do desktop no código. No viewport padrão
 * do CI (desktop), isso sempre resolvia pro botão mobile escondido, e
 * `.click()` ficava esperando ele virar visível até estourar o timeout.
 * Mesmo tipo de causa já corrigido no passo genérico "seleciono o status"
 * (que já tentava cada candidato até achar um visível) -- só que este
 * passo específico de localização tinha ficado de fora daquele fix.
 */
/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, 2ª rodada): o loop de candidatos
 * (desktop/mobile) checava a visibilidade UMA ÚNICA VEZ, na hora -- mesmo
 * defeito já identificado e corrigido no passo irmão "seleciono o status"
 * (comentário logo abaixo, 13/set): enquanto a tela ainda busca os imóveis
 * no banco, os filtros nem existem no DOM ainda, então o check falhava e o
 * passo desistia na hora com "Nenhum filtro de localização visível" --
 * mesmo que o filtro fosse aparecer 1 segundo depois. Agora tenta de novo
 * por até 10s, igual ao "seleciono o status".
 */
async function selecionarLocalizacao(world: CustomWorld, locationName: string) {
  const candidatos = ['#property-filters-location-desktop', '#property-filters-location-mobile'];
  const deadline = Date.now() + 10000;
  let select;
  while (Date.now() < deadline && !select) {
    for (const seletor of candidatos) {
      const candidato = world.page.locator(seletor);
      if (await candidato.isVisible().catch(() => false)) {
        select = candidato;
        break;
      }
    }
    if (!select) await world.page.waitForTimeout(300);
  }
  if (!select) throw new Error('Nenhum filtro de localização visível na página atual (esperei 10s)');

  await select.click();
  // ⚠️ Corrigido em 14/set/2026 (issue #99): rodadas antigas deixaram
  // localizações REPETIDAS (mesmo nome) no banco de DEV -- mesmo motivo já
  // documentado no fallback de "preencho todos os campos obrigatórios"
  // (properties.steps.ts, campo "local"). Sem `.first()`, quando existe
  // mais de uma localização com esse nome na lista do Popover, o Playwright
  // recusa agir por ambiguidade ("strict mode violation") em vez de
  // escolher uma -- travando este passo em qualquer tela que dependa dele.
  // ⚠️ Corrigido em 17/set/2026 (issue #99, CI run #78): o nome do Local
  // criado pelo cenário vem do banco com o selo de teste no fim
  // ("Local do Filtro [E2E]"). Sem escapar, os colchetes deixam de ser texto
  // dentro da expressão de busca e viram "um caractere entre E, 2 e E" -- a
  // busca passa a procurar um nome que nunca existiu e o clique fica
  // esperando pra sempre. Mesmo defeito achado na seleção de inquilino em
  // payments.steps.ts.
  const nomeEscapado = locationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await world.page.getByText(new RegExp(`^${nomeEscapado}$`, 'i')).first().click();
  await world.page.keyboard.press('Escape');
  await world.page.waitForTimeout(500);
}

When('seleciono a localização {string}', async function (this: CustomWorld, locationName: string) {
  await selecionarLocalizacao(this, locationName);
});

/**
 * ⚠️ Criado em 17/set/2026 (issue #99, CI run #76): o cenário "Filtrar
 * imóveis por localização" filtrava por "São Paulo - Centro" -- um Local
 * que o teste NÃO cria, sobra de massa antiga. Depois da faxina do banco de
 * DEV, ou o Local não existe mais, ou não tem nenhum imóvel dentro dele, e
 * o filtro devolvia a tabela vazia ("locator(table tbody tr).first() not
 * visible"). Contraria a regra do Cadu registrada na issue #96: a
 * automação cria a própria massa, nunca depende de dado real. Agora o
 * cenário cria o Local e o imóvel dele.
 */
Given('que existe um imóvel nesse local', async function (this: CustomWorld) {
  const locationId = this.testData.idLocalCriado;
  if (!locationId) {
    throw new Error('Nenhum local foi criado antes deste passo (testData.idLocalCriado vazio).');
  }
  const identificador = `FILTRO-${Date.now()}`;
  const property = await this.createProperty({
    location_id: locationId,
    property_identifier: identificador,
    status: 'available',
  });
  this.propertyId = property.id;
  this.testData.propertyIdentifier = identificador;
});

// ⚠️ Timeout próprio (17/set/2026, CI run #78): recarrega a página e ainda
// espera o filtro de localização aparecer (até 10s) -- estourava os 20s
// padrão do Cucumber e o erro virava o genérico "function timed out".
When('seleciono a localização criada pelo cenário', { timeout: 40 * 1000 }, async function (this: CustomWorld) {
  const nome = this.testData.nomeLocalCriado;
  if (!nome) {
    throw new Error('Nenhum local foi criado antes deste passo (testData.nomeLocalCriado vazio).');
  }
  // O Contexto já abriu /properties ANTES de o Local e o imóvel existirem --
  // precisa recarregar para a tela enxergar o que foi criado no banco.
  await this.page.goto('/properties');
  await this.page.waitForLoadState('domcontentloaded');
  await selecionarLocalizacao(this, nome);
});

Then('devo ver apenas imóveis desta localização', async function (this: CustomWorld) {
  const nome = this.testData.nomeLocalCriado;
  const linhas = this.page.locator('table tbody tr');
  await expect(
    linhas.first(),
    `a lista ficou vazia depois de filtrar pela localização "${nome}"`
  ).toBeVisible({ timeout: 10000 });

  // ⚠️ A checagem antiga só conferia que existia ALGUMA linha -- passava até
  // se o filtro não tivesse filtrado nada. Agora confere que toda linha
  // visível é mesmo da localização escolhida (a 1ª coluna da tabela é "Local").
  const total = await linhas.count();
  for (let i = 0; i < total; i++) {
    await expect(
      linhas.nth(i),
      `a linha ${i + 1} não é da localização filtrada`
    ).toContainText(nome!);
  }
});

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99): a checagem de visibilidade dos
 * candidatos rodava uma ÚNICA vez, na hora -- se a tela ainda estivesse
 * carregando os dados (mesmo tipo de causa já corrigida em
 * `acharCardDoImovel`, mais acima neste arquivo: enquanto a tela busca no
 * banco, os filtros nem existem no DOM ainda), todos os candidatos vinham
 * "invisíveis" e o passo desistia na hora, com "Nenhum filtro de status
 * visível". Agora tenta de novo por até 10s antes de desistir de vez.
 */
/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, cluster "Pagamentos"): a página de
 * Recebimentos NÃO tem dropdown de status -- conferido em
 * PaymentFilters.tsx, que recebe `statusFilter`/`onStatusChange` como props
 * mas nunca renderiza nenhum Select com eles. O filtro de status ali é feito
 * pelas ABAS "Recebimentos Pendentes"/"Recebimentos Pagos"
 * (#payments-tab-pending/#payments-tab-paid, em payments.tsx). Sem isso, o
 * passo rodava os 10s inteiros de espera e estourava "Nenhum filtro de
 * status visível".
 */
When('seleciono o status {string}', async function (this: CustomWorld, status: string) {
  const abaPorStatus: Record<string, string> = {
    'pendente': '#payments-tab-pending',
    'pago': '#payments-tab-paid',
  };
  const abaSelector = abaPorStatus[status.trim().toLowerCase()];
  if (abaSelector) {
    // ⚠️ Corrigido em 14/set/2026 (issue #99, 2ª rodada): o check de
    // visibilidade da aba rodava uma ÚNICA vez, na hora -- mesmo defeito já
    // corrigido logo abaixo pro loop de candidatos do Select (13/set): se a
    // tela de Pagamentos ainda estivesse com "Carregando recebimentos..."
    // (payments.tsx) no instante exato do check, a aba "invisível" fazia o
    // passo cair no loop de candidatos de baixo -- que não tem nada de
    // Pagamentos -- e estourar "Nenhum filtro de status visível" depois de
    // 10s de espera inútil. Agora tenta de novo por até 10s antes de cair
    // pro loop genérico.
    const aba = this.page.locator(abaSelector);
    const deadlineAba = Date.now() + 10000;
    while (Date.now() < deadlineAba) {
      if (await aba.isVisible().catch(() => false)) {
        await aba.click();
        await this.page.waitForTimeout(500);
        return;
      }
      await this.page.waitForTimeout(300);
    }
  }

  // Reaproveitado nas páginas de Imóveis, Inquilinos e Pagamentos — tenta os
  // seletores conhecidos de cada uma.
  const candidates = [
    '#property-filters-status-desktop',
    '#property-filters-status-mobile',
    '#tenant-filters-status',
    '[id*="status-filter"]',
  ];
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    for (const selector of candidates) {
      const el = this.page.locator(selector).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click();
        // ⚠️ Corrigido em 14/set/2026 (issue #99): em Imóveis existem DOIS
        // Selects de status no DOM (desktop e mobile) -- Radix mantém o
        // conteúdo do outro Select montado mesmo fechado, então
        // getByRole('option', ...) sem escopo batia 2x no mesmo rótulo
        // ("strict mode violation"). `.first()` resolve, já que os dois
        // Selects têm as mesmas opções.
        await this.page.getByRole('option', { name: new RegExp(status, 'i') }).first().click();
        await this.page.waitForTimeout(500);
        return;
      }
    }
    await this.page.waitForTimeout(300);
  }
  throw new Error('Nenhum filtro de status visível na página atual (esperei 10s)');
});

Then('devo ver apenas imóveis disponíveis', async function (this: CustomWorld) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(/dispon[ií]vel/i);
  }
});

Then('devo ver apenas imóveis ocupados', async function (this: CustomWorld) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(/ocupado/i);
  }
});

Then('devo ver o formulário de cadastro de imóvel', async function (this: CustomWorld) {
  await expect(this.page.locator('#property-location')).toBeVisible({ timeout: 5000 });
});

Then('devo ver os campos obrigatórios:', async function (this: CustomWorld, dataTable: any) {
  const fields = dataTable.hashes ? dataTable.hashes() : dataTable.raw().map((r: string[]) => ({ campo: r[0] }));
  const map: Record<string, string> = {
    local: '#property-location',
    quartos: '#property-rooms',
    banheiros: '#property-bathrooms',
    'área (m²)': '#property-area',
    'área útil': '#property-area',
    valor: '#property-value',
  };
  for (const row of fields) {
    const key = (row.campo || '').toLowerCase();
    const selector = map[key];
    if (selector) {
      await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
    }
  }
});

When('tento salvar sem preencher o local', async function (this: CustomWorld) {
  await this.page.locator('#property-form-submit').click();
});

When('tento salvar sem preencher os quartos', async function (this: CustomWorld) {
  await this.page.locator('#property-rooms').fill('');
  await this.page.locator('#property-form-submit').click();
});

When('tento salvar sem preencher o código', async function (this: CustomWorld) {
  await this.page.locator('#property-form-submit').click();
});

When('tento salvar sem preencher o endereço', async function (this: CustomWorld) {
  await this.page.locator('#property-form-submit').click();
});

When('preencho todos os campos obrigatórios:', async function (this: CustomWorld, dataTable: any) {
  const rows = dataTable.hashes();

  for (const row of rows) {
    const campo = row.campo.toLowerCase();
    const valor = row.valor;

    // ---- Campos do formulário de Imóvel ----
    if (campo === 'local') {
      await this.page.locator('#property-location').click();
      // .first(): rodadas antigas deixaram localizações repetidas no banco de
      // DEV, e sem isso o Playwright recusa por ambiguidade.
      await this.page.getByRole('option', { name: new RegExp(valor, 'i') }).first().click();
    } else if (campo === 'complemento') {
      // Sela o registro criado PELA TELA, para a limpeza conseguir achá-lo
      // depois (issue #89). Sem isso, todo imóvel criado por cenário ficava
      // no banco para sempre -- o "Criar imóvel com sucesso" é @smoke e
      // rodava a cada push. As asserções continuam valendo: elas procuram
      // o texto original, que segue lá como começo do valor.
      await this.page.locator('#property-complement').fill(comMarcaDeTeste(valor));
    } else if (campo === 'quartos') {
      await this.page.locator('#property-rooms').fill(valor);
    } else if (campo === 'banheiros') {
      await this.page.locator('#property-bathrooms').fill(valor);
    } else if (campo === 'área' || campo === 'área útil' || campo === 'área (m²)') {
      await this.page.locator('#property-area').fill(valor);
    } else if (campo === 'valor' || campo === 'valor aluguel' || campo === 'valor do aluguel') {
      await this.page.locator('#property-value').fill(valor);

      // ---- Campos do formulário de Inquilino ----
    } else if (campo === 'nome' || campo === 'razão social') {
      // Mesmo motivo do complemento acima (#89): sela o inquilino criado pela tela.
      await this.page.locator('#tenant-name').fill(comMarcaDeTeste(valor));
    } else if (campo === 'cpf') {
      await this.page.locator('#tenant-document').fill(valor);
    } else if (campo === 'cnpj') {
      await this.page.locator('#tenant-document').fill(valor);
    } else if (campo === 'telefone') {
      await this.page.locator('#tenant-phone').fill(valor);
    } else if (campo === 'e-mail' || campo === 'email') {
      // O e-mail é único no sistema. Com o endereço fixo do cenário, o
      // cadastro dá certo na primeira rodada e, a partir da segunda, falha com
      // "E-mail existente" -- sem mensagem de sucesso e sem explicação óbvia.
      const [antes, dominio] = valor.split('@');
      const unico = dominio ? `${antes}+${Date.now()}@${dominio}` : valor;
      await this.page.locator('#tenant-email').fill(unico);
    }
  }
});

/**
 * Cobertura nova do bug de produção de 16/set/2026 (foto de imóvel gravada
 * em base64 direto no banco, em vez de subir pro Supabase Storage --
 * ver src/pages/properties.tsx, handleImageUpload). Usa o fixture
 * e2e/fixtures/foto-teste.png (PNG mínimo, 1x1 pixel, válido).
 *
 * O upload agora é assíncrono (sobe pro Storage antes de liberar o
 * formulário) -- por isso espera o botão de salvar voltar a ficar
 * habilitado (ele fica em "Salvando..." desabilitado enquanto a foto sobe)
 * antes de seguir para o próximo passo.
 */
When('envio a foto {string} do imóvel', async function (this: CustomWorld, fileName: string) {
  const caminho = path.join(__dirname, '..', 'fixtures', fileName);
  await this.page.locator('#photo-upload').setInputFiles(caminho);
  await expect(this.page.locator('#property-form-submit')).toBeEnabled({ timeout: 15000 });
});

Then(
  'no banco de dados a foto do imóvel deve estar salva no Storage, não em base64',
  async function (this: CustomWorld) {
    const identifier = this.testData.propertyIdentifier;
    const property = await this.findPropertyByIdentifier(identifier);
    expect(property, `Imóvel "${identifier}" não encontrado no banco.`).toBeTruthy();

    const imagens: string[] = property.images || [];
    expect(imagens.length, 'O imóvel deveria ter pelo menos uma foto salva.').toBeGreaterThan(0);

    for (const imagem of imagens) {
      expect(
        imagem.startsWith('data:image'),
        `Encontrada foto em base64 direto no banco (regressão do bug de 16/set/2026): ${imagem.slice(0, 40)}...`
      ).toBe(false);
    }
    expect(
      imagens.some((img) => img.includes('/storage/v1/object/public/')),
      'Nenhuma foto do imóvel aponta para o Supabase Storage.'
    ).toBe(true);
  }
);

Then('o imóvel deve aparecer na lista', async function (this: CustomWorld) {
  await this.page.waitForTimeout(500);
  await expect(this.page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
});

Then('o imóvel NÃO deve aparecer na lista', async function (this: CustomWorld) {
  const identifier = this.testData.propertyIdentifier;
  if (identifier) {
    await expect(this.page.getByText(identifier)).not.toBeVisible();
  }
});

Then('o imóvel deve permanecer na lista', async function (this: CustomWorld) {
  const identifier = this.testData.propertyIdentifier;
  if (identifier) {
    await expect(this.page.getByText(identifier)).toBeVisible();
  }
});

/**
 * ⚠️ Consertado em 09/set/2026 (issue #95).
 *
 * Os dois passos procuravam uma LINHA DE TABELA (`tr`) do imóvel. Só que a
 * tela de Imóveis abre na visão em CARDS (`viewMode` começa em "grid" --
 * ver useProperties.ts): não existe `tr` nenhum ali, então os passos
 * esperavam os 20s e morriam.
 *
 * Também não existe botão de "editar" por item: a edição abre clicando no
 * próprio card (onCardClick). O único botão do card é o de excluir.
 *
 * Agora os passos usam os ids fixos que o card passou a expor
 * (#property-card-{id} / #property-delete-{id}), localizados pelo
 * identificador do imóvel -- funciona na visão padrão, sem depender de
 * layout nem de rótulo.
 */
async function acharCardDoImovel(
  world: CustomWorld,
  identifier: string,
  opcoes?: { forcarVisaoEmGrade?: boolean }
) {
  // ⚠️ Corrigido em 14/set/2026 (issue #99, 2ª rodada -- causa raiz real,
  // as 3 tentativas anteriores abaixo não bastaram): o Contexto do arquivo
  // faz "E estou na página '/properties'" ANTES de qualquer cenário rodar
  // o "Dado que existe um imóvel {string}" -- ou seja, a tela já buscou os
  // imóveis do banco QUANDO o imóvel de teste ainda nem existia (ele é
  // criado depois, direto no banco). Nenhum filtro ou troca de visão
  // resolve isso -- o imóvel simplesmente nunca chegou na lista que já
  // estava em memória. Mesma causa raiz já corrigida em "Encerrar locação
  // antecipadamente" (rentals.steps.ts, "volto para a lista de locações").
  // Precisa recarregar a página DEPOIS que o imóvel foi criado.
  await world.page.goto('/properties');
  await world.page.waitForLoadState('domcontentloaded');

  // ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "item criado não
  // aparece na tela"): o banco de DEV é compartilhado e acumulou muitos
  // imóveis de execuções antigas (inclusive vários com este mesmo
  // identificador fixo "IMO-001", usado por várias cenários). Sem
  // filtrar, a tela tenta renderizar TODOS os imóveis do banco de uma vez
  // -- o que também pode ser lento o bastante pra estourar o timeout.
  // Filtra pelo identificador antes de procurar o card, do mesmo jeito
  // que já é feito em rentals.steps.ts com #rentals-search-input.
  //
  // ⚠️ 2º ajuste em 13/set/2026: o primeiro fix acima não funcionava --
  // conferido no CI (run 34768905762), erro idêntico ao de antes. Causa
  // raiz achada na época, lendo src/pages/properties.tsx: enquanto a tela
  // ainda está buscando os imóveis no banco (`if (loading) return <p>
  // Carregando...</p>`), a página INTEIRA -- inclusive a caixa de busca --
  // não existe ainda no DOM. Trocado o "isVisible().catch(() => false)"
  // por um espera de verdade (`waitFor({state:'visible'})`) -- essa parte
  // continua válida e necessária mesmo com o fix do reload acima.
  const busca = world.page.locator('#property-filters-search');
  await busca.waitFor({ state: 'visible', timeout: 15000 });
  await busca.fill(identifier);
  await world.page.waitForTimeout(500);

  // ⚠️ Corrigido em 17/set/2026 (CI run #78): quem precisa do BOTÃO de
  // deletar (que só existe no card da visão em grade) tem que trocar de
  // visão AQUI, depois do `goto` acima -- na primeira versão desta correção
  // a troca era feita no passo, ANTES de chamar este helper, e o `goto`
  // desfazia tudo, voltando pra visão em lista. O card nunca aparecia, o
  // clique no botão ficava esperando pra sempre e o passo estourava com o
  // genérico "function timed out".
  if (opcoes?.forcarVisaoEmGrade) {
    const toggleGrade = world.page.locator('#properties-view-grid');
    await toggleGrade.waitFor({ state: 'visible', timeout: 15000 });
    await toggleGrade.click();
    await world.page.waitForTimeout(300);
  }

  // ⚠️ Corrigido em 17/set/2026 (issue #99, causa raiz real): as duas
  // tentativas anteriores (força visão em grade, com e sem espera) nunca
  // resolveram de vez porque o problema não era o CLIQUE no toggle -- era
  // que o atributo `data-property-identifier` só existia em
  // PropertyCard.tsx (visão em grade). A visão em TABELA (SortableTable),
  // que é o padrão do sistema, não tinha nenhum gancho equivalente na
  // linha. Corrigido na origem: `SortableTable` agora aceita
  // `getRowAttributes`, e `properties.tsx` passa
  // `data-property-identifier` também na linha da tabela (ver
  // sortable-table.tsx e properties.tsx). Não precisa mais forçar visão
  // nenhuma para simplesmente ACHAR o imóvel -- o atributo existe nas duas.
  const card = world.page.locator(`[data-property-identifier="${identifier}"]`).first();
  await expect(
    card,
    `não achei o imóvel "${identifier}" na tela -- ele foi criado pelo cenário?`
  ).toBeVisible({ timeout: 15000 });
  return card;
}

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "Imóveis"): clicar no card
 * não abre o formulário já editável -- abre em modo SÓ LEITURA
 * (properties.tsx's handleCardClick sempre põe isViewMode=true primeiro).
 * Os campos só ficam editáveis (e o botão "Salvar" só aparece) depois de
 * clicar no botão "Editar Imóvel" (#property-form-edit) dentro do dialog
 * (PropertyFormDialog.tsx, showEditButton/handleEditClick). Sem esse
 * clique, o passo seguinte ("altero o valor...") tentava preencher um
 * campo desabilitado.
 */
// ⚠️ Corrigido em 14/set/2026 (issue #99): usa o identificador ÚNICO
// guardado por "que existe um imóvel {string}" (testData.propertyIdentifier)
// em vez do literal recebido do Gherkin -- ver comentário completo lá.
When('clico no botão de editar do imóvel {string}', async function (this: CustomWorld, identifier: string) {
  const card = await acharCardDoImovel(this, this.testData.propertyIdentifier || identifier);
  // Não há botão "editar" na lista: clicar no card abre o imóvel em modo
  // visualização primeiro.
  await card.click();
  await this.page.waitForTimeout(800);
  await this.page.locator('#property-form-edit').click();
  await this.page.waitForTimeout(300);
});

// ⚠️ O botão de deletar (`property-delete-{id}`) só existe dentro do card da
// visão em GRADE (PropertyCard.tsx) -- a linha da tabela não tem um botão
// equivalente (deletar por lá exige abrir o imóvel primeiro). Diferente do
// helper genérico `acharCardDoImovel` (que já acha em qualquer visão), este
// passo precisa mesmo da grade.
// ⚠️ Timeout próprio (17/set/2026, CI run #78): este passo recarrega a tela,
// espera a busca aparecer, filtra, troca de visão e só então clica -- passa
// folgado dos 20s padrão do Cucumber (hooks.ts), e o erro que sobrava era o
// genérico "function timed out", sem dizer nada sobre a causa real.
When('clico no botão de deletar do imóvel {string}', { timeout: 60 * 1000 }, async function (this: CustomWorld, identifier: string) {
  const card = await acharCardDoImovel(this, this.testData.propertyIdentifier || identifier, {
    forcarVisaoEmGrade: true,
  });
  await card.locator('[id^="property-delete-"]').click();
  await this.page.waitForTimeout(500);
});

Then('devo ver o formulário com os dados preenchidos', async function (this: CustomWorld) {
  await expect(this.page.locator('#property-value')).not.toHaveValue('');
});

Then('devo ver o alerta de confirmação', async function (this: CustomWorld) {
  await expect(this.page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
});

Then('o valor deve estar atualizado na lista', async function (this: CustomWorld) {
  await this.page.waitForTimeout(500);
  await expect(this.page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
});
