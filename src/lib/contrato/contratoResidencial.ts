// Contrato de locação RESIDENCIAL (issue #125).
//
// Texto baseado no modelo "Instrumento Particular de Contrato de Locação de
// Imóvel Residencial" enviado pelo Cadu em 02/nov/2026, adaptado para:
//   - LOCADOR sempre no masculino (Carlos Aparecido D'Uvo, dados vindos de
//     Configurações -> Dados do Locador; nunca do código, o repositório é
//     público);
//   - UM locatário, com o texto no masculino ou feminino conforme o campo
//     Sexo do inquilino (o modelo original tinha dois locatários, no plural);
//   - cláusulas e parágrafos numerados em ordem (o modelo pulava da sexta
//     para a décima, e § 3º -> § 5º, § 7º -> § 9º na vistoria);
//   - "Imóvel Comercial" no preâmbulo corrigido para "Residencial";
//   - a cláusula de responsabilidade SOLIDÁRIA fica, adaptada para um
//     locatário: ele responde por tudo mesmo morando com outras pessoas
//     (decisão do Cadu, 02/nov/2026);
//   - espaço para CLÁUSULAS ESPECÍFICAS DO LOCAL (cada condomínio/prédio tem
//     suas regras). Elas entram logo depois de "Impostos, taxas e encargos",
//     que é onde o modelo original pulava da sexta para a décima cláusula.
//     Hoje vêm de locations.contract_clauses (vazio por padrão; a tela para
//     cadastrar ainda não existe).
// O resto do texto jurídico foi mantido como no modelo.
//
// Esta função é pura (sem banco, sem tela): recebe os dados prontos e
// devolve o HTML do contrato + a lista do que falta preencher.

import { dataCurta, dataPorExtenso, inteiroPorExtenso, mesesEntre, reaisPorExtenso } from "./extenso";

export interface DadosLocador {
  nome?: string | null;
  cpf?: string | null;
  rg?: string | null;
  endereco?: string | null;
  cidade?: string | null; // cidade da assinatura
  banco?: string | null;
  agencia?: string | null;
  operacao?: string | null; // ex.: "poupança 1288"
  conta?: string | null;
  pix?: string | null;
  whatsapp?: string | null;
}

export interface DadosLocatario {
  nome?: string | null;
  sexo?: "M" | "F" | null;
  estadoCivil?: string | null; // solteiro | casado | divorciado | viuvo | uniao_estavel
  profissao?: string | null;
  rg?: string | null;
  cpf?: string | null;
  tipoDocumento?: string | null; // cpf | cnpj
  endereco?: string | null; // endereço completo já montado
}

export interface ClausulaLocal {
  titulo: string;
  /** Texto da cláusula. Pode ter mais de um parágrafo, separados por linha em branco. */
  texto: string;
}

export interface DadosImovel {
  usoComercial?: boolean;
  /** Regras específicas do local (condomínio/prédio), em ordem. */
  clausulasLocal?: ClausulaLocal[] | null;
  quartos?: number | null;
  banheiros?: number | null;
  temGaragem?: boolean;
  endereco?: string | null; // endereço completo já montado
  cidadeUf?: string | null; // "São Paulo/SP" -- município do cadastro
}

export interface DadosLocacao {
  inicio?: string | null; // ISO
  termino?: string | null; // ISO
  aluguel?: number | null; // só o imóvel
  garagem?: number | null; // valor da vaga, se houver
  diaVencimento?: number | null;
  primeiroVencimento?: string | null; // ISO
  caucao?: number | null;
  parcelasCaucao?: number | null;
}

export interface DadosContrato {
  locador: DadosLocador;
  locatario: DadosLocatario;
  imovel: DadosImovel;
  locacao: DadosLocacao;
  dataAssinatura: string; // ISO
}

