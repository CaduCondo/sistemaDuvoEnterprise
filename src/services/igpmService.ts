import { differenceInMonths, format } from "date-fns";

/**
 * Serviço para calcular correção monetária pela Taxa da Poupança
 * Valores oficiais obtidos de: https://www.vriconsulting.com.br/indices/poupanca.php
 * Fonte alternativa: https://www.debit.com.br/tabelas/poupanca
 * 
 * A poupança rende mensalmente uma taxa variável baseada na Selic.
 * Os valores abaixo são os rendimentos REAIS registrados mês a mês.
 * 
 * IMPORTANTE: Usar as 2 primeiras colunas dos sites (Mês/Ano e Índice do mês em %)
 */

interface PoupancaData {
  month: string;
  year: string;
  value: number; // Percentual mensal da poupança
}

/**
 * Base de dados da Taxa da Poupança (rendimento mensal REAL)
 * Fonte: https://www.vriconsulting.com.br/indices/poupanca.php
 * Valores oficiais atualizados até Fevereiro/2026
 */
const POUPANCA_DATABASE: PoupancaData[] = [
  // 2024 - Valores oficiais confirmados ✅
  { month: "01", year: "2024", value: 0.5917 },
  { month: "02", year: "2024", value: 0.5917 },
  { month: "03", year: "2024", value: 0.5917 },
  { month: "04", year: "2024", value: 0.5917 },
  { month: "05", year: "2024", value: 0.5917 },
  { month: "06", year: "2024", value: 0.5917 },
  { month: "07", year: "2024", value: 0.5542 },
  { month: "08", year: "2024", value: 0.5542 },
  { month: "09", year: "2024", value: 0.5542 },
  { month: "10", year: "2024", value: 0.5542 },
  { month: "11", year: "2024", value: 0.5938 },
  { month: "12", year: "2024", value: 0.6479 },
  
  // 2025 - Valores oficiais confirmados ✅
  { month: "01", year: "2025", value: 0.6698 },
  { month: "02", year: "2025", value: 0.6331 },
  { month: "03", year: "2025", value: 0.6097 },
  { month: "04", year: "2025", value: 0.6697 },
  { month: "05", year: "2025", value: 0.6721 },
  { month: "06", year: "2025", value: 0.6707 },
  { month: "07", year: "2025", value: 0.6767 },
  { month: "08", year: "2025", value: 0.6731 },
  { month: "09", year: "2025", value: 0.6751 },
  { month: "10", year: "2025", value: 0.6767 },
  { month: "11", year: "2025", value: 0.6642 },
  { month: "12", year: "2025", value: 0.6751 },
  
  // 2026 - Valores oficiais confirmados ✅
  { month: "01", year: "2026", value: 0.6727 },
  { month: "02", year: "2026", value: 0.6213 },
  // ⚠️ Preenchido em 16/out/2026 (issue #115): a tabela tinha ficado parada
  // em fevereiro/2026 havia 7 meses -- todo caução devolvido depois disso
  // saía SEM NENHUMA correção (ex.: LEMOS APTO 10, pago em 19/03/2026:
  // devolução = exatamente o valor pago). Valores de março a setembro
  // obtidos da série 195 do Banco Central (SGS -- Sistema Gerenciador de
  // Séries Temporais, https://api.bcb.gov.br/dados/serie/bcdata.sgs.195),
  // usando o valor do dia 01 de cada mês -- mesma convenção que já batia
  // exata com os dois valores de 2026 acima (ambos conferidos contra a
  // série antes de confirmar a convenção).
  { month: "03", year: "2026", value: 0.6744 },
  { month: "04", year: "2026", value: 0.6687 },
  { month: "05", year: "2026", value: 0.6695 },
  { month: "06", year: "2026", value: 0.6718 },
  { month: "07", year: "2026", value: 0.6738 },
  { month: "08", year: "2026", value: 0.6701 },
  { month: "09", year: "2026", value: 0.6698 },
  // Outubro/2026 ainda não fechou (buscado em 16/out/2026) -- não entra
  // enquanto o mês não terminar, para não gravar um índice provisório.

  // Próximos meses: valor do dia 01 do mês em
  // https://api.bcb.gov.br/dados/serie/bcdata.sgs.195/dados/ultimos/5?formato=json
  // (ou https://www.vriconsulting.com.br/indices/poupanca.php, 2 primeiras
  // colunas) -- só depois que o mês fechar.
];

/** Mês/ano (MM/YYYY) do índice mais recente que a tabela conhece. Usado para
 *  avisar na tela quando uma correção precisou de um mês que ainda não foi
 *  cadastrado (issue #115) -- em vez de pular o mês em silêncio. */
export function ultimoIndicePoupancaConhecido(): string {
  const ultimo = POUPANCA_DATABASE[POUPANCA_DATABASE.length - 1];
  return `${ultimo.month}/${ultimo.year}`;
}

/**
 * Calcula o rendimento da poupança acumulado entre duas datas
 */
