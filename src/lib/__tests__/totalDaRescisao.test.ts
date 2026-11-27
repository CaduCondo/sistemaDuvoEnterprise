import { describe, expect, test } from "vitest";
import { sentidoDoTotalDaRescisao, textoDoSentido } from "../totalDaRescisao";

describe("sentido do total da rescisão (#53)", () => {
  test("negativo = a pagar ao inquilino (aluguel 1.500 + rescisão -2.000 = -500)", () => {
    expect(sentidoDoTotalDaRescisao(1500 + -2000)).toBe("pagar_ao_inquilino");
    expect(textoDoSentido(-500)).toMatch(/A pagar ao inquilino/);
  });

  test("positivo = a receber do inquilino (aluguel 2.000 + rescisão -500 = 1.500)", () => {
    expect(sentidoDoTotalDaRescisao(2000 + -500)).toBe("receber_do_inquilino");
    expect(textoDoSentido(1500)).toMatch(/A receber do inquilino/);
  });

  test("zero (ou diferença de centavos de arredondamento) = nada a pagar", () => {
    expect(sentidoDoTotalDaRescisao(0)).toBe("nada");
    expect(sentidoDoTotalDaRescisao(0.004)).toBe("nada");
    expect(sentidoDoTotalDaRescisao(-0.004)).toBe("nada");
    expect(textoDoSentido(0)).toMatch(/Nada a pagar/);
  });
});
