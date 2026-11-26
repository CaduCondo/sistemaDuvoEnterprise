import { afterEach, describe, expect, test, vi } from "vitest";
import { idDoUsuarioLogado } from "../client";

// Issue #54: o id do usuário logado é lido do localStorage ("auth_user") e vai no
// cabeçalho x-sistema-user-id de toda chamada ao banco.
function simularNavegador(valor: string | null) {
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => (k === "auth_user" ? valor : null) } });
}

afterEach(() => vi.unstubAllGlobals());

describe("idDoUsuarioLogado (#54)", () => {
  test("devolve o id do usuário guardado no login", () => {
    simularNavegador(JSON.stringify({ id: "11111111-2222-3333-4444-555555555555", name: "Cadu" }));
    expect(idDoUsuarioLogado()).toBe("11111111-2222-3333-4444-555555555555");
  });

  test("sem usuário logado devolve null (página pública continua funcionando)", () => {
    simularNavegador(null);
    expect(idDoUsuarioLogado()).toBeNull();
  });

  test("valores estranhos nunca derrubam a chamada: devolvem null", () => {
    for (const ruim of ["não é json", "{}", JSON.stringify({ id: 123 }), JSON.stringify({ id: "" }), "null"]) {
      simularNavegador(ruim);
      expect(idDoUsuarioLogado()).toBeNull();
    }
  });

  test("fora do navegador (servidor) devolve null", () => {
    vi.stubGlobal("window", undefined);
    expect(idDoUsuarioLogado()).toBeNull();
  });
});
