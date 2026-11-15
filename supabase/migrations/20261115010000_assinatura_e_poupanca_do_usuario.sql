-- Assinatura do usuário e campo Poupança do locador (15/nov/2026, issue #125).
--
-- 1) system_users.signature_url: imagem da assinatura do usuário. É a que
--    sai no recibo (do usuário logado que fez o recebimento) e no contrato.
-- 2) system_users.landlord_bank_savings: campo "Poupança", logo depois de
--    "Operação" nos dados bancários do locador.
-- Pode rodar mais de uma vez (IF NOT EXISTS).
ALTER TABLE public.system_users
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_savings TEXT;

COMMENT ON COLUMN public.system_users.signature_url IS 'Link da imagem da assinatura do usuário (recibos e contrato).';
COMMENT ON COLUMN public.system_users.landlord_bank_savings IS 'Poupança do locador (aparece depois da Operação no contrato).';

NOTIFY pgrst, 'reload schema';
