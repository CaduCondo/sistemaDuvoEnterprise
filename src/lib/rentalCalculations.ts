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
