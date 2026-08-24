# Comandos de Testes E2E

## ⚡ Os comandos do dia a dia (23/ago/2026 em diante)

```bash
npm run test:smoke      # a suíte rápida: compila se precisar, sobe a aplicação,
                        # roda os cenários marcados com @smoke em paralelo e
                        # derruba a aplicação no fim. É o que roda a cada push.

npm run test:bdd:smoke  # só os cenários @smoke, com a aplicação já rodando

npm run test:bdd        # a suíte BDD completa (demorada, hoje manual)
npm run test:e2e        # a suíte Playwright completa (demorada, hoje manual)
```

Rodar um cenário específico pelo nome:

```bash
npx cucumber-js --config e2e/cucumber.config.cjs --name "parte do nome do cenário"
```

Ver [SMOKE.md](./SMOKE.md) para entender o que a marca `@smoke` decide e como
religar a suíte antiga aos poucos.

---

> ℹ️ Este arquivo foi consolidado em 2026-08 para evitar duplicidade/divergência com `e2e/GUIA_RAPIDO.md` e `e2e/README.md` (continha comandos de scripts que não existem no `package.json`, como `test:setup` e `test:smoke`, e referências ao antigo fluxo "Softgen").
>
> - Setup rápido e primeiros passos: ver **`e2e/GUIA_RAPIDO.md`**
> - Referência completa (estrutura, cobertura de testes, tags, troubleshooting, CI): ver **`e2e/README.md`**

## Comandos essenciais

```bash
npm install                 # instalar dependências
npx playwright install      # instalar browsers do Playwright

npm run test:e2e:ui         # Playwright — interface visual
npm run test:e2e            # Playwright — headless
npm run test:e2e:headed     # Playwright — navegador visível
npm run test:e2e:debug      # Playwright — passo a passo

npm run test:bdd            # Cucumber/BDD — todos os cenários
npm run test:bdd:dry        # Cucumber/BDD — dry-run (valida steps sem abrir navegador)
```

Todos os outros comandos (por tag, por arquivo, por projeto, relatórios) estão documentados em `e2e/README.md`.
