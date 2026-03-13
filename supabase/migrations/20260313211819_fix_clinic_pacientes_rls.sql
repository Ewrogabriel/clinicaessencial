-- Fix RLS policies on clinic_pacientes to allow clinic members (profissional, gestor, etc.)
-- to insert patient-clinic relationships when approving pre-registrations.
-- Previously only 'admin' role could insert via clinic_pacientes_admin_all (FOR ALL),
-- causing silent RLS failures when non-admin users approved pre-registrations.
-- The existing clinic_pacientes_admin_all policy is kept as-is because it also covers
-- UPDATE and DELETE operations for admins. This new INSERT policy is additive (PostgreSQL
-- evaluates multiple RLS policies with OR semantics).

CREATE POLICY "clinic_pacientes_members_insert" ON public.clinic_pacientes
  FOR INSERT
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
