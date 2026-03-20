-- Make paciente_id nullable for teleconsulta_sessions (allows creating sessions without a patient selected)
ALTER TABLE public.teleconsulta_sessions ALTER COLUMN paciente_id DROP NOT NULL;