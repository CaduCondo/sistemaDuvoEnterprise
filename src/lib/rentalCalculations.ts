import { Property } from "@/types";

/**
 * Formata uma data string (YYYY-MM-DD) para exibição sem problemas de timezone
 * Adiciona T00:00:00 para forçar interpretação como hora local
 */
export function formatDateLocal(dateString: string): Date {
  if (!dateString) return new Date();
  // Adiciona T00:00:00 para forçar interpretação como local, não UTC
  return new Date(dateString + "T00:00:00");
}

/**
 * Calcula a diferença de dias entre a data de início do contrato e a data de vencimento
 * Retorna o número de dias que devem ser cobrados no primeiro aluguel
 */
export function calculateDaysBetweenDates(startDate: string, paymentDay: number): number {
  if (!startDate || !paymentDay) return 0;

  const start = formatDateLocal(startDate);
  const startDay = start.getDate();
  
  // Se o dia de início for igual ao dia de pagamento, não há proporcionalidade
  if (startDay === paymentDay) return 30;

  // Calcular a data de vencimento (primeiro dia de pagamento)
  const paymentDate = new Date(start);
  
  // Se o dia de pagamento já passou no mês atual, vai para o próximo mês
  if (startDay > paymentDay) {
    paymentDate.setMonth(paymentDate.getMonth() + 1);
  }
  
  paymentDate.setDate(paymentDay);

  // Calcular diferença em dias
  const diffTime = paymentDate.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Calcula o valor proporcional do primeiro aluguel
 * Fórmula: (valor_mensal / 30) × número_de_dias
 */
export function calculateProportionalRent(
  monthlyRent: number,
  startDate: string,
  paymentDay: number
): number {
  const days = calculateDaysBetweenDates(startDate, paymentDay);
  
  // Se for 30 dias, retorna o valor integral
  if (days === 30) return monthlyRent;
  
  // Calcula o valor proporcional
  const dailyRate = monthlyRent / 30;
  const proportionalValue = dailyRate * days;
  
  return Math.round(proportionalValue * 100) / 100; // Arredonda para 2 casas decimais
}

/**
 * ============================================================================
 * O CÁLCULO PROPORCIONAL DO SISTEMA — UM LUGAR SÓ
 * ============================================================================
 *
 * A regra do negócio é sempre a mesma: o mês vale 30 dias, e cobra-se
 * `valor / 30 x dias`. Isso aparece no primeiro aluguel (quando o contrato
 * começa fora do dia de vencimento), na rescisão, e quando o valor da locação
 * é corrigido no meio do caminho.
 *
 * ⚠️ POR QUE ISTO EXISTE, E POR QUE NINGUÉM DEVE ESCREVER A CONTA DE NOVO
 *
 * Em 24/ago/2026 essa mesma conta estava escrita SEIS vezes na mão, espalhada
 * pelo sistema. Quatro cópias somavam a garagem; duas — as duas da rescisão —
 * esqueceram. Resultado: em toda rescisão de imóvel com garagem, a garagem
 * simplesmente sumia da cobrança. O erro não foi encontrado por auditoria:
 * foi encontrado porque o Cadu conferiu a conta de um cenário de teste e
 * perguntou onde estava a garagem.
 *
 * Uma conta com uma implementação só não tem como divergir assim. Se precisar
 * de proporcional em algum lugar novo, chame daqui.
 */

/** Proporcional de um valor mensal qualquer, sobre um mês de 30 dias. */
export function calcularProporcional(valorMensal: number, dias: number): number {
  if (!valorMensal || !dias) return 0;
  return Math.round(((valorMensal / 30) * dias) * 100) / 100;
}

export interface ProporcionalAluguelEGaragem {
  dias: number;
  aluguel: number;
  garagem: number;
  total: number;
}

/**
 * Proporcional do aluguel e da garagem, calculados SEPARADAMENTE.
 *
 * Separados de propósito: é assim que o recebimento mensal normal já monta o
 * detalhamento (uma linha "Aluguel" e uma linha "Garagem"), e é assim que o
 * Cadu confere a conta. Somar os dois antes de proporcionalizar dá o mesmo
 * número, mas esconde a garagem — e foi exatamente escondida que ela sumiu.
 */
export function calcularProporcionalAluguelEGaragem(
  aluguelMensal: number,
  garagemMensal: number,
  dias: number
): ProporcionalAluguelEGaragem {
  const aluguel = calcularProporcional(aluguelMensal, dias);
  const garagem = calcularProporcional(garagemMensal, dias);

  return {
    dias,
    aluguel,
    garagem,
    total: Math.round((aluguel + garagem) * 100) / 100,
  };
}

/**
 * Verifica se a primeira parcela deve ser proporcional
 */
export function shouldUseProportionalRent(startDate: string, paymentDay: number): boolean {
  if (!startDate || !paymentDay) return false;
  
  const start = formatDateLocal(startDate);
  const startDay = start.getDate();
  
  return startDay !== paymentDay;
}

/**
 * Calcula o valor total da locação incluindo aluguel base e garagem
 */
export function calculateTotalRent(
  propertyValue: number,
  hasGarage: boolean,
  garageValue: string
): number {
  const cleanGarageValue = hasGarage
    ? parseFloat(garageValue.replace(/[^\d,]/g, "").replace(",", ".") || "0")
    : 0;
  return propertyValue + cleanGarageValue;
}

/**
 * Valida se todos os campos obrigatórios estão preenchidos
 */
export function validateRentalForm(data: {
  propertyId: string;
  tenantId: string;
  startDate: string;
  paymentDay: string;
}): { isValid: boolean; error?: string } {
  if (!data.propertyId || !data.tenantId || !data.startDate || !data.paymentDay) {
    return {
      isValid: false,
      error: "Por favor, preencha todos os campos obrigatórios.",
    };
  }
  return { isValid: true };
}

/**
 * Valida se o valor total da locação é válido
 */
export function validateRentalValue(totalValue: number): { isValid: boolean; error?: string } {
  if (!totalValue || totalValue <= 0) {
    return {
      isValid: false,
      error: "O valor total da locação deve ser maior que zero.",
    };
  }
  return { isValid: true };
}

/**
 * Prepara os dados da locação para envio ao backend
 * RETORNA EM CAMELCASE - A conversão para snake_case é feita no rentalService.ts
 */
export function prepareRentalData(
  propertyId: string,
  tenantId: string,
  startDate: string,
  endDate: string,
  paymentDay: string,
  propertyValue: number,
  hasGarage: boolean,
  garageValue: string,
  attachments: string[],
  securityDeposit: string,
  hasPartnerBroker: boolean
) {
  const totalValue = calculateTotalRent(propertyValue, hasGarage, garageValue);
  const cleanGarageValue = hasGarage
    ? parseFloat(garageValue.replace(/[^\d,]/g, "").replace(",", ".") || "0")
    : 0;
  const cleanSecurityDeposit = parseFloat(securityDeposit.replace(/[^\d,]/g, "").replace(",", ".") || "0");

  // RETORNA EM CAMELCASE
  return {
    propertyId: propertyId,
    tenantId: tenantId,
    startDate: startDate,
    endDate: endDate || null,
    paymentDay: parseInt(paymentDay),
    monthlyRent: propertyValue,
    value: totalValue,
    hasGarage: hasGarage,
    garageValue: hasGarage ? cleanGarageValue : null,
    securityDeposit: cleanSecurityDeposit,
    hasPartnerBroker: hasPartnerBroker,
    partnerBrokerValue: null,
    isActive: true,
    contractAttachments: attachments,
    attachments: attachments,
  };
}

/**
 * Formata o nome do local com complemento se houver
 */
export function formatPropertyDisplay(locationName: string, complement?: string): string {
  return complement ? `${locationName} - ${complement}` : locationName;
}

/**
 * A linha do breakdown que representa a devolucao do caucao ao inquilino.
 *
 * ⚠️ Existe porque o rotulo dessa linha mudou ao longo do tempo: os
 * recebimentos antigos gravaram "Devolução de Caução" e os criados a partir
 * da #49 gravam "Valor Devolução Caução" (sem o "de"). O codigo que procurava
 * pelo texto exato antigo simplesmente parava de achar a linha nos
 * recebimentos novos -- e com isso sumia o tooltip da correcao pela poupanca
 * e a atualizacao do valor corrigido na tela.
 *
 * Casar por "devolução" + "caução", sem acento e sem caixa, cobre os dois.
 */
export function ehLinhaDeDevolucaoDeCaucao(descricao?: string | null): boolean {
  if (!descricao) return false;
  const normalizado = descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalizado.includes("devolucao") && normalizado.includes("caucao");
}


/**
 * Quanto do caucao o inquilino EFETIVAMENTE PAGOU.
 *
 * E sobre este valor que incide a correcao pela poupanca na rescisao
 * (decisao 4 do ticket, docs/tickets/rescisao-caucao.md): se o caucao foi
 * contratado em 3 parcelas e so 2 foram pagas, devolve-se sobre as 2.
 *
 * ⚠️ O \`|| amount\` nao e paranoia. Ate 26/ago/2026
 * markDepositInstallmentAsPaid() gravava status='paid' sem gravar
 * paid_amount, que ficava no default 0. As parcelas pagas ate essa data estao
 * no banco como "pagas por R$ 0,00", e somar paid_amount cru daria zero em
 * todo contrato antigo. Para uma parcela marcada como paga, o valor pago e o
 * valor da parcela.
 *
 * Parcela PARCIAL fica de fora dessa regra: ali o paid_amount e gravado
 * corretamente e vale o que esta nele.
 */
export function caucaoEfetivamentePago(
  parcelas: Array<{ amount?: number | null; paid_amount?: number | null; status?: string | null }> | null | undefined
): number {
  return (parcelas || []).reduce((soma, parcela) => {
    const pago = Number(parcela.paid_amount || 0);
    if (pago > 0) return soma + pago;
    if (parcela.status === "paid") return soma + Number(parcela.amount || 0);
    return soma;
  }, 0);
}


/**
 * Monta o breakdown e o TOTAL de um recebimento de rescisao (os dois: o de
 * aluguel e o de rescisao propriamente dito).
 *
 * ⚠️ EXISTE PARA HAVER UMA CONTA SO.
 *
 * Ate 26/ago/2026 este calculo estava escrito TRES vezes dentro de
 * ManagePaymentForm.tsx -- uma para exibir na tela, uma no auto-save e uma no
 * salvar do pagamento -- e as tres divergiam:
 *
 *   exibicao       breakdown + despesas - desconto     (caucao atualizado)
 *   auto-save      Math.abs(breakdown - desconto)      (caucao NAO atualizado)
 *   salvar         breakdown - desconto                (caucao NAO atualizado)
 *
 * O resultado apareceu na tela do Cadu: a lista de Recebimentos mostrava
 * R$ 6.201,25 e o mesmo recebimento, aberto, mostrava -R$ 5.201,25.
 *
 * Dois erros somados nas versoes de gravacao:
 *
 * 1. \`Math.abs\` no expected_amount. O sinal NAO e ruido: negativo significa
 *    que a imobiliaria devolve dinheiro ao inquilino. Jogar o sinal fora
 *    transformava uma devolucao em cobranca dentro do banco.
 *
 * 2. As duas procuravam a linha do caucao por "Devolução de Caução", texto
 *    que a #49 trocou por "Valor Devolução Caução". Nunca achavam a linha, e
 *    gravavam o valor velho do caucao enquanto a tela exibia o novo.
 *
 * Agora e uma funcao pura, chamada pelos tres pontos. Divergir de novo exige
 * alterar isto aqui, e ai muda em todos ao mesmo tempo.
 */
export interface EntradaRecebimentoRescisao {
  /** O breakdown como esta gravado no recebimento. */
  breakdown: unknown;
  /** Caucao corrigido pela poupanca, POSITIVO. Vira linha negativa. */
  caucaoCorrigido?: number;
  /** Multa por atraso, se houver e se nao tiver sido perdoada. */
  multaAtraso?: number;
  /** Juros por atraso, se houver e se nao tiverem sido perdoados. */
  jurosAtraso?: number;
  /** Despesas adicionais digitadas pelo usuario. Positivo. */
  despesasAdicionais?: number;
  /** Desconto digitado pelo usuario, sem sinal. Sempre subtrai. */
  desconto?: number;
}

export function montarRecebimentoRescisao({
  breakdown,
  caucaoCorrigido = 0,
  multaAtraso = 0,
  jurosAtraso = 0,
  despesasAdicionais = 0,
  desconto = 0,
}: EntradaRecebimentoRescisao): { breakdown: any[]; total: number } {
  let itens: any[] = [];

  if (typeof breakdown === "string") {
    try {
      itens = JSON.parse(breakdown);
    } catch {
      itens = [];
    }
  } else if (Array.isArray(breakdown)) {
    itens = [...breakdown];
  }

  if (!Array.isArray(itens)) itens = [];

  // O caucao corrigido manda sobre o que estiver gravado: ele muda conforme a
  // taxa da poupanca do periodo e conforme o que o inquilino pagou de fato.
  if (caucaoCorrigido > 0) {
    itens = itens.map((item) =>
      ehLinhaDeDevolucaoDeCaucao(item?.description)
        ? { ...item, amount: -Math.abs(caucaoCorrigido) }
        : item
    );
  }

  // Fora as linhas que sao recalculadas a cada abertura da tela. O desconto
  // nunca vira linha: ele entra no total, e so.
  itens = itens.filter(
    (item) =>
      !item?.description?.includes("Despesas") &&
      !item?.description?.includes("Multa por Atraso") &&
      !item?.description?.includes("Juros por Atraso") &&
      !item?.description?.includes("Desconto")
  );

  if (multaAtraso > 0) {
    itens.push({ description: "Multa por Atraso", amount: multaAtraso, type: "addition" });
  }

  if (jurosAtraso > 0) {
    itens.push({ description: "Juros por Atraso", amount: jurosAtraso, type: "addition" });
  }

  if (despesasAdicionais > 0) {
    itens.push({
      description: "Despesas Adicionais",
      amount: despesasAdicionais,
      type: "addition",
    });
  }

  const soma = itens.reduce((total, item) => total + Number(item?.amount || 0), 0);

  // Sem Math.abs. Total negativo = a imobiliaria devolve dinheiro.
  const total = Math.round((soma - Math.abs(desconto)) * 100) / 100;

  return { breakdown: itens, total };
}
