
ALTER TABLE public.politicas_cancelamento
  ADD COLUMN IF NOT EXISTS exige_justificativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prazo_reagendamento_dias integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS prazo_remarcacao_dias integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.politicas_cancelamento.exige_justificativa IS 'Se exige justificativa para cancelamento';
COMMENT ON COLUMN public.politicas_cancelamento.prazo_reagendamento_dias IS 'Prazo em dias para reagendar sessão antes de expirar';
COMMENT ON COLUMN public.politicas_cancelamento.prazo_remarcacao_dias IS 'Prazo em dias para remarcar sessão cancelada/falta antes de vencer';
