
-- ============================================================
-- COMMISSIONS MODULE: Schema unification & completion
-- ============================================================

-- 1. Complete `commissions` table with missing columns
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS paciente_id uuid,
  ADD COLUMN IF NOT EXISTS enrollment_id uuid,
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS mes_referencia date,
  ADD COLUMN IF NOT EXISTS session_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_fixo_regra numeric,
  ADD COLUMN IF NOT EXISTS tipo_calculo text DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS missed_pct_applied numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS status_liberacao text DEFAULT 'bloqueado';

CREATE INDEX IF NOT EXISTS idx_commissions_mes_ref ON public.commissions(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_commissions_clinic ON public.commissions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_commissions_prof ON public.commissions(professional_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payment ON public.commissions(payment_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agendamento ON public.commissions(agendamento_id);

-- 2. Add replaces_agendamento_id to agendamentos (for reposicao tracking)
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS replaces_agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_replaces ON public.agendamentos(replaces_agendamento_id);

-- 3. Create cancellation_policies table
CREATE TABLE IF NOT EXISTS public.cancellation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE,
  modalidade text,
  min_hours_before_cancel integer NOT NULL DEFAULT 24,
  missed_session_pct numeric NOT NULL DEFAULT 0.5,
  late_cancel_pct numeric NOT NULL DEFAULT 0.5,
  multa_percentual numeric DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clinic policies"
  ON public.cancellation_policies FOR SELECT
  USING (
    clinic_id IS NULL
    OR public.user_has_clinic_access(auth.uid(), clinic_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'master')
  );

CREATE POLICY "Admins manage policies"
  ON public.cancellation_policies FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'master'));

CREATE TRIGGER trg_cancellation_policies_updated_at
  BEFORE UPDATE ON public.cancellation_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create matricula_schedules table (weekly schedule per matricula)
CREATE TABLE IF NOT EXISTS public.matricula_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hora_inicio time,
  hora_fim time,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matricula_schedules_mat ON public.matricula_schedules(matricula_id);

ALTER TABLE public.matricula_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View matricula schedules"
  ON public.matricula_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = matricula_id
        AND (
          public.user_has_clinic_access(auth.uid(), m.clinic_id)
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'master')
        )
    )
  );

CREATE POLICY "Manage matricula schedules"
  ON public.matricula_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = matricula_id
        AND (
          public.user_has_clinic_access(auth.uid(), m.clinic_id)
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'master')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = matricula_id
        AND (
          public.user_has_clinic_access(auth.uid(), m.clinic_id)
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'master')
        )
    )
  );

-- 5. Backfill matricula_schedules from matriculas.dias_semana (if exists in agendamentos)
-- Since matriculas may not have dias_semana, we derive from existing agendamentos
INSERT INTO public.matricula_schedules (matricula_id, day_of_week)
SELECT DISTINCT m.id, EXTRACT(DOW FROM a.data_horario)::integer
FROM public.matriculas m
JOIN public.agendamentos a ON a.enrollment_id = m.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.matricula_schedules ms WHERE ms.matricula_id = m.id
);

-- 6. Migrate regras_comissao → commission_rules
INSERT INTO public.commission_rules (
  id, clinic_id, professional_id, modalidade, tipo_calculo,
  percentage, valor_fixo, ativo, descricao, created_at, updated_at
)
SELECT
  rc.id,
  COALESCE(
    (SELECT cu.clinic_id FROM public.clinic_users cu WHERE cu.user_id = rc.profissional_id LIMIT 1),
    NULL
  ) AS clinic_id,
  rc.profissional_id,
  CASE WHEN rc.tipo_atendimento = 'geral' THEN NULL ELSE rc.tipo_atendimento END,
  CASE
    WHEN COALESCE(rc.valor_fixo, 0) > 0 AND COALESCE(rc.percentual, 0) = 0 THEN 'fixo'
    ELSE 'percentual'
  END,
  COALESCE(rc.percentual, 0),
  COALESCE(rc.valor_fixo, 0),
  COALESCE(rc.ativo, true),
  rc.observacoes,
  rc.created_at,
  rc.updated_at
FROM public.regras_comissao rc
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules cr WHERE cr.id = rc.id);

-- 7. Default cancellation policy per clinic (if missing)
INSERT INTO public.cancellation_policies (clinic_id, min_hours_before_cancel, missed_session_pct, late_cancel_pct)
SELECT c.id, 24, 0.5, 0.5
FROM public.clinicas c
WHERE NOT EXISTS (
  SELECT 1 FROM public.cancellation_policies cp WHERE cp.clinic_id = c.id
);
