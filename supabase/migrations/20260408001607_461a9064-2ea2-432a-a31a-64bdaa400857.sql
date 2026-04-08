
-- Fix get_public_receipt to handle column differences between payment tables
CREATE OR REPLACE FUNCTION public.get_public_receipt(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_payment_json jsonb;
  v_paciente_id uuid;
  v_paciente record;
  v_clinic record;
BEGIN
  -- Try pagamentos first
  SELECT jsonb_build_object(
    'id', p.id,
    'valor', p.valor,
    'data_pagamento', COALESCE(p.data_pagamento::text, p.created_at::text),
    'descricao', p.descricao,
    'observacoes', p.observacoes,
    'metodo_pagamento', NULL,
    'forma_pagamento', p.forma_pagamento,
    'referencia', NULL,
    'mes_referencia', NULL
  ), p.paciente_id
  INTO v_payment_json, v_paciente_id
  FROM pagamentos p WHERE p.id = p_payment_id;

  -- Try pagamentos_sessoes
  IF v_payment_json IS NULL THEN
    SELECT jsonb_build_object(
      'id', ps.id,
      'valor', ps.valor,
      'data_pagamento', COALESCE(ps.data_pagamento::text, ps.created_at::text),
      'descricao', 'Sessão avulsa',
      'observacoes', ps.observacoes,
      'metodo_pagamento', NULL,
      'forma_pagamento', NULL,
      'referencia', NULL,
      'mes_referencia', NULL
    ), ps.paciente_id
    INTO v_payment_json, v_paciente_id
    FROM pagamentos_sessoes ps WHERE ps.id = p_payment_id;
  END IF;

  -- Try pagamentos_mensalidade
  IF v_payment_json IS NULL THEN
    SELECT jsonb_build_object(
      'id', pm.id,
      'valor', pm.valor,
      'data_pagamento', COALESCE(pm.data_pagamento::text, pm.created_at::text),
      'descricao', 'Mensalidade',
      'observacoes', pm.observacoes,
      'metodo_pagamento', NULL,
      'forma_pagamento', NULL,
      'referencia', NULL,
      'mes_referencia', pm.mes_referencia
    ), pm.paciente_id
    INTO v_payment_json, v_paciente_id
    FROM pagamentos_mensalidade pm WHERE pm.id = p_payment_id;
  END IF;

  IF v_payment_json IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get paciente
  SELECT id, nome, cpf INTO v_paciente FROM pacientes WHERE id = v_paciente_id;

  -- Get clinic
  SELECT nome INTO v_clinic FROM clinic_settings LIMIT 1;

  RETURN jsonb_build_object(
    'payment', v_payment_json,
    'paciente', jsonb_build_object(
      'id', v_paciente.id,
      'nome', v_paciente.nome,
      'cpf', v_paciente.cpf
    ),
    'clinic_nome', v_clinic.nome
  );
END;
$function$;

-- Fix matriculas RLS: patients should only see their own
DROP POLICY IF EXISTS "matriculas_patient_select" ON public.matriculas;
CREATE POLICY "matriculas_patient_select" ON public.matriculas
FOR SELECT TO authenticated
USING (
  paciente_id IN (
    SELECT id FROM pacientes WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM clinic_users cu WHERE cu.user_id = auth.uid() AND cu.clinic_id = matriculas.clinic_id
  )
);

-- Drop overly permissive policies on matriculas if they exist
DROP POLICY IF EXISTS "matriculas_select" ON public.matriculas;
DROP POLICY IF EXISTS "Authenticated users can view matriculas" ON public.matriculas;
