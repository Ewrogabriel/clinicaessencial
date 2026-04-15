-- Migration: Advanced RBAC and ABAC Permission System

-- 1. Create Core Tables
CREATE TABLE public.app_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.app_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    module text NOT NULL,
    action text NOT NULL,
    scope_type text NOT NULL CHECK (scope_type IN ('own', 'others', 'global')),
    description text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    UNIQUE(module, action, scope_type)
);

CREATE TABLE public.role_permissions (
    role_id uuid REFERENCES public.app_roles(id) ON DELETE CASCADE,
    permission_id uuid REFERENCES public.app_permissions(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE public.user_access_overrides (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id uuid REFERENCES public.app_permissions(id) ON DELETE CASCADE,
    allowed boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY(user_id, permission_id)
);

CREATE TABLE public.access_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    module text NOT NULL,
    condition_json jsonb NOT NULL,
    effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    module text NOT NULL,
    entity_id text,
    metadata_json jsonb,
    timestamp timestamptz DEFAULT timezone('utc'::text, now()),
    clinic_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE
);

-- 2. Populate Default Roles
INSERT INTO public.app_roles (name, description, is_system) VALUES
('master', 'Acesso total de sistema SaaS', true),
('admin', 'Acesso total à clínica', true),
('gestor', 'Acesso gerencial da clínica', true),
('secretario', 'Acesso a agendas e cadastros', true),
('profissional', 'Acesso restrito ao próprio escopo', true),
('paciente', 'Acesso do paciente', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Update Existing User Roles (Migration)
-- To safely transition `user_roles` (which uses TEXT) without dropping it yet:
-- We add role_id, backfill it, and ensure backward compatibility.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.app_roles(id) ON DELETE CASCADE;

DO $$
BEGIN
    UPDATE public.user_roles ur
    SET role_id = ar.id
    FROM public.app_roles ar
    WHERE ur.role = ar.name AND ur.role_id IS NULL;
END $$;

-- 4. Rewrite `public.has_role` for backward compatibility AND support for new schema
CREATE OR REPLACE FUNCTION public.has_role(_role text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.app_roles ar ON ar.id = ur.role_id
    WHERE ur.user_id = _user_id AND ar.name = _role
  ) OR EXISTS (
    -- Fallback in case ur.role_id is empty but ur.role matches
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::app_role
  );
$$;

-- 5. Create Dynamic Backend Permission Check
CREATE OR REPLACE FUNCTION public.check_permission(
  _user_id uuid,
  _module text,
  _action text,
  _target_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  _is_admin boolean;
  _has_override boolean;
  _override_allowed boolean;
  _has_role_perm boolean;
  _scope text;
BEGIN
  -- 1. Admin/Master fallback (Total Bypass)
  SELECT true INTO _is_admin FROM public.user_roles ur 
  JOIN public.app_roles ar ON ur.role_id = ar.id 
  WHERE ur.user_id = _user_id AND ar.name IN ('admin', 'master');
  
  IF _is_admin THEN RETURN true; END IF;

  -- 2. Check Overrides (Priority Over Role)
  SELECT o.allowed, p.scope_type INTO _override_allowed, _scope 
  FROM public.user_access_overrides o
  JOIN public.app_permissions p ON p.id = o.permission_id
  WHERE o.user_id = _user_id AND p.module = _module AND p.action = _action
  LIMIT 1;

  IF FOUND THEN
    IF NOT _override_allowed THEN RETURN false; END IF;
    -- Evaluate Scope for Override
    IF _scope = 'global' THEN RETURN true; END IF;
    IF _scope = 'own' AND _user_id = _target_user_id THEN RETURN true; END IF;
    IF _scope = 'others' THEN RETURN true; END IF; -- 'Others' includes own usually
    -- If it's 'own' but target is someone else
    IF _scope = 'own' AND _user_id != _target_user_id THEN RETURN false; END IF;
    RETURN true;
  END IF;

  -- 3. Check Role Permissions
  SELECT true, p.scope_type INTO _has_role_perm, _scope FROM public.role_permissions rp
  JOIN public.user_roles ur ON ur.role_id = rp.role_id
  JOIN public.app_permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id AND p.module = _module AND p.action = _action
  LIMIT 1;

  IF FOUND THEN
    IF _scope = 'global' THEN RETURN true; END IF;
    IF _scope = 'others' THEN RETURN true; END IF;
    IF _scope = 'own' AND _target_user_id = _user_id THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;

-- 6. Setup Minimal Essential Permissions for Scaffolding
INSERT INTO public.app_permissions (module, action, scope_type, description) VALUES
('agenda', 'view', 'own', 'Pode ver apenas sua própria agenda'),
('agenda', 'view', 'global', 'Pode ver agenda de qualquer profissional'),
('agenda', 'create', 'own', 'Pode criar agendamentos para si mesmo'),
('agenda', 'create', 'others', 'Pode criar agendamentos para outros profissionais')
ON CONFLICT DO NOTHING;

-- Pre-assign some defaults to 'profissional' and 'secretario' based on names
DO $$
DECLARE
  prof_role_id uuid;
  sec_role_id uuid;
  perm_agenda_view_own uuid;
  perm_agenda_create_own uuid;
  perm_agenda_view_global uuid;
  perm_agenda_create_others uuid;
BEGIN
  SELECT id INTO prof_role_id FROM public.app_roles WHERE name = 'profissional';
  SELECT id INTO sec_role_id FROM public.app_roles WHERE name = 'secretario';
  
  SELECT id INTO perm_agenda_view_own FROM public.app_permissions WHERE module = 'agenda' AND action = 'view' AND scope_type = 'own';
  SELECT id INTO perm_agenda_create_own FROM public.app_permissions WHERE module = 'agenda' AND action = 'create' AND scope_type = 'own';
  SELECT id INTO perm_agenda_view_global FROM public.app_permissions WHERE module = 'agenda' AND action = 'view' AND scope_type = 'global';
  SELECT id INTO perm_agenda_create_others FROM public.app_permissions WHERE module = 'agenda' AND action = 'create' AND scope_type = 'others';

  IF prof_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES (prof_role_id, perm_agenda_view_own) ON CONFLICT DO NOTHING;
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES (prof_role_id, perm_agenda_create_own) ON CONFLICT DO NOTHING;
  END IF;

  IF sec_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES (sec_role_id, perm_agenda_view_global) ON CONFLICT DO NOTHING;
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES (sec_role_id, perm_agenda_create_others) ON CONFLICT DO NOTHING;
  END IF;
END $$;
