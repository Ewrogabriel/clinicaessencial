
-- 1. RPC function for public receipt lookup (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_public_receipt(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_payment record;
  v_paciente record;
  v_clinic record;
BEGIN
  -- Try pagamentos
  SELECT * INTO v_payment FROM pagamentos WHERE id = p_payment_id;
  
  -- Try pagamentos_sessoes
  IF v_payment IS NULL THEN
    SELECT * INTO v_payment FROM pagamentos_sessoes WHERE id = p_payment_id;
  END IF;
  
  -- Try pagamentos_mensalidade
  IF v_payment IS NULL THEN
    SELECT * INTO v_payment FROM pagamentos_mensalidade WHERE id = p_payment_id;
  END IF;
  
  IF v_payment IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get paciente
  SELECT id, nome, cpf INTO v_paciente FROM pacientes WHERE id = v_payment.paciente_id;
  
  -- Get clinic
  SELECT nome INTO v_clinic FROM clinic_settings LIMIT 1;

  RETURN jsonb_build_object(
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'valor', v_payment.valor,
      'data_pagamento', COALESCE(v_payment.data_pagamento, v_payment.created_at),
      'descricao', v_payment.descricao,
      'observacoes', v_payment.observacoes,
      'metodo_pagamento', v_payment.metodo_pagamento,
      'forma_pagamento', v_payment.forma_pagamento,
      'referencia', v_payment.referencia,
      'mes_referencia', v_payment.mes_referencia
    ),
    'paciente', jsonb_build_object(
      'id', v_paciente.id,
      'nome', v_paciente.nome,
      'cpf', v_paciente.cpf
    ),
    'clinic_nome', v_clinic.nome
  );
END;
$$;

-- 2. Fix agendamentos INSERT for gestor and professionals in same clinic
DROP POLICY IF EXISTS "agendamentos_prof_insert" ON agendamentos;
CREATE POLICY "agendamentos_prof_insert" ON agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu WHERE cu.user_id = auth.uid() AND cu.clinic_id = agendamentos.clinic_id
    )
  );

DROP POLICY IF EXISTS "agendamentos_gestor_insert" ON agendamentos;
CREATE POLICY "agendamentos_gestor_insert" ON agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "agendamentos_gestor_select" ON agendamentos;
CREATE POLICY "agendamentos_gestor_select" ON agendamentos FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "agendamentos_gestor_update" ON agendamentos;
CREATE POLICY "agendamentos_gestor_update" ON agendamentos FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "agendamentos_gestor_delete" ON agendamentos;
CREATE POLICY "agendamentos_gestor_delete" ON agendamentos FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

-- Also allow professionals to update appointments in their clinic (not just their own)
DROP POLICY IF EXISTS "agendamentos_prof_update" ON agendamentos;
CREATE POLICY "agendamentos_prof_update" ON agendamentos FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu WHERE cu.user_id = auth.uid() AND cu.clinic_id = agendamentos.clinic_id
    )
  );

-- 3. Fix weekly_schedules INSERT for professionals and gestors
DROP POLICY IF EXISTS "weekly_schedules_prof_insert" ON weekly_schedules;
CREATE POLICY "weekly_schedules_prof_insert" ON weekly_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'profissional'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Add UPDATE/DELETE for weekly_schedules for professionals/gestors
DROP POLICY IF EXISTS "weekly_schedules_prof_update" ON weekly_schedules;
CREATE POLICY "weekly_schedules_prof_update" ON weekly_schedules FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "weekly_schedules_prof_delete" ON weekly_schedules;
CREATE POLICY "weekly_schedules_prof_delete" ON weekly_schedules FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. Add gestor policies for matriculas
DROP POLICY IF EXISTS "matriculas_gestor_all" ON matriculas;
CREATE POLICY "matriculas_gestor_all" ON matriculas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

-- Allow professionals to insert/update matriculas in their clinic
DROP POLICY IF EXISTS "matriculas_prof_insert" ON matriculas;
CREATE POLICY "matriculas_prof_insert" ON matriculas FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu WHERE cu.user_id = auth.uid() AND cu.clinic_id = matriculas.clinic_id
    )
  );

DROP POLICY IF EXISTS "matriculas_prof_update" ON matriculas;
CREATE POLICY "matriculas_prof_update" ON matriculas FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu WHERE cu.user_id = auth.uid() AND cu.clinic_id = matriculas.clinic_id
    )
  );

-- 5. Add gestor policies for planos
DROP POLICY IF EXISTS "planos_gestor_all" ON planos;
CREATE POLICY "planos_gestor_all" ON planos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

-- Fix planos prof insert to allow clinic-scoped
DROP POLICY IF EXISTS "planos_prof_insert" ON planos;
CREATE POLICY "planos_prof_insert" ON planos FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'profissional'::app_role)
  );

DROP POLICY IF EXISTS "planos_prof_update" ON planos;
CREATE POLICY "planos_prof_update" ON planos FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
  );

-- 6. Add gestor policies for pagamentos
DROP POLICY IF EXISTS "pagamentos_gestor_all" ON pagamentos;
CREATE POLICY "pagamentos_gestor_all" ON pagamentos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));
