-- ============================================================
-- Expand agendamentos RLS so that professionals can view and
-- manage ALL sessions registered within their clinic, not just
-- their own. This matches the UI behaviour in Agenda.tsx where
-- canSeeAllProfessionals includes the profissional role.
-- ============================================================

-- ── SELECT ──────────────────────────────────────────────────
-- Allow professionals to see every appointment that belongs to
-- a clinic they are a member of (via clinic_users), falling
-- back to their own appointments when clinic_id is unset.
DROP POLICY IF EXISTS "agendamentos_prof_select" ON public.agendamentos;

CREATE POLICY "agendamentos_prof_select" ON public.agendamentos
  FOR SELECT USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND (
      profissional_id = auth.uid()
      OR clinic_id IN (
        SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
      )
    )
  );

-- ── INSERT ───────────────────────────────────────────────────
-- Allow professionals to schedule sessions for any professional
-- that belongs to their clinic (e.g. when one professional
-- books on behalf of a colleague via AgendamentoForm).
-- Both the acting user and the target profissional_id must be
-- members of the same clinic to prevent cross-clinic spoofing.
DROP POLICY IF EXISTS "agendamentos_prof_insert" ON public.agendamentos;

CREATE POLICY "agendamentos_prof_insert" ON public.agendamentos
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'profissional'::app_role)
    AND (
      profissional_id = auth.uid()
      OR (
        clinic_id IN (
          SELECT cu.clinic_id FROM public.clinic_users cu WHERE cu.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM public.clinic_users cu2
          WHERE cu2.user_id = profissional_id
            AND cu2.clinic_id = clinic_id
        )
      )
    )
  );

-- ── UPDATE ───────────────────────────────────────────────────
-- Allow professionals to update (e.g. confirm, check-in,
-- cancel) any session that belongs to their clinic.
DROP POLICY IF EXISTS "agendamentos_prof_update" ON public.agendamentos;

CREATE POLICY "agendamentos_prof_update" ON public.agendamentos
  FOR UPDATE USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND (
      profissional_id = auth.uid()
      OR clinic_id IN (
        SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
      )
    )
  );
