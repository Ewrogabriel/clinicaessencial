
-- Table for plan upgrade requests from clinics
CREATE TABLE public.plan_upgrade_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  current_plan_id UUID REFERENCES public.platform_plans(id),
  requested_plan_id UUID NOT NULL REFERENCES public.platform_plans(id),
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  motivo TEXT,
  resposta TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage upgrade requests" ON public.plan_upgrade_requests
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add categoria column to bank_transactions for categorization
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT NULL;
