-- Add missing columns to pagamentos table to support sessao avulsa flow
ALTER TABLE public.pagamentos 
  ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_lancamento text,
  ADD COLUMN IF NOT EXISTS origem_tipo text;

CREATE INDEX IF NOT EXISTS idx_pagamentos_agendamento_id ON public.pagamentos(agendamento_id);

-- Recreate unified view to expose agendamento_id and proper origem_tipo from pagamentos
CREATE OR REPLACE VIEW public.vw_unified_payments AS
SELECT 
  p.id,
  p.clinic_id,
  p.paciente_id,
  pa.nome AS paciente_nome,
  p.valor::numeric AS valor,
  p.status::text AS status,
  p.data_pagamento::timestamptz AS data_pagamento,
  p.data_vencimento::timestamptz AS data_vencimento,
  p.created_at,
  p.descricao,
  p.observacoes,
  p.forma_pagamento::text AS forma_pagamento,
  NULL::uuid AS forma_pagamento_id,
  NULL::uuid AS matricula_id,
  p.agendamento_id,
  COALESCE(
    p.origem_tipo,
    CASE 
      WHEN p.tipo_lancamento = 'sessao' OR p.agendamento_id IS NOT NULL THEN 'sessao_avulsa'
      ELSE 'manual'
    END
  ) AS origem_tipo,
  'pagamentos'::text AS source_table
FROM public.pagamentos p
LEFT JOIN public.pacientes pa ON pa.id = p.paciente_id

UNION ALL

SELECT 
  pm.id,
  pm.clinic_id,
  pm.paciente_id,
  pa.nome AS paciente_nome,
  pm.valor::numeric AS valor,
  pm.status::text AS status,
  pm.data_pagamento,
  pm.data_vencimento::timestamptz AS data_vencimento,
  pm.created_at,
  ('Mensalidade ' || to_char(pm.mes_referencia::timestamptz, 'MM/YYYY')) AS descricao,
  pm.observacoes,
  fp.nome::text AS forma_pagamento,
  pm.forma_pagamento_id,
  pm.matricula_id,
  NULL::uuid AS agendamento_id,
  'mensalidade'::text AS origem_tipo,
  'pagamentos_mensalidade'::text AS source_table
FROM public.pagamentos_mensalidade pm
LEFT JOIN public.pacientes pa ON pa.id = pm.paciente_id
LEFT JOIN public.formas_pagamento fp ON fp.id = pm.forma_pagamento_id

UNION ALL

SELECT 
  ps.id,
  ps.clinic_id,
  ps.paciente_id,
  pa.nome AS paciente_nome,
  ps.valor::numeric AS valor,
  ps.status::text AS status,
  ps.data_pagamento,
  NULL::timestamptz AS data_vencimento,
  ps.created_at,
  COALESCE(ps.observacoes, 'Sessão avulsa') AS descricao,
  ps.observacoes,
  fp.nome::text AS forma_pagamento,
  ps.forma_pagamento_id,
  NULL::uuid AS matricula_id,
  ps.agendamento_id,
  'sessao_avulsa'::text AS origem_tipo,
  'pagamentos_sessoes'::text AS source_table
FROM public.pagamentos_sessoes ps
LEFT JOIN public.pacientes pa ON pa.id = ps.paciente_id
LEFT JOIN public.formas_pagamento fp ON fp.id = ps.forma_pagamento_id;