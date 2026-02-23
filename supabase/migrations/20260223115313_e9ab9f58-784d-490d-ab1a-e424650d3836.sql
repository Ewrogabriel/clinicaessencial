
-- Add pricing columns to agendamentos
ALTER TABLE public.agendamentos
ADD COLUMN valor_sessao numeric DEFAULT NULL,
ADD COLUMN valor_mensal numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.agendamentos.valor_sessao IS 'Valor da sessão única';
COMMENT ON COLUMN public.agendamentos.valor_mensal IS 'Valor mensal para atendimentos recorrentes';
