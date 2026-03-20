
-- Add secretario to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretario';

-- Create user_permissions table for configurable resource access
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_admin_all" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "permissions_gestor_all" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "permissions_self_select" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
