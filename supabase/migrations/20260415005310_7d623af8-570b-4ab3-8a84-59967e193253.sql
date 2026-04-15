
ALTER TABLE public.clinic_group_members
  ADD COLUMN IF NOT EXISTS share_patients boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_financials boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_professionals boolean DEFAULT false;
