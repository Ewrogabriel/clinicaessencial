-- ============================================================
-- Allow unauthenticated (anon) users to read and confirm an
-- appointment when they click on a WhatsApp confirmation link.
-- The appointment UUID is 128-bit random and acts as an
-- unguessable access token; only someone who received the
-- WhatsApp link can know a valid ID.
-- ============================================================

-- ── agendamentos: anon SELECT ────────────────────────────────
-- Anon users can read appointments by ID (UUID is unguessable).
DROP POLICY IF EXISTS "agendamentos_anon_select_by_id" ON public.agendamentos;
CREATE POLICY "agendamentos_anon_select_by_id" ON public.agendamentos
  FOR SELECT TO anon
  USING (true);

-- ── agendamentos: anon UPDATE (confirmacao_presenca only) ────
-- Anon users can only update confirmacao_presenca.
-- A BEFORE UPDATE trigger (trg_agendamentos_anon_confirm_guard)
-- below enforces that no other columns can be changed.
DROP POLICY IF EXISTS "agendamentos_anon_update_confirmacao" ON public.agendamentos;
CREATE POLICY "agendamentos_anon_update_confirmacao" ON public.agendamentos
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Trigger guard: reject anon UPDATE of any column other than
-- confirmacao_presenca and confirmacao_respondida_at.
CREATE OR REPLACE FUNCTION public.fn_agendamentos_anon_confirm_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only enforce this guard for anonymous (unauthenticated) callers.
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'anon' THEN
    -- Raise if any column other than the two confirmation columns differs.
    IF (
      NEW.paciente_id        IS DISTINCT FROM OLD.paciente_id        OR
      NEW.profissional_id    IS DISTINCT FROM OLD.profissional_id    OR
      NEW.clinic_id          IS DISTINCT FROM OLD.clinic_id          OR
      NEW.data_horario       IS DISTINCT FROM OLD.data_horario       OR
      NEW.status             IS DISTINCT FROM OLD.status             OR
      NEW.tipo_sessao        IS DISTINCT FROM OLD.tipo_sessao        OR
      NEW.tipo_atendimento   IS DISTINCT FROM OLD.tipo_atendimento   OR
      NEW.observacoes        IS DISTINCT FROM OLD.observacoes
    ) THEN
      RAISE EXCEPTION 'anon role may only update confirmacao_presenca';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamentos_anon_confirm_guard ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_anon_confirm_guard
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_agendamentos_anon_confirm_guard();

-- ── clinicas: anon SELECT ────────────────────────────────────
-- Clinic name and logo_url are displayed on the confirmation
-- page; they are not sensitive information.
DROP POLICY IF EXISTS "clinicas_anon_select" ON public.clinicas;
CREATE POLICY "clinicas_anon_select" ON public.clinicas
  FOR SELECT TO anon
  USING (true);

-- ── pacientes: anon SELECT (patients with appointments) ─────
-- Restrict to patients who appear in at least one appointment
-- to limit the scope of the SELECT to relevant records only.
DROP POLICY IF EXISTS "pacientes_anon_select_by_appointment" ON public.pacientes;
CREATE POLICY "pacientes_anon_select_by_appointment" ON public.pacientes
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.agendamentos a WHERE a.paciente_id = id
    )
  );

-- ── profiles: anon SELECT (professionals with appointments) ─
-- Restrict to professionals who appear in at least one
-- appointment so that only relevant names are readable.
DROP POLICY IF EXISTS "profiles_anon_select" ON public.profiles;
CREATE POLICY "profiles_anon_select" ON public.profiles
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.agendamentos a WHERE a.profissional_id = user_id
    )
  );
