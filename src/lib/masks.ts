// Currency formatting with thousands separator
export const formatCurrency = (value: string | number): string => {
  const numValue = typeof value === "string" ? parseFloat(value.replace(/[^\d,-]/g, "").replace(",", ".")) : value;
  
  // Handle null, undefined, or NaN
  if (value === null || value === undefined || isNaN(numValue)) return "R$ 0,00";
  
  // Preserve negative sign
  const isNegative = numValue < 0;
  const absoluteValue = Math.abs(numValue);
  
  // Format with thousands separator (.) and decimal separator (,)
  const formatted = absoluteValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return isNegative ? `- R$ ${formatted}` : `R$ ${formatted}`;
};

export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  // ✅ CORREÇÃO: o regex não deixava passar o sinal de "-", então um valor
  // negativo digitado/exibido (ex: recebimento de rescisão em que o Duvo
  // devolve dinheiro ao inquilino) virava positivo ao salvar. Isso fazia o
  // "Registrar Recebimento" gravar o valor errado (positivo) no banco.
  return parseFloat(value.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
};

export const applyRealMask = (value: string): string => {
  if (!value) return "";
  
  // Remove tudo exceto números
  const numbers = value.replace(/\D/g, "");
  
  // Converte para número e formata
  const amount = parseFloat(numbers) / 100;
  
  if (isNaN(amount)) return "";
  
  return `R$ ${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const numberToWords = (value: number): string => {
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (value === 0) return "zero";
  if (value === 100) return "cem";

  let result = "";
  const integerPart = Math.floor(value);
  const decimalPart = Math.round((value - integerPart) * 100);

  // Processar parte inteira
  if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    if (thousands === 1) {
      result += "mil";
    } else {
      result += numberToWords(thousands) + " mil";
    }
    const remainder = integerPart % 1000;
    if (remainder > 0) {
      result += " " + (remainder < 100 ? "e " : "") + numberToWords(remainder);
    }
  } else {
    // Centenas
    if (integerPart >= 100) {
      result += hundreds[Math.floor(integerPart / 100)];
      const remainder = integerPart % 100;
      if (remainder > 0) {
        result += " e " + numberToWords(remainder);
      }
    } else if (integerPart >= 20) {
      // Dezenas
      result += tens[Math.floor(integerPart / 10)];
      const remainder = integerPart % 10;
      if (remainder > 0) {
        result += " e " + units[remainder];
      }
    } else if (integerPart >= 10) {
      // Teens
      result += teens[integerPart - 10];
    } else if (integerPart > 0) {
      // Unidades
      result += units[integerPart];
    }
  }

  result += integerPart === 1 ? " real" : " reais";

  // Processar parte decimal
  if (decimalPart > 0) {
    result += " e ";
    if (decimalPart >= 20) {
      result += tens[Math.floor(decimalPart / 10)];
      const remainder = decimalPart % 10;
      if (remainder > 0) {
        result += " e " + units[remainder];
      }
    } else if (decimalPart >= 10) {
      result += teens[decimalPart - 10];
    } else {
      result += units[decimalPart];
    }
    result += decimalPart === 1 ? " centavo" : " centavos";
  }

  return result;
};

// CPF formatting
export const applyCpfMask = (value: string): string => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

// RG formatting
export const applyRgMask = (value: string): string => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1})$/, "$1-$2");
};

// Phone formatting
export const applyPhoneMask = (value: string): string => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
};

// CEP formatting
export const applyCepMask = (value: string): string => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  
  if (value.length <= 5) return value;
  return `${value.slice(0, 5)}-${value.slice(5, 8)}`;
};

// CNPJ Mask
export const applyCnpjMask = (value: string): string => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  
  if (value.length <= 2) return value;
  if (value.length <= 5) return `${value.slice(0, 2)}.${value.slice(2)}`;
  if (value.length <= 8) return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5)}`;
  if (value.length <= 12) return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8)}`;
  return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12, 14)}`;
};

// Date Formatting
export const formatDate = (date: string | Date): string => {
  if (!date) return "";
  
  // Se for objeto Date, usa formatação padrão
  if (date instanceof Date) {
    return date.toLocaleDateString("pt-BR");
  }
  
  // Se for string
  if (typeof date === "string") {
    // Se for formato YYYY-MM-DD simples (comum em inputs e datas do banco)
    // Fazemos parse manual para evitar problemas de timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split("-");
      return `${day}/${month}/${year}`;
    }
    
    // Para outros formatos (ISO com hora, etc), fallback para Date
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR");
    }
  }
  
  return "";
};

