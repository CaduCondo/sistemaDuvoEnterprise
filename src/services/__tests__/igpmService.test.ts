import { afterEach, vi } from "vitest";
import { calculatePoupanca, ultimoIndicePoupancaConhecido } from "../igpmService";

// Issue #115: a tabela da poupança não pode ficar parada. Valores esperados
// calculados à mão (python, juros compostos dos índices do dia 01 da série 195
// do Banco Central) -- não copiados do que o código devolve.
describe("calculatePoupanca (#115)", () => {
  test("caução de R$ 3.400,00 pago em 19/03/2026, corrigido até set/2026 (7 meses: mar a set)", () => {
    const r = calculatePoupanca("2026-03-19", "2026-09-19");
    expect(r.months).toBe(7);
    expect(r.totalPercentage).toBeCloseTo(4.7938, 4);
    expect(r.correctedAmount(3400)).toBeCloseTo(3562.99, 2);
    expect(r.correcaoIncompleta).toBe(false);
    expect(r.mesesFaltando).toEqual([]);
  });

  test("incluindo outubro/2026 (mar a out): 8 meses", () => {
    const r = calculatePoupanca("2026-03-19", "2026-10-19");
    expect(r.months).toBe(8);
    expect(r.totalPercentage).toBeCloseTo(5.4879, 4);
    expect(r.correctedAmount(3400)).toBeCloseTo(3586.59, 2);
  });

  test("antes da correção, a devolução NÃO é igual ao valor pago (o sintoma da #115)", () => {
    const r = calculatePoupanca("2026-03-19", "2027-03-19");
    expect(r.correctedAmount(3400)).toBeGreaterThan(3400);
  });

  afterEach(() => vi.useRealTimers());

  test("mês que já fechou e não tem índice é avisado (não é pulado em silêncio)", () => {
    // "Hoje" simulado em jun/2030: jan a mar/2030 já fecharam e a tabela não os tem.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-15T12:00:00"));
    const r = calculatePoupanca("2030-01-10", "2030-03-10");
    expect(r.correcaoIncompleta).toBe(true);
    expect(r.mesesFaltando).toEqual(["01/2030", "02/2030", "03/2030"]);
  });

  test("mês corrente sem índice NÃO gera aviso (ainda não fechou)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-03-15T12:00:00"));
    const r = calculatePoupanca("2030-03-01", "2030-03-20");
    expect(r.correcaoIncompleta).toBe(false);
  });

  test("mesmo mês conta 1 mês de correção (regra: inclui o mês inicial e o final): mai/2026 = 0,6695%", () => {
    const r = calculatePoupanca("2026-05-10", "2026-05-25");
    expect(r.months).toBe(1);
    expect(r.correctedAmount(1000)).toBeCloseTo(1006.7, 2);
  });
});

// LEMBRETE AUTOMÁTICO: este teste fica vermelho quando um mês já fechou há mais
// de 5 dias e a tabela ainda não tem o índice dele. Para consertar: pegue o valor
// do dia 01 em https://api.bcb.gov.br/dados/serie/bcdata.sgs.195/dados/ultimos/5?formato=json
// e acrescente em POUPANCA_DATABASE (src/services/igpmService.ts).
describe("tabela da poupança está em dia (#115)", () => {
  test("tem o índice do último mês fechado (com 5 dias de folga)", () => {
    const hoje = new Date();
    // Data de referência: 5 dias atrás; o "último mês fechado" é o anterior ao mês dessa data.
    const ref = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 5);
    const esperado = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const esperadoMMYYYY = `${String(esperado.getMonth() + 1).padStart(2, "0")}/${esperado.getFullYear()}`;
    const [mm, yyyy] = ultimoIndicePoupancaConhecido().split("/");
    const conhecido = new Date(Number(yyyy), Number(mm) - 1, 1);
    expect(
      conhecido >= esperado,
      `A tabela da poupança está parada em ${mm}/${yyyy}, mas já devia ter ${esperadoMMYYYY}. Atualize POUPANCA_DATABASE em src/services/igpmService.ts (instruções no comentário deste teste).`
    ).toBe(true);
  });
});
