-- ============================================================================
-- validate_payment_status(): alinhar DEV e PROD, preservando o comportamento
-- que roda em PRODUÇÃO hoje
--
-- ⚠️ ESTA MIGRATION SUBSTITUI A 20260825200000. Rodar esta nos DOIS ambientes.
--
-- O QUE ACONTECEU
--
-- Ao conferir o corpo real da função em produção (pg_get_functiondef, em
-- 26/ago/2026) descobriu-se que ela é DIFERENTE tanto do arquivo de migration
-- original (20260216223935) quanto da versão que a 20260825200000 gravou em
-- DEV. Três versões da mesma função, em três lugares:
--
--   arquivo 20260216223935   chama calculate_correct_payment_status(),
--                            e usa NEW.discount -- coluna que NUNCA existiu.
--                            Este arquivo está morto: nunca poderia ter
--                            funcionado como está escrito.
--
--   DEV (após 20260825200000) chama calculate_correct_payment_status(), que
--                            força 'paid', 'partial' E 'pending'.
--
--   PRODUÇÃO                 lógica inline, sem função auxiliar, e só força
--                            'paid' quando o restante é ~zero. Quando não é,
--                            NÃO mexe no status.
--
-- A diferença não é cosmética: em produção o trigger só intervém para marcar
-- como pago; em DEV ele reescrevia o status em qualquer situação. Testar em
-- DEV e subir para PROD com essa divergência é testar outro sistema.
--
-- DECISÃO: vale o comportamento de PRODUÇÃO, que é o que atende os usuários
-- reais há meses. DEV passa a ser igual a ele.
--
-- A única coisa acrescentada é o desvio do Recebimento de Rescisão: ele nasce
-- legitimamente ZERADO (enquanto o caução não foi pago e ninguém digitou
-- Despesas/Desconto), e o trigger lia esse zero como "quitado", cravando
-- 'paid' inclusive por cima do 'pending' que o cancelamento acabara de gravar
-- -- um laço sem saída pela tela. Quem decide se a rescisão foi acertada é o
-- usuário, não a aritmética.
--
-- Recebimentos de aluguel: comportamento IDÊNTICO ao de produção hoje.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_expected NUMERIC;
  remaining NUMERIC;
BEGIN
  -- ⚠️ Recebimento de Rescisão (#49): o status é da aplicação, não do
  -- trigger. Ver o cabeçalho desta migration.
  IF NEW.payment_kind = 'termination' THEN
    RETURN NEW;
  END IF;

  -- Daqui para baixo: exatamente o que já roda em produção.

  -- Calcular o total esperado (Valor Base + Multa + Juros - Desconto)
  -- Usando COALESCE para garantir que nulos sejam tratados como zero
  total_expected := COALESCE(NEW.expected_amount, 0) + 
                    COALESCE(NEW.late_fee, 0) + 
                    COALESCE(NEW.interest, 0) - 
                    COALESCE(NEW.discount_amount, 0);

  -- Calcular o valor restante
  remaining := total_expected - COALESCE(NEW.paid_amount, 0);

  -- Se a diferença for insignificante (<= 0.05), forçar status para 'paid'
  -- Isso evita o problema de status 'partial' com valor restante zerado
  IF ABS(remaining) <= 0.05 THEN
    NEW.status := 'paid';
  END IF;

  RETURN NEW;
END;
$function$;

-- Devolve para "Pendente" os Recebimentos de Rescisão que o trigger já tinha
-- marcado como pagos sem ninguém ter pago nada. Em produção não há nenhum
-- ainda (a #49 nunca rodou lá) -- o UPDATE simplesmente não acha linha.
UPDATE public.payments
   SET status = 'pending'
 WHERE payment_kind = 'termination'
   AND status = 'paid'
   AND COALESCE(paid_amount, 0) = 0
   AND payment_date IS NULL;

-- Conferência: o corpo agora tem o desvio da rescisão E a lógica inline de
-- produção (sem chamar calculate_correct_payment_status).
SELECT pg_get_functiondef('validate_payment_status()'::regprocedure);
