
-- Add digital signature to evolutions
ALTER TABLE public.evolutions ADD COLUMN IF NOT EXISTS assinatura_url text;
