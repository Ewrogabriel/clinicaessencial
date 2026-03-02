-- Allow gestor to view and update profiles
CREATE POLICY "profiles_gestor_select"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "profiles_gestor_update"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'gestor'::app_role));

-- Allow gestor to view user_roles
CREATE POLICY "roles_gestor_select"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'gestor'::app_role));