export function calculatePoupanca(startDate: string, endDate: string): {
  totalPercentage: number;
  months: number;
  details: Array<{ month: string; year: string; value: number }>;
  correctedAmount: (originalAmount: number) => number;
  /** Meses do período que a tabela não tinha (pulados do cálculo, issue #115). */
  mesesFaltando: string[];
  /** true quando algum mês do período ficou de fora por falta de índice --
   *  a tela deve avisar até que mês a correção foi aplicada de verdade. */
  correcaoIncompleta: boolean;
} {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  
  // Calcular meses incluindo tanto o mês inicial quanto o final
  const months = differenceInMonths(end, start) + 1;
  
  // Se for menos de 1 mês, não aplica correção
  if (months < 1) {
    console.log("⚠️ Período menor que 1 mês - SEM correção");
    return {
      totalPercentage: 0,
      months: 0,
      details: [],
      correctedAmount: (amount) => amount,
      mesesFaltando: [],
      correcaoIncompleta: false,
    };
  }
  
  console.log(`📊 Calculando Poupança: ${months} meses entre ${startDate} e ${endDate}`);
  
  const details: Array<{ month: string; year: string; value: number }> = [];
  const mesesFaltando: string[] = [];
  let accumulatedPercentage = 0;

  // Mês atual (de verdade, "hoje") -- um mês faltando que AINDA NÃO FECHOU
  // (o mês corrente) é esperado, não é a tabela desatualizada; só avisamos
  // quando falta um mês que já devia ter índice publicado (issue #115).
  const hoje = new Date();
  const mesAtualYYYYMM = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  
  // Calcular rendimento da poupança para cada mês do período
  const currentDate = new Date(start);
  
  // CORREÇÃO: Começar do mês do depósito (não pular o mês inicial)
  // Exemplo: Se depositou em 15/01/2024 e rescindiu em 15/06/2024, corrigir de jan até jun (6 meses)
  currentDate.setDate(1); // Sempre dia 1 para cálculo
  
  for (let i = 0; i < months; i++) {
    const monthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
    const yearStr = String(currentDate.getFullYear());
    
    const poupancaData = POUPANCA_DATABASE.find(
      (item) => item.month === monthStr && item.year === yearStr
    );
    
    if (poupancaData) {
      console.log(`  ✅ ${monthStr}/${yearStr}: ${poupancaData.value}%`);
      details.push({
        month: monthStr,
        year: yearStr,
        value: poupancaData.value,
      });
      
      // Fórmula de juros compostos: (1 + taxa1) * (1 + taxa2) - 1
      accumulatedPercentage = ((1 + accumulatedPercentage / 100) * (1 + poupancaData.value / 100) - 1) * 100;
    } else {
      console.warn(`  ⚠️ Taxa não encontrada para ${monthStr}/${yearStr} - pulando mês`);
      const esteYYYYMM = `${yearStr}-${monthStr}`;
      // Só conta como "tabela desatualizada" se o mês já fechou (é anterior
      // ao mês corrente). O mês atual nunca tem índice publicado ainda --
      // isso é normal, não um aviso para o usuário ver todo santo dia.
      if (esteYYYYMM < mesAtualYYYYMM) {
        mesesFaltando.push(`${monthStr}/${yearStr}`);
      }
    }
    
    // Avançar para o próximo mês
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  console.log(`📈 Poupança acumulada: ${accumulatedPercentage.toFixed(4)}%`);
  
  return {
    totalPercentage: Math.round(accumulatedPercentage * 10000) / 10000,
    months,
    details,
    correctedAmount: (originalAmount: number) => {
      const corrected = Math.round(originalAmount * (1 + accumulatedPercentage / 100) * 100) / 100;
      console.log(`💰 Valor original: R$ ${originalAmount.toFixed(2)} → Corrigido: R$ ${corrected.toFixed(2)}`);
      return corrected;
    },
    mesesFaltando,
    correcaoIncompleta: mesesFaltando.length > 0,
  };
}

/**
 * Formata os detalhes da poupança para exibição
 * Formato: MM/YYYY: 0,XXXX (uma taxa por linha)
 */
export function formatPoupancaDetails(details: Array<{ month: string; year: string; value: number }>): string {
  return details
    .map((item) => `${item.month}/${item.year}:\t${item.value.toFixed(4)}`)
    .join("\n");
}

/**
 * Calcula o valor corrigido do caução pela poupança
 */
export function calculateCorrectedDeposit(
  depositAmount: number,
  startDate: string,
  endDate: string
): {
  originalAmount: number;
  correctedAmount: number;
  poupancaPercentage: number;
  months: number;
  poupancaDetails: string;
  /** true quando o período passou do último mês que a tabela conhece --
   *  a correção parou nesse mês e a tela deve avisar (issue #115). */
  correcaoIncompleta: boolean;
  /** Mês/ano (MM/YYYY) do último índice usado no cálculo. */
  ultimoIndiceUsado: string;
} {
  console.log("💰 === CALCULANDO CORREÇÃO DO CAUÇÃO PELA POUPANÇA ===");
  console.log("Valor original:", depositAmount);
  console.log("Data início:", startDate);
  console.log("Data fim:", endDate);
  
  const poupancaData = calculatePoupanca(startDate, endDate);
  const correctedAmount = poupancaData.correctedAmount(depositAmount);
  
  console.log(`Meses de correção: ${poupancaData.months}`);
  console.log(`Poupança acumulada: ${poupancaData.totalPercentage}%`);
  console.log(`Valor corrigido: R$ ${correctedAmount.toFixed(2)}`);
  console.log("Detalhamento Poupança:");
  console.log(formatPoupancaDetails(poupancaData.details));
  console.log("💰 === FIM DO CÁLCULO ===");
  
  const ultimoDetalhe = poupancaData.details[poupancaData.details.length - 1];

  return {
    originalAmount: depositAmount,
    correctedAmount,
    poupancaPercentage: poupancaData.totalPercentage,
    months: poupancaData.months,
    poupancaDetails: formatPoupancaDetails(poupancaData.details),
    correcaoIncompleta: poupancaData.correcaoIncompleta,
    ultimoIndiceUsado: ultimoDetalhe
      ? `${ultimoDetalhe.month}/${ultimoDetalhe.year}`
      : ultimoIndicePoupancaConhecido(),
  };
}

// Manter compatibilidade com código antigo (alias)
export const calculateIGPM = calculatePoupanca;
export const formatIGPMDetails = formatPoupancaDetails;