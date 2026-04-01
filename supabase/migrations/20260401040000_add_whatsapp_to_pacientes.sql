-- Add whatsapp column to pacientes table for confirmation feature
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;
