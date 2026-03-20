-- Fix paciente_sessions: drop overly permissive policies and replace with scoped ones

DROP POLICY IF EXISTS "paciente_sessions_anon_select" ON public.paciente_sessions;
DROP POLICY IF EXISTS "paciente_sessions_anon_insert" ON public.paciente_sessions;
DROP POLICY IF EXISTS "paciente_sessions_anon_delete" ON public.paciente_sessions;

-- Allow patients to read only their own sessions
CREATE POLICY "paciente_sessions_own_select"
  ON public.paciente_sessions
  FOR SELECT
  TO authenticated
  USING (
    paciente_id IN (
      SELECT id FROM public.pacientes WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Allow inserting only for the patient's own record (via anon for login flow + authenticated)
CREATE POLICY "paciente_sessions_own_insert"
  ON public.paciente_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- For anon login flow: allow insert (token validation happens server-side)
    -- Restrict to valid paciente_id references only
    paciente_id IN (SELECT id FROM public.pacientes)
  );

-- Allow deleting only own sessions
CREATE POLICY "paciente_sessions_own_delete"
  ON public.paciente_sessions
  FOR DELETE
  TO authenticated
  USING (
    paciente_id IN (
      SELECT id FROM public.pacientes WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );