import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Testes unitários (contas puras, sem navegador nem banco).
 * Rodar: npm test
 * Os testes de tela (BDD) continuam em e2e/ e não passam por aqui.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Endereço falso: os testes unitários nunca falam com o banco, mas
    // alguns arquivos criam o cliente do Supabase só por serem importados.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave-falsa-de-teste",
    },
  },
});
