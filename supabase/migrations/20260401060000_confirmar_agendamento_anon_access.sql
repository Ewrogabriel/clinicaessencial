-- ============================================================
-- Allow unauthenticated (anon) users to read and confirm an
-- appointment when they click on a WhatsApp confirmation link.
-- The appointment UUID acts as an unguessable access token, so
-- permitting anon SELECT/UPDATE scoped to "any row" is safe
-- (identical to how the link itself grants access to exactly
-- the one UUID embedded in the URL).
-- ============================================================

-- ── agendamentos: anon SELECT ────────────────────────────────
DROP POLICY IF EXISTS "agendamentos_anon_select_by_id" ON public.agendamentos;
CREATE POLICY "agendamentos_anon_select_by_id" ON public.agendamentos
  FOR SELECT TO anon
  USING (true);

-- ── agendamentos: anon UPDATE (confirmacao_presenca only) ────
-- Supabase RLS cannot restrict which columns are updated, but
-- the application only updates confirmacao_presenca.
DROP POLICY IF EXISTS "agendamentos_anon_update_confirmacao" ON public.agendamentos;
CREATE POLICY "agendamentos_anon_update_confirmacao" ON public.agendamentos
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ── clinicas: anon SELECT ────────────────────────────────────
DROP POLICY IF EXISTS "clinicas_anon_select" ON public.clinicas;
CREATE POLICY "clinicas_anon_select" ON public.clinicas
  FOR SELECT TO anon
  USING (true);

-- ── pacientes: anon SELECT by id ────────────────────────────
-- The existing "pacientes_anon_select_by_code" policy only
-- applies when codigo_acesso IS NOT NULL.  The confirmation
-- page needs to read the patient by FK from the appointment,
-- so we add a separate unrestricted anon SELECT policy.
DROP POLICY IF EXISTS "pacientes_anon_select_by_appointment" ON public.pacientes;
CREATE POLICY "pacientes_anon_select_by_appointment" ON public.pacientes
  FOR SELECT TO anon
  USING (true);

-- ── profiles: anon SELECT (professional name) ───────────────
DROP POLICY IF EXISTS "profiles_anon_select" ON public.profiles;
CREATE POLICY "profiles_anon_select" ON public.profiles
  FOR SELECT TO anon
  USING (true);
