# Comandos de Testes E2E

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
