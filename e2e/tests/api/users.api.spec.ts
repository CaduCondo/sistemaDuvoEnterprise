/**
 * ⚠️ DEPRECADO (2026-08) — este arquivo testava endpoints REST
 * `/api/users`, `/api/users/:id`, `/api/users/:id/reset-password` que
 * **nunca existiram** no código do sistema. Confirmado por busca exaustiva
 * em `src/pages/api/**` (só existem `/api/health`, `/api/properties`,
 * `/api/reset-password`, `/api/send-password-recovery`,
 * `/api/send-welcome-email`, `/api/role-menu-permissions`,
 * `/api/generate-deposit-installments`, `/api/upload`) e por grep de
 * `/api/users` em todo `src/`: zero resultados.
 *
 * A gestão de usuários é 100% client-side, via chamadas diretas ao Supabase
 * a partir de `src/hooks/useUsers.ts` e `src/services/systemUserService.ts`
 * (usados por `src/pages/settings.tsx` → `src/components/settings/UsersTab.tsx`)
 * — não existe uma rota REST própria de CRUD de usuários. Além disso, o
 * arquivo usava `baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL` (URL do
 * Supabase, não do Next.js) e um `authToken` vindo de `/api/auth/login`
 * (também inexistente), então nada aqui jamais teve chance de funcionar.
 *
 * A cobertura real de CRUD de usuários existe via UI em
 * e2e/tests/users/users-management.spec.ts.
 *
 * Se o sistema ganhar uma API REST de usuários no futuro, este arquivo pode
 * ser reescrito para testá-la de verdade. Até lá, mantido vazio (sem
 * `test()`) de propósito.
 */
