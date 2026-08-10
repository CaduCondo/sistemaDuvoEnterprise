-- Corrige retroativamente o texto da 1ª parcela proporcional nos recebimentos
-- já existentes: "Aluguel - Parcela N (X dias)" -> "Aluguel - Proporcional de X dia(s)"
-- e "Garagem (X dias)" -> "Garagem - Proporcional de X dia(s)".
-- Quando X = 30 (não é realmente proporcional, é mês cheio), normaliza para
-- só "Aluguel"/"Garagem", igual o código novo já gera.
--
-- Só mexe no TEXTO da descrição dentro do breakdown (JSONB) — não altera
-- nenhum valor (amount) nem expected_amount. Seguro de rodar em qualquer
-- ambiente (DEV e PROD).

UPDATE payments
SET breakdown = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'description' ~ '^Aluguel - Parcela \d+ \(\d+ dias?\)$' THEN
        CASE
          WHEN substring(elem->>'description' from '\((\d+) dias?\)') = '30'
            THEN jsonb_set(elem, '{description}', '"Aluguel"')
          ELSE jsonb_set(
            elem,
            '{description}',
            to_jsonb('Aluguel - Proporcional de ' || substring(elem->>'description' from '\((\d+) dias?\)') || ' dia(s)')
          )
        END
      WHEN elem->>'description' ~ '^Garagem \(\d+ dias?\)$' THEN
        CASE
          WHEN substring(elem->>'description' from '\((\d+) dias?\)') = '30'
            THEN jsonb_set(elem, '{description}', '"Garagem"')
          ELSE jsonb_set(
            elem,
            '{description}',
            to_jsonb('Garagem - Proporcional de ' || substring(elem->>'description' from '\((\d+) dias?\)') || ' dia(s)')
          )
        END
      ELSE elem
    END
  )
  FROM jsonb_array_elements(breakdown) AS elem
)
WHERE breakdown IS NOT NULL
  AND breakdown::text ~ '(Aluguel - Parcela \d+ \(\d+ dias?\)|Garagem \(\d+ dias?\))';
