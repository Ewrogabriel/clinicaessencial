-- =========================================================
-- 1. CATÁLOGO DE PERMISSÕES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('own','others','global')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, action, scope_type)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissions readable by authenticated"
ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permissions manageable by admin/master"
ON public.permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'));

-- =========================================================
-- 2. PERMISSÕES POR PERFIL (RBAC)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role perms readable by authenticated"
ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role perms manageable by admin/master"
ON public.role_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'));

-- =========================================================
-- 3. OVERRIDE POR USUÁRIO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_permissions_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT true,
  valid_until TIMESTAMPTZ,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

ALTER TABLE public.user_permissions_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Override readable by self or admin"
ON public.user_permissions_override FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Override manageable by admin/master/gestor"
ON public.user_permissions_override FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gestor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gestor'));

-- =========================================================
-- 4. POLÍTICAS ABAC
-- =========================================================
CREATE TABLE IF NOT EXISTS public.access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  condition_json JSONB NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Policies readable by authenticated"
ON public.access_policies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Policies manageable by admin/master"
ON public.access_policies FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'));

-- =========================================================
-- 5. PERMISSÕES DE AGENDAMENTO ENTRE PROFISSIONAIS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.schedule_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'own' CHECK (scope IN ('own','others','all')),
  allowed_professionals UUID[] DEFAULT NULL,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule perms readable by self or admin"
ON public.schedule_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Schedule perms manageable by admin/master/gestor"
ON public.schedule_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gestor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER trg_schedule_permissions_updated_at
BEFORE UPDATE ON public.schedule_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_access_policies_updated_at
BEFORE UPDATE ON public.access_policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. SEED: catálogo de permissões
-- =========================================================
DO $$
DECLARE
  modules TEXT[] := ARRAY['agenda','pacientes','prontuario','financeiro','comissoes','matriculas','planos','relatorios','equipe','configuracoes','mensagens','documentos','contratos'];
  actions TEXT[] := ARRAY['view','create','edit','delete','approve','export','assign','cancel','reschedule','confirm','finalize','pay','refund'];
  scopes TEXT[] := ARRAY['own','others','global'];
  m TEXT; a TEXT; s TEXT;
BEGIN
  FOREACH m IN ARRAY modules LOOP
    FOREACH a IN ARRAY actions LOOP
      FOREACH s IN ARRAY scopes LOOP
        INSERT INTO public.permissions (module, action, scope_type, description)
        VALUES (m, a, s, format('%s.%s (%s)', m, a, s))
        ON CONFLICT (module, action, scope_type) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- =========================================================
-- 7. SEED: role_permissions padrão
-- =========================================================
-- Admin/Master: todas as permissões globais
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM public.permissions WHERE scope_type='global'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'master'::app_role, id FROM public.permissions WHERE scope_type='global'
ON CONFLICT DO NOTHING;

-- Gestor: tudo global exceto delete
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'gestor'::app_role, id FROM public.permissions
WHERE scope_type='global' AND action <> 'delete'
ON CONFLICT DO NOTHING;

-- Secretário: agenda/pacientes/matriculas/financeiro/mensagens (view+create+edit global)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'secretario'::app_role, id FROM public.permissions
WHERE module IN ('agenda','pacientes','matriculas','financeiro','mensagens','planos','contratos')
  AND action IN ('view','create','edit','reschedule','confirm','cancel')
  AND scope_type='global'
ON CONFLICT DO NOTHING;

-- Profissional: agenda/prontuario/pacientes/comissoes own + view others
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'profissional'::app_role, id FROM public.permissions
WHERE module IN ('agenda','prontuario','pacientes','comissoes','documentos','mensagens')
  AND action IN ('view','create','edit')
  AND scope_type IN ('own','global')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'profissional'::app_role, id FROM public.permissions
WHERE module='agenda' AND action='view' AND scope_type='others'
ON CONFLICT DO NOTHING;

-- Paciente: view own
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'paciente'::app_role, id FROM public.permissions
WHERE module IN ('agenda','financeiro','documentos','contratos','mensagens')
  AND action='view' AND scope_type='own'
ON CONFLICT DO NOTHING;

-- =========================================================
-- 8. FUNÇÃO can() — autorização principal
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_can(
  _user_id UUID,
  _module TEXT,
  _action TEXT,
  _scope TEXT DEFAULT 'global'
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perm_id UUID;
  v_override RECORD;
  v_has BOOLEAN;
BEGIN
  -- Master/Admin: full access
  IF public.has_role(_user_id,'master') OR public.has_role(_user_id,'admin') THEN
    RETURN TRUE;
  END IF;

  SELECT id INTO v_perm_id FROM public.permissions
  WHERE module=_module AND action=_action AND scope_type=_scope
  LIMIT 1;

  IF v_perm_id IS NULL THEN RETURN FALSE; END IF;

  -- Override?
  SELECT * INTO v_override FROM public.user_permissions_override
  WHERE user_id=_user_id AND permission_id=v_perm_id
    AND (valid_until IS NULL OR valid_until > now())
  LIMIT 1;

  IF FOUND THEN RETURN v_override.allowed; END IF;

  -- Role-based
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role=rp.role
    WHERE ur.user_id=_user_id AND rp.permission_id=v_perm_id
  ) INTO v_has;

  RETURN COALESCE(v_has,false);
END;
$$;

-- =========================================================
-- 9. FUNÇÃO: pode agendar para outro profissional?
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_schedule_for(
  _user_id UUID,
  _target_professional_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp RECORD;
BEGIN
  -- Admin/master/gestor: sempre podem
  IF public.has_role(_user_id,'master') OR public.has_role(_user_id,'admin') OR public.has_role(_user_id,'gestor') THEN
    RETURN TRUE;
  END IF;

  -- Para si mesmo: sempre permitido
  IF _user_id = _target_professional_id THEN RETURN TRUE; END IF;

  SELECT * INTO v_sp FROM public.schedule_permissions WHERE user_id=_user_id LIMIT 1;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_sp.scope = 'all' THEN RETURN TRUE; END IF;
  IF v_sp.scope = 'others' THEN
    IF v_sp.allowed_professionals IS NULL OR array_length(v_sp.allowed_professionals,1) IS NULL THEN
      RETURN TRUE; -- others sem lista = todos os outros
    END IF;
    RETURN _target_professional_id = ANY(v_sp.allowed_professionals);
  END IF;

  RETURN FALSE;
END;
$$;