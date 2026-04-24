
-- 1) Unified payments view
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
  NULL::uuid AS agendamento_id,
  'manual'::text AS origem_tipo,
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
  pm.data_pagamento AS data_pagamento,
  pm.data_vencimento::timestamptz AS data_vencimento,
  pm.created_at,
  ('Mensalidade ' || to_char(pm.mes_referencia, 'MM/YYYY'))::text AS descricao,
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
  ps.data_pagamento AS data_pagamento,
  NULL::timestamptz AS data_vencimento,
  ps.created_at,
  COALESCE(ps.observacoes, 'Sessão avulsa')::text AS descricao,
  ps.observacoes,
  fp.nome::text AS forma_pagamento,
  ps.forma_pagamento_id,
  NULL::uuid AS matricula_id,
  ps.agendamento_id,
  'sessao'::text AS origem_tipo,
  'pagamentos_sessoes'::text AS source_table
FROM public.pagamentos_sessoes ps
LEFT JOIN public.pacientes pa ON pa.id = ps.paciente_id
LEFT JOIN public.formas_pagamento fp ON fp.id = ps.forma_pagamento_id;

ALTER VIEW public.vw_unified_payments SET (security_invoker = on);

-- 2) Finance KPIs RPC
CREATE OR REPLACE FUNCTION public.get_finance_kpis(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_recebido numeric := 0;
  v_total_pendente numeric := 0;
  v_total_despesas numeric := 0;
  v_total_comissoes numeric := 0;
  v_count_pagos int := 0;
  v_count_pendentes int := 0;
  v_count_vencidos int := 0;
  v_valor_vencidos numeric := 0;
  v_count_reembolsados int := 0;
  v_valor_reembolsados numeric := 0;
  v_lucro numeric := 0;
BEGIN
  -- Recebidos / pendentes / vencidos / reembolsados pela view
  SELECT
    COALESCE(SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status IN ('pendente','aberto') THEN valor ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'pago'),
    COUNT(*) FILTER (WHERE status IN ('pendente','aberto')),
    COUNT(*) FILTER (WHERE status IN ('pendente','aberto') AND data_vencimento IS NOT NULL AND data_vencimento::date < CURRENT_DATE),
    COALESCE(SUM(CASE WHEN status IN ('pendente','aberto') AND data_vencimento IS NOT NULL AND data_vencimento::date < CURRENT_DATE THEN valor ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'reembolsado'),
    COALESCE(SUM(CASE WHEN status = 'reembolsado' THEN valor ELSE 0 END), 0)
  INTO
    v_total_recebido, v_total_pendente,
    v_count_pagos, v_count_pendentes,
    v_count_vencidos, v_valor_vencidos,
    v_count_reembolsados, v_valor_reembolsados
  FROM public.vw_unified_payments
  WHERE clinic_id = p_clinic_id;

  -- Despesas pagas
  SELECT COALESCE(SUM(valor), 0) INTO v_total_despesas
  FROM public.expenses
  WHERE clinic_id = p_clinic_id AND status = 'pago';

  -- Comissões
  SELECT COALESCE(SUM(valor), 0) INTO v_total_comissoes
  FROM public.commissions
  WHERE clinic_id = p_clinic_id;

  v_lucro := v_total_recebido - v_total_despesas - v_total_comissoes;

  RETURN jsonb_build_object(
    'totalRecebido', v_total_recebido,
    'totalPendente', v_total_pendente,
    'totalDespesas', v_total_despesas,
    'totalComissoes', v_total_comissoes,
    'countPagos', v_count_pagos,
    'countPendentes', v_count_pendentes,
    'countVencidos', v_count_vencidos,
    'valorVencidos', v_valor_vencidos,
    'countReembolsados', v_count_reembolsados,
    'valorReembolsados', v_valor_reembolsados,
    'lucroLiquido', v_lucro
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_finance_kpis(uuid) TO authenticated;
GRANT SELECT ON public.vw_unified_payments TO authenticated;

-- 3) Public access to nota fiscal storage object via valid token
DROP POLICY IF EXISTS "Public download nota fiscal via token" ON storage.objects;
CREATE POLICY "Public download nota fiscal via token"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'notas-fiscais'
    AND EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.arquivo_path = storage.objects.name
        AND nf.public_token IS NOT NULL
        AND nf.status = 'ativo'
        AND (nf.public_token_expires_at IS NULL OR nf.public_token_expires_at > now())
    )
  );

-- Allow anon to call the token RPC
GRANT EXECUTE ON FUNCTION public.get_nota_fiscal_by_token(text) TO anon, authenticated;
