-- Fix professional_goals: ensure defaults are set
ALTER TABLE public.professional_goals ALTER COLUMN meta_valor SET DEFAULT 0;
ALTER TABLE public.professional_goals ALTER COLUMN pontos_recompensa SET DEFAULT 0;
ALTER TABLE public.professional_goals ALTER COLUMN ativo SET DEFAULT true;

-- Add metric_type column to challenges for system-linked metrics
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS metric_type text NOT NULL DEFAULT 'sessoes_realizadas';

-- Ensure admin INSERT policy works properly for professional_goals (recreate with WITH CHECK)
DROP POLICY IF EXISTS "professional_goals_admin_all" ON public.professional_goals;
CREATE POLICY "professional_goals_admin_all" ON public.professional_goals
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Ensure admin INSERT policy works properly for challenges
DROP POLICY IF EXISTS "challenges_admin_all" ON public.challenges;
CREATE POLICY "challenges_admin_all" ON public.challenges
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));