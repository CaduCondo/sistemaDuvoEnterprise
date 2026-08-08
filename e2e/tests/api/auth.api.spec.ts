/**
 * ⚠️ DEPRECADO (2026-08) — este arquivo testava endpoints
 * `/api/auth/login`, `/api/auth/forgot-password` e `/api/auth/change-password`
 * que **nunca existiram** no código do sistema. Confirmado por busca
 * exaustiva em `src/pages/api/**` e por grep de `/api/auth` em todo `src/`:
 * zero resultados.
 *
 * A autenticação real é 100% client-side, via chamadas diretas ao Supabase
 * a partir de `src/services/authService.ts` (chamado por `src/lib/auth.ts`,
 * usado em `src/components/public/PublicHeader.tsx`) — não existe uma rota
 * REST própria para login/troca de senha. Além disso, o arquivo usava
 * `baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL`, então mesmo com os
 * endpoints existindo as chamadas iriam para o projeto Supabase, não para o
 * Next.js — daí os 401/404 sistemáticos vistos na execução de 2026-08.
 *
 * A cobertura real desses fluxos já existe via UI:
 * - e2e/tests/auth/login-dropdown.spec.ts, tests/ui/login.spec.ts
 * - e2e/tests/auth/three-attempts.spec.ts (bloqueio por tentativas)
 * - e2e/tests/auth/password-recovery.spec.ts (esqueci minha senha)
 * - e2e/tests/auth/password-change-required.spec.ts (troca obrigatória)
 * - e2e/features/1-autenticacao.feature (BDD)
 *
 * Se o sistema ganhar endpoints REST de autenticação no futuro, este
 * arquivo pode ser reescrito para testá-los de verdade. Até lá, mantido
 * vazio (sem `test()`) de propósito.
 */
