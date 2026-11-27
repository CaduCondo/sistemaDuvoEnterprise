import { describe, expect, test } from "vitest";
import { chaveDaLinha, deveSalvarPix, linhaEstaEmEdicao } from "../edicaoPix";

// Issue #138: um recebimento pago em 2 partes aparece em 2 linhas com o MESMO id.
// A edição do Código PIX precisa ser por LINHA, e só salvar quando o valor mudou.
const linha1 = { id: "pagamento-1", _rowKey: "pagamento-1:0" };
const linha2 = { id: "pagamento-1", _rowKey: "pagamento-1:1" };
const outroRecebimento = { id: "pagamento-2" }; // sem _rowKey (1 linha só)

describe("edição do Código PIX por linha (#138)", () => {
  test("a chave da linha é o _rowKey quando existe; senão o id", () => {
    expect(chaveDaLinha(linha1)).toBe("pagamento-1:0");
    expect(chaveDaLinha(linha2)).toBe("pagamento-1:1");
    expect(chaveDaLinha(outroRecebimento)).toBe("pagamento-2");
  });

  test("duas linhas do MESMO recebimento: só a clicada fica em edição (o defeito era as duas)", () => {
    const celula = { rowKey: chaveDaLinha(linha2), id: "pagamento-1" };
    expect(linhaEstaEmEdicao(celula, linha1)).toBe(false);
    expect(linhaEstaEmEdicao(celula, linha2)).toBe(true);
    expect(linhaEstaEmEdicao(celula, outroRecebimento)).toBe(false);
  });

  test("sem célula em edição, nenhuma linha está em edição", () => {
    expect(linhaEstaEmEdicao(null, linha1)).toBe(false);
  });

  test("recebimento de 1 linha só continua funcionando", () => {
    const celula = { rowKey: chaveDaLinha(outroRecebimento), id: "pagamento-2" };
    expect(linhaEstaEmEdicao(celula, outroRecebimento)).toBe(true);
  });

  test("só salva quando o valor mudou (clicar e sair sem digitar NÃO salva)", () => {
    expect(deveSalvarPix("", "")).toBe(false);
    expect(deveSalvarPix(null, "")).toBe(false);
    expect(deveSalvarPix(undefined, "   ")).toBe(false);
    expect(deveSalvarPix("ABC", "ABC")).toBe(false);
    expect(deveSalvarPix("ABC", "  ABC ")).toBe(false);
  });

  test("salva quando digitou algo novo, e também quando apagou o que existia", () => {
    expect(deveSalvarPix("", "PIX-ABC-123")).toBe(true);
    expect(deveSalvarPix(null, "X")).toBe(true);
    expect(deveSalvarPix("ABC", "ABD")).toBe(true);
    expect(deveSalvarPix("ABC", "")).toBe(true);
  });
});
