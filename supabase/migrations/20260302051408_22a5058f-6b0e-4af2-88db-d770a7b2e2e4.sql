
-- Add color column for professional agenda identification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cor_agenda text DEFAULT '#3b82f6';
