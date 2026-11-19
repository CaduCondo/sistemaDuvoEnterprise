// Lista de bancos (código + nome) para o cadastro do locador (15/nov/2026).
//
// A lista completa vem da BrasilAPI (https://brasilapi.com.br/api/banks/v1),
// carregada uma vez e guardada em memória. Se a internet/API falhar, usamos
// só a lista abaixo, com os bancos e fintechs mais comuns.
//
// Formato guardado no banco e mostrado no contrato: "0341 - Itaú Unibanco"
// (código com 4 dígitos, hífen, nome). Ordem do combo: pelo número.

export interface Banco {
  codigo: string; // 4 dígitos, ex.: "0341"
  nome: string;
}

const PRINCIPAIS: [number, string][] = [
  [1, "Banco do Brasil"],
  [3, "Banco da Amazônia"],
  [4, "Banco do Nordeste"],
  [21, "Banestes"],
  [33, "Santander"],
  [37, "Banpará"],
  [41, "Banrisul"],
  [47, "Banese"],
  [70, "BRB - Banco de Brasília"],
  [77, "Banco Inter"],
  [79, "PicPay Bank"],
  [104, "Caixa Econômica Federal"],
  [121, "Agibank"],
  [133, "Cresol"],
  [136, "Unicred"],
  [197, "Stone Pagamentos"],
  [208, "BTG Pactual"],
  [212, "Banco Original"],
  [218, "Banco BS2"],
  [237, "Bradesco"],
  [260, "Nubank (Nu Pagamentos)"],
  [290, "PagBank (PagSeguro)"],
  [323, "Mercado Pago"],
  [336, "C6 Bank"],
  [341, "Itaú Unibanco"],
  [380, "PicPay"],
  [403, "Cora"],
  [422, "Banco Safra"],
  [623, "Banco Pan"],
  [633, "Banco Rendimento"],
  [637, "Banco Sofisa"],
  [655, "Banco Votorantim (BV)"],
  [739, "Banco Cetelem"],
  [741, "Banco Ribeirão Preto"],
  [745, "Citibank"],
  [746, "Banco Modal"],
  [748, "Sicredi"],
  [756, "Sicoob"],
];

export const codigoComQuatroDigitos = (n: number | string): string => String(n).padStart(4, "0");

export const BANCOS_PRINCIPAIS: Banco[] = PRINCIPAIS.map(([c, nome]) => ({
  codigo: codigoComQuatroDigitos(c),
  nome,
}));

/** "0341 - Itaú Unibanco" */
export const rotuloDoBanco = (b: Banco): string => `${b.codigo} - ${b.nome}`;

function organizar(lista: Banco[]): Banco[] {
  // O nome da nossa lista curada vale mais que o da API (que vem em MAIÚSCULAS abreviadas).
  const porCodigo = new Map<string, Banco>();
  for (const b of lista) porCodigo.set(b.codigo, b);
  for (const b of BANCOS_PRINCIPAIS) porCodigo.set(b.codigo, b);
  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

let emMemoria: Promise<Banco[]> | null = null;

export function carregarBancos(): Promise<Banco[]> {
  if (!emMemoria) {
    emMemoria = (async () => {
      try {
        const r = await fetch("https://brasilapi.com.br/api/banks/v1");
        if (!r.ok) throw new Error(String(r.status));
        const dados: { code: number | null; name?: string; fullName?: string }[] = await r.json();
        const daApi: Banco[] = dados
          .filter((d) => d.code !== null && d.code !== undefined && d.code > 0)
          .map((d) => ({
            codigo: codigoComQuatroDigitos(d.code as number),
            nome: (d.fullName || d.name || "").replace(/\s+/g, " ").trim(),
          }))
          .filter((b) => b.nome);
        return organizar(daApi);
      } catch {
        emMemoria = null; // tenta de novo na próxima vez
        return organizar([]);
      }
    })();
  }
  return emMemoria;
}
