-- Migration: Refactor RLS for `agendamentos` (and potentially others) to use ABAC/RBAC func

-- Drop old rigid policies for agendamentos
DROP POLICY IF EXISTS "agendamentos_modify_policy" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_select_policy" ON public.agendamentos;

-- Advanced Write/Modify Policy (Delegating to check_permission)
-- Can INSERT/UPDATE/DELETE if they have permission to 'edit' scheduling overall ('others', 'global')
-- or if it is their own schedule (checked internally by check_permission passing the profissional_id)
CREATE POLICY "agendamentos_advanced_modify_policy" ON public.agendamentos
FOR ALL
USING (
  public.check_permission(auth.uid(), 'agenda', 'edit', profissional_id)
);

-- Advanced Read Policy
-- Can read if they have 'view' permission.
CREATE POLICY "agendamentos_advanced_select_policy" ON public.agendamentos
FOR SELECT
USING (
  public.check_permission(auth.uid(), 'agenda', 'view', profissional_id)
);
