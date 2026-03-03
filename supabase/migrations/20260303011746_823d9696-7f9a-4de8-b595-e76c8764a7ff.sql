
-- Fix user_roles SELECT policies: make them permissive so all authenticated users can see roles
-- This is needed for patients to see which users are professionals (reschedule flow)
-- and for the UserRoleManager to list all users

DROP POLICY IF EXISTS "roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "roles_gestor_select" ON public.user_roles;

CREATE POLICY "roles_select_authenticated" ON public.user_roles
FOR SELECT TO authenticated
USING (true);
