
-- Fix weekly_schedules policies to be more restrictive
DROP POLICY IF EXISTS "weekly_schedules_insert" ON public.weekly_schedules;

CREATE POLICY "weekly_schedules_prof_insert" ON public.weekly_schedules FOR INSERT TO authenticated
  WITH CHECK (professional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
