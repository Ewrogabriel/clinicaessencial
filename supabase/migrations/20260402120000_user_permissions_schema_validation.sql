-- Migration: Add schema validation constraints to user_permissions
-- Validates 'resource' against known system resources and
-- 'access_level' to one of the two supported values.

DO $$
BEGIN
  -- Drop the old unconstrained check if it exists from a previous run
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_permissions_resource_check'
      AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_resource_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_permissions_access_level_check'
      AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_access_level_check;
  END IF;
END $$;

-- Enforce access_level to the two permitted values
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_access_level_check
  CHECK (access_level IN ('view', 'edit'));

-- Enforce resource to the defined system resource keys
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_resource_check
  CHECK (resource IN (
    'agenda',
    'pacientes',
    'prontuarios',
    'modalidades',
    'disponibilidade',
    'financeiro',
    'matriculas',
    'planos',
    'produtos',
    'comissoes',
    'precos_planos',
    'despesas',
    'contratos',
    'relatorios',
    'avisos',
    'mensagens',
    'aniversariantes',
    'clinica',
    'dicas_diarias',
    'inteligencia',
    'automacoes',
    'indicadores',
    'profissionais',
    'check_in'
  ));