// Address fetch stub
export const fetchAddressByCEP = async (cep: string): Promise<any> => {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();
    if (data.erro) return null;
    return data;
  } catch (error) {
    console.error("Error fetching CEP", error);
    return null;
  }
};

export const formatCurrencyInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  const amount = parseFloat(numbers) / 100;
  if (isNaN(amount)) return "";
  return `R$ ${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Helpers & Aliases
export const formatCPF = applyCpfMask;
export const formatCNPJ = applyCnpjMask;
export const formatPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d)(\d{4})$/, "$1-$2")
    .substring(0, 15);
};

export const unformatCPF = (value: string) => value.replace(/\D/g, "");
export const unformatCNPJ = (value: string) => value.replace(/\D/g, "");
export const unformatPhone = (value: string) => value.replace(/\D/g, "");

export const unformatCurrency = (value: string): number => {
  if (!value) return 0;
  return Number(value.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
};

// Compatibility aliases
export const maskCurrency = applyRealMask;
export const applyCurrencyMask = applyRealMask;
export const parseCurrencyToNumber = parseCurrency;
export const maskCEP = applyCepMask;
export const maskCPF = applyCpfMask;
export const maskPhone = applyPhoneMask;
export const maskCNPJ = applyCnpjMask;

export const unformatCep = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, 8);
};

// Money mask for input fields - INCREMENTAL (para digitação)
export const applyMoneyMask = (value: string): string => {
  if (!value) return "";
  
  // Remove tudo exceto números
  const numbers = value.replace(/\D/g, "");
  
  // Converte para número e formata (divide por 100 pois está em centavos)
  const amount = parseFloat(numbers) / 100;
  
  if (isNaN(amount)) return "";
  
  return `R$ ${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Format money value for DISPLAY (não divide por 100 - valor já está correto)
export const formatMoneyForDisplay = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";
  
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Parse money mask to number (para salvar no banco)
export const parseMoneyMaskToNumber = (value: string): number => {
  if (!value) return 0;
  
  // Remove R$, espaços, pontos (separador de milhar) e substitui vírgula por ponto
  const cleanValue = value
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  
  return parseFloat(cleanValue) || 0;
};

// Remove all masks from string (keep only numbers)
export const removeMask = (value: string): string => {
  return value.replace(/\D/g, "");
};

// Parse currency string to float (handles Brazilian format: 1.534,95 -> 1534.95)
export const parseCurrencyToFloat = (value: string): number => {
  if (!value) return 0;
  
  // Remove currency symbol and spaces
  let cleanValue = value.replace(/[R$\s]/g, "");
  
  // Replace dots (thousand separator) with nothing
  cleanValue = cleanValue.replace(/\./g, "");
  
  // Replace comma (decimal separator) with dot
  cleanValue = cleanValue.replace(/,/g, ".");
  
  // Parse to float
  const numValue = parseFloat(cleanValue);
  
  return isNaN(numValue) ? 0 : numValue;
};

// Apply percentage mask with 3 decimal places (ex: 2,125%)
export const applyPercentageMask = (value: string): string => {
  if (!value) return "";
  
  // Remove tudo exceto números e vírgula
  let numbers = value.replace(/[^\d,]/g, "");
  
  // Remove vírgulas duplicadas
  const parts = numbers.split(",");
  if (parts.length > 2) {
    numbers = parts[0] + "," + parts.slice(1).join("");
  }
  
  // Limitar casas decimais a 3
  if (parts.length === 2 && parts[1].length > 3) {
    numbers = parts[0] + "," + parts[1].substring(0, 3);
  }
  
  return numbers;
};

// Parse percentage string to float (handles Brazilian format: 2,125 -> 2.125)
export const parsePercentageToFloat = (value: string): number => {
  if (!value) return 0;
  const cleanValue = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleanValue) || 0;
};

// Format number to percentage with 3 decimal places (ex: 2.125 -> "2,125")
export const formatPercentage = (value: number): string => {
  if (value === null || value === undefined || isNaN(value)) return "0";
  
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

export const maskTime = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  
  if (numbers.length === 0) return "";
  if (numbers.length <= 2) {
    const hour = Math.min(parseInt(numbers), 23);
    return String(hour).padStart(numbers.length, "0");
  }
  
  const hour = Math.min(parseInt(numbers.substring(0, 2)), 23);
  const minute = Math.min(parseInt(numbers.substring(2, 4)), 59);
  
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};