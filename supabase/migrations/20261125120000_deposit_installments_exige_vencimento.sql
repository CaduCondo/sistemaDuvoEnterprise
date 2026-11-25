-- Issue #112: parcela de caucao nunca pode ficar sem data de vencimento.
-- Em producao existe 1 parcela antiga assim (origem desconhecida; o codigo de
-- criacao usava depositInstallment2DueDate! e podia mandar vazio). Nao da para
-- usar NOT NULL/CHECK agora sem mexer nessa parcela (dado real: nao alteramos),
-- entao a trava e um gatilho:
--   * INSERT sem vencimento: sempre barrado;
--   * UPDATE que APAGA um vencimento que existia: barrado;
--   * UPDATE de parcela antiga que ja estava sem vencimento: permitido
--     (senao ela nao poderia mais ser paga/editada).

CREATE OR REPLACE FUNCTION public.exigir_vencimento_parcela_caucao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.due_date IS NULL AND (TG_OP = 'INSERT' OR OLD.due_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Parcela de caucao sem data de vencimento nao e permitida (issue #112)'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exigir_vencimento_parcela_caucao ON public.deposit_installments;
CREATE TRIGGER trg_exigir_vencimento_parcela_caucao
  BEFORE INSERT OR UPDATE ON public.deposit_installments
  FOR EACH ROW EXECUTE FUNCTION public.exigir_vencimento_parcela_caucao();
