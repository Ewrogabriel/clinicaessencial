-- Add digital signature and rubrica columns to clinic_settings
ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS assinatura_url text,
  ADD COLUMN IF NOT EXISTS rubrica_url text;