export interface ResultadoContrato {
  /** HTML do contrato (vazio se não puder ser gerado). */
  html: string;
  /** O que falta preencher no sistema, em linguagem simples. */
  faltando: string[];
  /** Motivo de não existir modelo (ex.: imóvel comercial). */
  semModelo?: string;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

function vazio(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

const ESTADO_CIVIL: Record<string, [string, string]> = {
  solteiro: ["solteiro", "solteira"],
  casado: ["casado", "casada"],
  divorciado: ["divorciado", "divorciada"],
  viuvo: ["viúvo", "viúva"],
  uniao_estavel: ["em união estável", "em união estável"],
};

export function gerarContratoResidencial(d: DadosContrato): ResultadoContrato {
  if (d.imovel.usoComercial) {
    return {
      html: "",
      faltando: [],
      semModelo:
        "Este imóvel está cadastrado como Comercial. O modelo de contrato comercial ainda não existe no sistema — por enquanto só há o residencial.",
    };
  }
  if ((d.locatario.tipoDocumento || "").toLowerCase() === "cnpj") {
    return {
      html: "",
      faltando: [],
      semModelo:
        "O inquilino desta locação é uma empresa (CNPJ). O modelo atual é para pessoa física; o contrato para empresa ainda não existe no sistema.",
    };
  }

  const faltando: string[] = [];
  const L = d.locador;
  const T = d.locatario;
  const I = d.imovel;
  const C = d.locacao;

  if (vazio(L.nome)) faltando.push("Locador: nome (Configurações → Dados do Locador)");
  if (vazio(L.cpf)) faltando.push("Locador: CPF (Configurações → Dados do Locador)");
  if (vazio(L.rg)) faltando.push("Locador: RG (Configurações → Dados do Locador)");
  if (vazio(L.endereco)) faltando.push("Locador: endereço (Configurações → Dados do Locador)");
  if (vazio(L.cidade)) faltando.push("Locador: cidade da assinatura (Configurações → Dados do Locador)");
  if (vazio(L.pix) && (vazio(L.banco) || vazio(L.agencia) || vazio(L.conta)))
    faltando.push("Locador: dados bancários ou chave PIX (Configurações → Dados do Locador)");

  if (vazio(T.nome)) faltando.push("Inquilino: nome");
  if (T.sexo !== "M" && T.sexo !== "F") faltando.push("Inquilino: sexo");
  if (vazio(T.estadoCivil) || !ESTADO_CIVIL[String(T.estadoCivil)]) faltando.push("Inquilino: estado civil");
  if (vazio(T.profissao)) faltando.push("Inquilino: profissão");
  if (vazio(T.rg)) faltando.push("Inquilino: RG");
  if (vazio(T.cpf)) faltando.push("Inquilino: CPF");
  if (vazio(T.endereco)) faltando.push("Inquilino: endereço completo");

  if (vazio(I.endereco)) faltando.push("Imóvel: endereço (cadastro do Local, ou endereço manual se o local for \"Outros\")");

  if (vazio(C.inicio)) faltando.push("Locação: data de início");
  if (vazio(C.termino)) faltando.push("Locação: data de término");
  if (!C.aluguel || C.aluguel <= 0) faltando.push("Locação: valor do aluguel");
  if (!C.diaVencimento) faltando.push("Locação: dia do vencimento");
  if (!C.caucao || C.caucao <= 0) faltando.push("Locação: valor da caução (o modelo é de garantia por caução)");

  if (faltando.length > 0) return { html: "", faltando };

  // ---------------------------------------------------------------- textos
  const fem = T.sexo === "F";
  const g = (m: string, f: string) => (fem ? f : m);
  const oLocatario = g("o LOCATÁRIO", "a LOCATÁRIA");
  const OLocatario = g("O LOCATÁRIO", "A LOCATÁRIA");
  const doLocatario = g("do LOCATÁRIO", "da LOCATÁRIA");
  const aoLocatario = g("ao LOCATÁRIO", "à LOCATÁRIA");
  const peloLocatario = g("pelo LOCATÁRIO", "pela LOCATÁRIA");
  const LOCATARIO = g("LOCATÁRIO", "LOCATÁRIA");

  const aluguel = Number(C.aluguel);
  const garagem = Number(C.garagem || 0);
  const total = aluguel + garagem;
  const caucao = Number(C.caucao);
  const parcelas = Number(C.parcelasCaucao || 1);
  const meses = mesesEntre(C.inicio!, C.termino!);
  const dia = Number(C.diaVencimento);
  const diaTxt = `${dia} (${inteiroPorExtenso(dia).toUpperCase()})`;
  const estadoCivil = ESTADO_CIVIL[String(T.estadoCivil)][fem ? 1 : 0];

  const valorTxt = (v: number) => `<b>${moeda(v)}</b> (${reaisPorExtenso(v)})`;
  const composicao =
    garagem > 0
      ? `, sendo ${moeda(aluguel)} (${reaisPorExtenso(aluguel)}) referentes ao imóvel e ${moeda(garagem)} (${reaisPorExtenso(garagem)}) referentes à vaga de garagem`
      : "";

  // "equivalente a N aluguel(éis)" só quando a conta é exata
  const vezes = caucao / aluguel;
  const equivale =
    Math.abs(vezes - Math.round(vezes)) < 0.001 && Math.round(vezes) >= 1
      ? `, valor este <b>equivalente a ${Math.round(vezes)} (${inteiroPorExtenso(Math.round(vezes))}) ${Math.round(vezes) === 1 ? "aluguel" : "aluguéis"}</b>`
      : "";
  const formaCaucao =
    parcelas > 1
      ? `a quantia de ${valorTxt(caucao)}${equivale}, paga em ${parcelas} (${inteiroPorExtenso(parcelas)}) parcelas, como forma de depósito caução`
      : `nesta data a quantia de ${valorTxt(caucao)}${equivale} como forma de depósito caução`;

  const comodos: string[] = [];
  if (I.quartos) comodos.push(`${I.quartos} ${I.quartos === 1 ? "quarto" : "quartos"}`);
  if (I.banheiros) comodos.push(`${I.banheiros} ${I.banheiros === 1 ? "banheiro" : "banheiros"}`);
  if (I.temGaragem) comodos.push("1 vaga de garagem");
  const descricaoImovel =
    comodos.length > 0
      ? `Um <b>IMÓVEL RESIDENCIAL</b>, com ${comodos.length > 1 ? comodos.slice(0, -1).join(", ") + " e " + comodos[comodos.length - 1] : comodos[0]}.`
      : "Um <b>IMÓVEL RESIDENCIAL</b>.";

  // Redação do § 2º conforme o contrato do Carlos (enviado pelo Cadu em
  // 02/nov/2026): conta em nome do ADMINISTRADOR, chave PIX, comprovante
  // pelo WhatsApp e contrarrecibo pelo mesmo meio.
  const pagamento: string[] = [];
  if (!vazio(L.banco) && !vazio(L.agencia) && !vazio(L.conta)) {
    pagamento.push(
      `PIX/DEPÓSITO/TED em nome do ADMINISTRADOR ${esc(L.nome)}, no Banco ${esc(L.banco)}, <b>agência ${esc(L.agencia)}</b>${vazio(L.operacao) ? "" : `, operação <b>${esc(L.operacao)}</b>`}, conta <b>${esc(L.conta)}</b>`
    );
  }
  if (!vazio(L.pix)) pagamento.push(`na <b><u>chave PIX ${esc(L.pix)}</u></b>; em nome do LOCADOR`);
  const whatsapp = vazio(L.whatsapp)
    ? ""
    : `, sendo que ${oLocatario} se compromete a enviar o <u>comprovante de pagamento pelo WhatsApp no nº ${esc(L.whatsapp)}</u> e o LOCADOR, por sua vez, se compromete a enviar o contrarrecibo ${aoLocatario} pelo mesmo meio de comunicação`;

  const primeiro = C.primeiroVencimento
    ? `, vencendo o primeiro no dia <b>${dataPorExtenso(C.primeiroVencimento)}</b> e os demais`
    : ", vencendo";

  // numeração automática das cláusulas
  // Ordinais femininos até 39 ("trigésima nona"), para caber qualquer
  // quantidade razoável de cláusulas específicas do local.
  const UNID = ["", "primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "sétima", "oitava", "nona"];
  const DEZ = ["", "décima", "vigésima", "trigésima"];
  const ordinal = (n: number) => {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return [DEZ[d], UNID[u]].filter(Boolean).join(" ");
  };
  let nClausula = 0;
  const clausula = (titulo: string) =>
    `<h3><u>Cláusula ${ordinal(++nClausula)}</u>: ${titulo}</h3>`;
  const p = (html: string) => `<p>${html}</p>`;

  const partes: string[] = [];

  partes.push(`<h1>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL</h1>`);
  partes.push(`<div class="resumo">
<p><b>Locador</b>: ${esc(L.nome)}</p>
<p><b>${g("Locatário", "Locatária")}</b>: ${esc(T.nome)}</p>
<p><b>Garantia locatícia</b>: modalidade CAUÇÃO.</p>
<p><b>Imóvel</b>: ${esc(I.endereco)}.</p>
<p><b>Prazo</b>: ${meses} meses - <b>Início:</b> ${dataCurta(C.inicio!)} <b>Término:</b> ${dataCurta(C.termino!)}.</p>
<p><b>Aluguel</b>: ${moeda(total)} (${reaisPorExtenso(total)}).</p>
<p><b>Dia do Vencimento: ${dia}</b> (${inteiroPorExtenso(dia).toUpperCase()}) de cada mês.</p>
</div>`);

  partes.push(
    p(
      `As Partes, abaixo devidamente qualificadas, têm entre si, justo e contratado, o presente Contrato de Locação de Imóvel Residencial, mediante as Cláusulas e condições que mutuamente estipulam e aceitam:`
    )
  );
  partes.push(
    p(
      `Na qualidade de LOCADOR/ADMINISTRADOR LEGAL; <b>${esc(L.nome)}</b>, CPF: ${esc(L.cpf)}, RG nº ${esc(L.rg)}, com endereço na ${esc(L.endereco)}, doravante pura e simplesmente assim designado chamado de <b>LOCADOR</b>;`
    )
  );
  partes.push(
    p(
      `Na qualidade de ${g("PROPONENTE LOCATÁRIO", "PROPONENTE LOCATÁRIA")}; <b>${esc(T.nome)}</b>, ${estadoCivil}, ${esc(T.profissao)}, ${g("portador", "portadora")} da Cédula de Identidade ‘RG’ nº ${esc(T.rg)}, ${g("cadastrado", "cadastrada")} com seu CPF-MF sob o nº ${esc(T.cpf)}, com endereço referencial na ${esc(T.endereco)}, doravante pura e simplesmente assim ${g("designado chamado", "designada chamada")} de <b>${LOCATARIO}</b>;`
    )
  );

  partes.push(clausula("OBJETO DA LOCAÇÃO"));
  partes.push(
    p(
      `${descricaoImovel} Localizado na <b>${esc(I.endereco)}</b>${vazio(I.cidadeUf) ? "" : `, cadastrado na municipalidade de ${esc(I.cidadeUf)}`}.`
    )
  );

  partes.push(clausula("GARANTIA LOCATÍCIA"));
  partes.push(
    p(
      `Para a garantia dessa locação, ${oLocatario} entrega ao LOCADOR ${formaCaucao}, ficando esse depósito sob guarda e responsabilidade do LOCADOR para ser restituído ${aoLocatario} ao final da locação, devidamente corrigido pelo índice de correção da caderneta de poupança do período, nos termos da Lei 8.245/91.`
    )
  );
  partes.push(
    p(
      `<b>§ 1º</b> - A presente garantia responderá por todo e qualquer prejuízo futuro se houver no imóvel locado, caso ${oLocatario} não cumpra com sua responsabilidade de acordo com as cláusulas e seus parágrafos deste instrumento.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - Essa responsabilidade somente cessará com a efetiva entrega ao LOCADOR das chaves desde que todas as obrigações pecuniárias estejam cumpridas ${peloLocatario}.`
    )
  );
  partes.push(
    p(
      `<b>§ 3º</b> - Não será concedida a utilização da caução para pagamento de aluguel atrasado ou qualquer outro motivo em meio ao contrato vigente.`
    )
  );

  partes.push(clausula("FINALIDADE DA LOCAÇÃO"));
  partes.push(p(`O imóvel será utilizado exclusivamente para fins residenciais.`));

  partes.push(clausula("VALOR DO ALUGUEL E FORMA DE PAGAMENTO"));
  partes.push(
    p(
      `<b>§ 1º</b> – O aluguel convencionado é para todos os fins de direito e correções, no valor de ${valorTxt(total)}${composicao}${primeiro} todo dia <b>${diaTxt}</b> dos meses subsequentes, devendo ${oLocatario} pagar também todas as despesas e taxas referentes ao imóvel.`
    )
  );
  partes.push(
    p(`<b>§ 2º</b> – A forma de pagamento deverá ser feita através de ${pagamento.join("; ou ")}${whatsapp}.`)
  );
  partes.push(
    p(
      `<b>§ 3º</b> - O pagamento em conta após a data do vencimento não exime o pagamento dos encargos, e até o pagamento destes valores, permanecerá ${oLocatario} ${g("inadimplente", "inadimplente")} até o período da total quitação dos débitos. Além do valor do aluguel é de responsabilidade ${doLocatario} a conta de luz, internet e outros, sendo que as contas de consumo deverão ser pagas nos seus respectivos vencimentos, devendo ser enviados os comprovantes de pagamento sempre que for solicitado pelo LOCADOR.`
    )
  );
  partes.push(
    p(
      `<b>§ 4º</b> - Fica reservado ao LOCADOR o direito de a qualquer tempo alterar o local de pagamento do aluguel, bem como também nomear um representante, mediante comunicação por escrito ${aoLocatario} com antecedência de 30 (trinta) dias.`
    )
  );

  partes.push(clausula("ÍNDICE DE REAJUSTE"));
  partes.push(
    p(
      `<b>§ 1º</b> - O valor do aluguel será <b>reajustado anualmente, a cada período de 12 (DOZE) meses</b> pela variação acumulada do Índice Nacional de Preços ao Consumidor Amplo (<b>IPCA</b>), divulgado pelo IBGE. Na hipótese de extinção ou impossibilidade de utilização do referido índice, será adotado outro índice oficial que venha a substituí-lo, como IGP-M, mediante observância da legislação vigente.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - Ainda que o presente contrato passe a vigorar por <b>prazo indeterminado</b>, a cada 12 (doze) meses, contando do início de vigência do presente contrato, os aluguéis <b>serão reajustados</b>, de conformidade com o ora disposto em lei. A inserção de tal disposição não induz à renúncia de retomada do imóvel no término do prazo de locação ou no caso de sua vigência por prazo indeterminado.`
    )
  );

  partes.push(clausula("IMPOSTOS, TAXAS E DEMAIS ENCARGOS DA LOCAÇÃO"));
  partes.push(
    p(
      `<b>§ 1º</b> - Correrão por conta ${doLocatario}, na vigência da locação, os pagamentos que vierem a incidir sobre o imóvel; contas de consumo, luz, internet, água, e outras se houver.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - Os comprovantes de pagamento de taxas e demais encargos acima mencionados, que ${oLocatario} porventura pagar diretamente às concessionárias dos serviços públicos, deverão ser apresentados ao LOCADOR, sempre que este solicitar. No caso de inadimplência, se o LOCADOR for obrigado a efetuar tais pagamentos, o valor pago será cobrado ${doLocatario} com os acréscimos estabelecidos neste contrato.`
    )
  );
  partes.push(
    p(
      `<b>§ 3º</b> - ${OLocatario} ${g("obriga-se", "obriga-se")}, se houver necessidade, a providenciar, às suas expensas, a religação dos serviços de luz diretamente à Enel e outros.`
    )
  );
  partes.push(
    p(
      `<b>§ 4º</b> - É DE INTEIRA RESPONSABILIDADE E OBRIGAÇÃO ${g("DO LOCATÁRIO", "DA LOCATÁRIA")} A TRANSFERÊNCIA DE TITULARIDADE das contas de luz e outras, no prazo de 15 dias do início deste contrato. Caso não o faça, o LOCADOR poderá pedir às concessionárias o desligamento do fornecimento desses serviços.`
    )
  );

  // Cláusulas específicas do local (ver comentário no topo do arquivo).
  for (const cl of I.clausulasLocal || []) {
    if (vazio(cl?.titulo) || vazio(cl?.texto)) continue;
    partes.push(clausula(esc(String(cl.titulo).toUpperCase())));
    for (const paragrafo of String(cl.texto).split(/\n\s*\n/)) {
      if (!vazio(paragrafo)) partes.push(p(esc(paragrafo.trim()).replace(/\n/g, "<br>")));
    }
  }

  partes.push(clausula("PRAZO DO CONTRATO"));
  partes.push(
    p(
      `O prazo da presente locação é de ${meses} (${inteiroPorExtenso(meses)}) meses, iniciando-se no dia ${dataCurta(C.inicio!)}, e seu término no dia ${dataCurta(C.termino!)}.`
    )
  );

  partes.push(clausula("DA RESCISÃO CONTRATUAL APÓS 12 (DOZE) MESES"));
  partes.push(
    p(
      `<b>§ 1º</b> - Fica assegurado ${aoLocatario} o direito de rescindir antecipadamente o presente contrato de locação, após o cumprimento de 12 (doze) meses de vigência contratual, sem a incidência de multa rescisória, desde que comunique formalmente ao LOCADOR sua intenção de desocupar o imóvel, com antecedência mínima de 30 (trinta) dias.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - Caso a rescisão ocorra antes de completados os 12 (doze) meses de vigência, será devida a multa rescisória prevista neste contrato, calculada proporcionalmente ao período restante, nos termos do artigo 4º da Lei nº 8.245/1991.`
    )
  );
  partes.push(
    p(
      `<b>§ 3º</b> - A dispensa da multa após o período de 12 (doze) meses não exime ${oLocatario} do pagamento dos aluguéis, encargos locatícios e demais obrigações contratuais até a efetiva entrega das chaves.`
    )
  );

  partes.push(clausula("SEGURO CONTRA INCÊNDIO DO IMÓVEL"));
  partes.push(
    p(
      `<b>§ 1º</b> - Enquanto vigorar a locação, e até a efetiva restituição do imóvel nas condições acordadas na presente avença, correrá por conta ${doLocatario} a contratação do citado seguro, devendo apresentar a correspondente apólice ao LOCADOR, no prazo de 30 (trinta) dias, a contar da assinatura deste Contrato, sob pena de infração contratual por parte ${doLocatario}.`
    )
  );
  partes.push(
    p(
      `<b>§ Único</b> - Cobertura: por quantia nunca inferior a <b>100 vezes o valor do aluguel</b>, cujo seguro deverá ser renovado a cada 12 (doze) meses, sempre calculado pelo valor atualizado do aluguel, tendo como beneficiário o LOCADOR.`
    )
  );

  partes.push(clausula("IMPONTUALIDADE DE PAGAMENTO"));
  partes.push(
    p(
      `<b>§ 1º</b> - Se o aluguel e os encargos da presente locação não forem pagos pontualmente, até o dia de seu vencimento, sobre o débito total devido, sofrerá a incidência de atualização monetária pelo índice IPCA, juros de 12% (doze por cento) ao ano e fração pro-rata die, multa de 10% (dez por cento) sobre o montante devido e honorários de advogado no montante de 10% (dez por cento) se extrajudicial a cobrança ou, após eventual ajuizamento de ação judicial, de 20% (vinte por cento), além das despesas judiciais e extrajudiciais que forem devidas.`
    )
  );
  partes.push(
    p(
      `<b>§ Único</b> - O contrato de locação é configurado como título executivo para a SERASA e para o SPC - Serviço de Proteção ao Crédito, conforme consta em seu Regimento Interno, cláusula 9ª, § 2º. Dessa forma, esses órgãos permitem a inclusão dos inadimplentes dos contratos de locação nos cadastros do SCPC e da SERASA, e eventual mora ${doLocatario} será comunicada a essas entidades. E neste caso, ${oLocatario} renuncia a quaisquer direitos de obtenção de liminares no Poder Judiciário, visando impedir os lançamentos de seu nome como mau pagador nos aludidos serviços de proteção ao crédito.`
    )
  );

  partes.push(clausula("MULTA POR INFRAÇÃO CONTRATUAL OU RESCISÃO ANTECIPADA"));
  partes.push(
    p(
      `<b>§ 1º</b> - A parte que infringir este contrato incorrerá na multa correspondente a <b>três vezes</b> o valor do aluguel mensal, vigente à época da infração contratual, independentemente de qualquer aviso ou interpelação, inclusive na hipótese de ${oLocatario} não conservar o imóvel devidamente.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - No caso de ${oLocatario} vir a desocupar o imóvel antes do término do prazo contratual, mesmo que seja em decorrência de ação de despejo por falta de pagamento, ou qualquer outra infração contratual, deverá pagar a multa do parágrafo anterior, proporcionalmente ao tempo a vencer da locação, na forma dos termos do artigo 4º da Lei 8.245/91 complementada pela Lei 12.112/09 e artigo 413 do Código Civil.`
    )
  );
  partes.push(
    p(
      `<b>§ 3º</b> - Em nenhuma hipótese o pagamento da multa eximirá ${oLocatario} do pagamento dos aluguéis e encargos devidos, bem como de eventuais danos ocasionados ao imóvel, no curso da locação.`
    )
  );
  partes.push(
    p(
      `<b>§ 4º</b> - Considera-se também infração contratual passível de rescisão e sujeita às penalidades constantes deste contrato o desrespeito ou descumprimento do regulamento interno do condomínio, que desde já ${oLocatario} se obriga a tomar conhecimento de seu inteiro teor junto à Administração e se compromete a cumpri-lo.`
    )
  );
  partes.push(
    p(
      `<b>§ 5º</b> - Visando o bom senso de vizinhança e uma perfeita harmonia entre vizinhos, fica terminantemente proibido animal de estimação de grande porte.`
    )
  );

  partes.push(clausula("VISTORIA NO IMÓVEL – ENTRADA, ROTINA E SAÍDA"));
  partes.push(
    p(
      `<b>ENTRADA:</b> As partes assinam, nesta data, laudo de vistoria do imóvel, que ficará fazendo parte integrante deste contrato. ${OLocatario} deverá se manifestar, por escrito, no prazo de <b>10 (dez) dias</b> contados do início deste contrato, sobre qualquer divergência em relação ao laudo de vistoria. Caso não o faça dentro desse prazo, será considerada a sua concordância, nos termos ali descritos, obrigando-se a devolver o imóvel EXATAMENTE no estado descrito no laudo.`
    )
  );
  partes.push(
    p(
      `<b>ROTINA</b>: ${OLocatario}, desde já, se responsabiliza durante a locação a fazer as manutenções necessárias de uso do imóvel, como ar-condicionado caso haja, fechaduras, hidráulica, elétrica, portões, entre outras, e faculta ao LOCADOR examinar ou vistoriar o imóvel, quando este entender conveniente, em data previamente agendada.`
    )
  );
  partes.push(
    p(`<b>SAÍDA</b>: ${OLocatario} deverá devolver o imóvel inteiramente desocupado, e de acordo como o recebeu;`)
  );
  partes.push(
    p(
      `<b>§ 1º</b> Deverá restituí-lo com suas instalações elétricas, disjuntores, interruptores, tomadas e seus espelhos, hidráulicas, ferragens, janelas, portas, portões, fechaduras, vidros, paredes, pisos e rodapés, bem como em perfeito funcionamento e limpo, móveis e eletrodomésticos caso haja, no estado em que recebeu, salvo desgaste natural de uso e feitas as manutenções necessárias enquanto estiver no imóvel para a conservação dos mesmos.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> Responderá por perdas e danos e também por lucros cessantes, durante o período em que o imóvel estiver impedido de ser relocado, em razão de danos causados ${peloLocatario}.`
    )
  );
  partes.push(
    p(
      `<b>§ 3º</b> - A devolução do imóvel deverá ser formalizada por escrito, com o interesse em desocupar o imóvel, com antecedência de 30 dias e ser precedida de vistoria solicitada ${peloLocatario} com antecedência de no mínimo uma semana. Se forem constatados danos, ${oLocatario} deverá executar às suas expensas os reparos e reposições devidos, e agendar nova vistoria, ficando ${g("obrigado", "obrigada")} a pagar os aluguéis e encargos pro rata, até que o imóvel seja restituído de acordo com o parágrafo anterior.`
    )
  );
  partes.push(
    p(
      `<b>§ 4º</b> - Os encargos serão devidos até a data da entrega das chaves, sendo assim, é importante que <b>na data de vistoria de saída</b> o imóvel esteja em <b>perfeito estado</b>, completamente <b>LIMPO</b> e em ordem, conforme a vistoria inicial, devendo a pintura ser de mesma qualidade utilizada na entrada.`
    )
  );
  partes.push(
    p(
      `<b>§ 5º</b> - Caso o imóvel seja devolvido ${peloLocatario} sem os reparos necessários, poderá o LOCADOR promovê-los diretamente, sujeitando-se ${oLocatario} às respectivas despesas e aos aluguéis e encargos que se vencerem até que o imóvel esteja em condições de ser alugado novamente.`
    )
  );
  partes.push(
    p(
      `<b>§ 6º</b> - Da mesma forma ocorrerá para eventuais BENFEITORIAS executadas ${peloLocatario} sem autorização do LOCADOR, por exemplo: substituição de torneiras ou registros, e outras que impossibilitem o imóvel de ser relocado; ${oLocatario} estará ${g("sujeito", "sujeita")} à COBRANÇA DAS DESPESAS pela REPOSIÇÃO DO IMÓVEL NO ESTADO ORIGINAL e DOS ALUGUÉIS E ENCARGOS até a finalização dessas obras.`
    )
  );
  partes.push(
    p(
      `<b>§ 7º</b> - ${OLocatario} se responsabiliza pela <b>exclusão de seu nome</b> da titularidade nas contas de luz e outras desta natureza, o que deverá fazer após a vistoria de saída e o aceite do imóvel pelo LOCADOR. Em caso de não o fazer, ${oLocatario} estará de acordo e ${g("ciente", "ciente")} de que o LOCADOR <b>não se responsabilizará por eventuais problemas</b> que isso venha a acarretar, como por exemplo, a inserção de seu nome no Serasa, por inadimplência futura à data da rescisão da locação.`
    )
  );
  partes.push(
    p(
      `<b>§ 8º</b> - No caso de abandono do imóvel, fica facultado ao LOCADOR imitir-se imediatamente na posse do imóvel, independente de determinação judicial, sem qualquer responsabilidade por objetos deixados no local, não desonerando ${oLocatario} dos pagamentos dos aluguéis e demais encargos da locação em atraso; fica ainda ${g("ciente", "ciente")} que tal cobrança, comprovada com o termo de vistoria devidamente assinado por 2 testemunhas à sua revelia pelo abandono, com o total dos valores devidamente orçado e somado aos aluguéis, será emitida em boleto bancário de cobrança e enviada a todos os canais (WhatsApp e e-mail) ${g("a ele", "a ela")} e às pessoas descritas em seu cadastro de avaliação.`
    )
  );

  partes.push(clausula("MANUTENÇÃO E BENFEITORIAS NO IMÓVEL"));
  partes.push(
    p(
      `<b>MANUTENÇÃO:</b> As obras referentes à conservação do imóvel serão feitas às expensas ${doLocatario}, sem direito a qualquer indenização ou retenção ao desocupá-lo.`
    )
  );
  partes.push(
    p(
      `<b>§ 1º</b> - ${OLocatario} compromete-se a manter o imóvel em bom estado de conservação, higiene e limpeza; e a zelar pelo bom funcionamento de portões, instalações elétricas, hidráulicas, sanitárias, e outras que existirem, e pelo imóvel no seu todo, devendo também providenciar periodicamente a manutenção dos aparelhos de ar-condicionado e portões, se houver.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - Em caso de infestação de qualquer natureza, seja de cupim, de formigas, de outros insetos e animais, caberá ${aoLocatario} tomar TODAS as providências necessárias para sanar o foco de infestação, arcando com os respectivos custos.`
    )
  );
  partes.push(
    p(
      `<b>§ 3º</b> - Cabe ${aoLocatario} <b>manter o imóvel em boas condições, arcando exclusivamente com despesas de reparos a eventuais danos causados pelo próprio uso do mesmo</b>, por exemplo, de rejunte, entupimento, vazamento, troca de borrachas de vedação de torneiras e registros, troca de maçaneta de portas, chave, miolo de fechadura, disjuntor, tomadas, interruptores, lâmpadas queimadas, entrada de ar na tubulação de água, troca de equipamento de acionamento da caixa acoplada do vaso sanitário, troca de maçanetas e corrediças de portas e gavetas dos armários planejados, entre outros não mencionados (quando houver), por danos causados pelo próprio uso na permanência.`
    )
  );
  partes.push(
    p(
      `<b>§ 4º</b> - Caso seja detectado algum problema no imóvel, relativo <b>à estrutura e segurança</b>, não causado pelo uso do mesmo, que seja de responsabilidade do LOCADOR, ${oLocatario} deverá comunicar o fato imediatamente, por escrito, juntamente com um orçamento, detalhando o problema, as causas, o valor estimado de mão de obra e material. A falta de comunicação do problema sujeitará ${oLocatario} a ser ${g("responsabilizado", "responsabilizada")} por eventuais consequências danosas ao imóvel ou a terceiros. ${OLocatario} em nenhuma hipótese poderá, sem prévia autorização do LOCADOR, mandar executar o serviço e exigir o reembolso do conserto, sob pena de arcar ${g("sozinho", "sozinha")} com os reparos.`
    )
  );
  partes.push(
    p(
      `<b>BENFEITORIAS</b>: Para toda e qualquer benfeitoria, ou modificações a serem introduzidas no imóvel locado ou em suas instalações, será necessária prévia autorização, por escrito, do LOCADOR, sob pena de rescisão contratual, e as que, com autorização, forem feitas deverão ser devidamente regularizadas na Municipalidade ${peloLocatario} e passarão a pertencer ao LOCADOR, independentemente de indenização, sem qualquer direito de retenção.`
    )
  );
  partes.push(
    p(
      `<b>§ 1º</b> - Poderá o LOCADOR, finda a locação, exigir que as benfeitorias ou modificações introduzidas sem o seu consentimento sejam retiradas às custas ${doLocatario}, ${g("o qual", "a qual")} fica ${g("obrigado", "obrigada")} a pagar os aluguéis devidos, até que o imóvel seja restituído sem as mesmas, tal como lhe foi entregue pelo LOCADOR.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - ${OLocatario} fica ${g("obrigado", "obrigada")}, no curso da locação, a satisfazer todas as intimações dos poderes públicos a que der causa. Essas intimações não motivarão a rescisão do presente contrato.`
    )
  );

  partes.push(clausula("PRORROGAÇÃO DO CONTRATO POR PRAZO INDETERMINADO"));
  partes.push(
    p(
      `Findo o prazo deste contrato, mas prorrogado por força de lei ou conveniência das partes, reputar-se-ão prorrogadas e em vigor todas as cláusulas e condições ora pactuadas, regulando as relações entre as partes até a final e efetiva desocupação do imóvel.`
    )
  );
  partes.push(
    p(
      `<b>§ 1º</b> - Prorrogando-se esta locação por <b>prazo indeterminado</b>, LOCADOR ou ${LOCATARIO} poderão <b>denunciar</b> a locação, mediante notificação por escrito ao outro, com <b>antecedência mínima de 30</b> (trinta) <b>dias</b>.`
    )
  );
  partes.push(
    p(
      `<b>§ 2º</b> - Na ausência da notificação, o LOCADOR poderá exigir quantia correspondente a um mês de aluguel e encargos, vigente quando da resilição, na forma da lei.`
    )
  );

  partes.push(clausula("TRANSFERÊNCIA, SUBLOCAÇÃO, VENDA, DESAPROPRIAÇÃO, INCÊNDIO"));
  partes.push(
    p(
      `<b>Sublocação</b>: Não é permitida, em nenhuma hipótese, a transferência deste contrato, nem sublocação, cessão ou empréstimo, no todo ou em parte, do imóvel locado, salvo com anuência expressa do LOCADOR.`
    )
  );
  partes.push(
    p(
      `<b>Venda</b>: No caso de o imóvel locado ser posto à venda, o LOCADOR deve dar preferência para compra do imóvel ${aoLocatario}, em cumprimento ao previsto no Art. 27 da Lei 8.245/91. ${OLocatario} permitirá visitas, previamente agendadas, dos interessados na compra, acompanhados sempre do LOCADOR ou do seu representante, caso não venha a adquirir o imóvel.`
    )
  );
  partes.push(
    p(
      `<b>Desapropriação</b>: Em caso de desapropriação, o LOCADOR ficará desobrigado das cláusulas deste contrato, ressalvada ${aoLocatario} a defesa de seus interesses junto ao poder expropriante.`
    )
  );
  partes.push(
    p(
      `<b>Incêndio</b>: Em caso de incêndio, ou de acidentes, que obriguem a reconstrução do imóvel, o LOCADOR aceitará a rescisão do contrato bem como as chaves do imóvel, desde que ${oLocatario} esteja com a apólice do seguro incêndio em vigor. Caso não esteja em vigor, ${oLocatario} declara expressamente que se responsabiliza pela reconstrução do imóvel, arcando com o pagamento do aluguel e encargos até a efetiva entrega do imóvel em perfeitas condições, como o recebera, em conformidade com a lei.`
    )
  );

  partes.push(clausula(`DA RESPONSABILIDADE SOLIDÁRIA ${g("DO LOCATÁRIO", "DA LOCATÁRIA")}`));
  partes.push(
    p(
      `${OLocatario} ${g("declara-se", "declara-se")} ${g("responsável", "responsável")} por todas as obrigações decorrentes deste contrato de locação, nos termos dos artigos 2º e 265 do Código Civil e do artigo 2º da Lei nº 8.245/91, respondendo pela integralidade das obrigações assumidas, independentemente de quem esteja ocupando o imóvel ou realizando os pagamentos, inclusive pelos atos das pessoas que com ${g("ele", "ela")} residirem no imóvel. A presente responsabilidade permanecerá vigente durante todo o período da locação e eventuais prorrogações, até a efetiva quitação de todas as obrigações decorrentes deste contrato.`
    )
  );

  partes.push(clausula("NOTIFICAÇÕES, CITAÇÕES E RESPONSABILIDADE POR ASSINATURAS E DOCUMENTOS"));
  partes.push(
    p(
      `A intimação, notificação ou citação ${doLocatario}, judicial ou extrajudicialmente, poderá ser feita mediante correspondência, com aviso de recebimento – A.R., ou ainda, sendo necessário, pelas demais formas previstas no Código de Processo Civil, conforme o artigo 58, inciso IV da Lei nº 8.245/91, podendo também ser endereçada aos endereços constantes do preâmbulo deste contrato ou através de endereços eletrônicos (e-mail) e via WhatsApp. O comprovante do recebimento nos endereços das partes e/ou o comprovante do envio do e-mail e WhatsApp para a outra parte determina a contagem do prazo para o atendimento e responsabilidade a ser cumprida por conta do presente instrumento.`
    )
  );
  partes.push(
    p(
      `<b>§ 1º</b> - ${OLocatario} responde civil e criminalmente pela legitimidade das assinaturas e da documentação apresentada. Havendo constatação de qualquer irregularidade ou inveracidade, o contrato poderá ser rescindido pelo LOCADOR.`
    )
  );
  partes.push(
    p(
      `As partes elegem o Foro Regional da situação do imóvel para dirimir questões que advierem deste contrato. E, por assim haverem contratado, assinam o presente em 2 (duas) vias, juntamente com as duas testemunhas abaixo.`
    )
  );

  partes.push(`<p class="data-assinatura">${esc(L.cidade)}, ${dataPorExtenso(d.dataAssinatura)}.</p>`);
  partes.push(`<div class="assinaturas">
<div class="assinatura"><div class="linha"></div><b>LOCADOR: ${esc(L.nome)}</b></div>
<div class="assinatura"><div class="linha"></div><b>${LOCATARIO}: ${esc(T.nome)}</b></div>
</div>
<div class="testemunhas"><p><b>TESTEMUNHAS:</b></p>
<div class="assinaturas">
<div class="assinatura"><div class="linha"></div>1) Nome / CPF</div>
<div class="assinatura"><div class="linha"></div>2) Nome / CPF</div>
</div></div>`);

  return { html: partes.join("\n"), faltando: [] };
}
