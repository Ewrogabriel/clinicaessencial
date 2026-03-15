-- Add horarios_preferidos JSONB column to lista_espera
-- This allows storing multiple structured preferred schedule entries
-- (weekday, time, professional_id) similar to matriculas weekly_schedules
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS horarios_preferidos JSONB;
