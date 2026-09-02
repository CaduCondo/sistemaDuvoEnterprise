/**
 * ⚠️ DEPRECADO — mas não pelo motivo que este comentário dizia até
 * 01/set/2026.
 *
 * Este arquivo testava endpoints `/api/auth/login`, `/api/auth/forgot-password`
 * e `/api/auth/change-password` que, quando escrito (2026-08), realmente não
 * existiam. **Isso mudou em 30/ago/2026**: `src/pages/api/auth/login.ts`
 * agora existe de verdade — o login passou a acontecer no servidor
 * (a rota valida usuário/senha, conta tentativas erradas e bloqueia por 30min,
 * ver o comentário no topo daquele arquivo para o motivo).
 *
 * Ou seja, o endpoint que este arquivo tentava testar **existe hoje**. Ele
 * continua deprecado (sem `test()`) não por não existir, mas porque a
 * cobertura real já está em outro lugar, testando a rota de verdade:
 * - e2e/features/1-autenticacao.feature, cenários `@seguranca` (fala
 *   diretamente com `/api/auth/login` — ver
 *   e2e/step-definitions/auth-servidor.steps.ts)
 * - e2e/tests/auth/login-dropdown.spec.ts, tests/ui/login.spec.ts (fluxo via tela)
 * - e2e/tests/auth/three-attempts.spec.ts (bloqueio por tentativas via tela)
 * - e2e/tests/auth/password-recovery.spec.ts (esqueci minha senha)
 * - e2e/tests/auth/password-change-required.spec.ts (troca obrigatória)
 *
 * Se algum dia fizer sentido ter um spec de API dedicado para
 * `/api/auth/login` (em vez de cobrir só via BDD), este arquivo é o lugar
 * óbvio para reescrever. Até lá, mantido vazio (sem `test()`) de propósito,
 * para não duplicar a cobertura que já existe.
 */
