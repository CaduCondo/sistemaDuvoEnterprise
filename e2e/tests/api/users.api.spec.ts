/**
 * ⚠️ DEPRECADO — mas não pelo motivo que este comentário dizia até
 * 01/set/2026.
 *
 * Este arquivo testava endpoints REST `/api/users`, `/api/users/:id`,
 * `/api/users/:id/reset-password` que, quando escrito (2026-08), realmente
 * não existiam. **Isso mudou**: a gestão de usuários (criar/editar/excluir,
 * trocar senha, desbloquear) passou para rotas do servidor, com a chave
 * secreta do Supabase — mesma causa raiz e mesma correção do login (ver
 * comentário em `e2e/tests/api/auth.api.spec.ts`). As rotas que existem hoje:
 * - `src/pages/api/users/index.ts` (listar/criar)
 * - `src/pages/api/users/[id].ts` (editar/excluir)
 * - `src/pages/api/users/[id]/change-password.ts`
 * - `src/pages/api/users/[id]/reset-password.ts`
 * - `src/pages/api/users/[id]/unblock.ts`
 *
 * Ou seja, os endpoints que este arquivo tentava testar **existem hoje**.
 * Ele continua deprecado (sem `test()`) não por não existir, mas porque a
 * cobertura real já está em outro lugar, testando as rotas de verdade:
 * - e2e/features/1-autenticacao.feature, cenários `@seguranca` de gestão de
 *   usuário (fala diretamente com `/api/users/*` — ver
 *   e2e/step-definitions/usuarios-servidor.steps.ts)
 * - e2e/tests/users/users-management.spec.ts (fluxo via tela)
 *
 * Se algum dia fizer sentido ter um spec de API dedicado para `/api/users/*`
 * (em vez de cobrir só via BDD), este arquivo é o lugar óbvio para
 * reescrever. Até lá, mantido vazio (sem `test()`) de propósito, para não
 * duplicar a cobertura que já existe.
 */
