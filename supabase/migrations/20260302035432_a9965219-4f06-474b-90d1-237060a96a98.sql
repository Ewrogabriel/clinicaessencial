-- Add check-in fields to agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS checkin_paciente boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checkin_paciente_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS checkin_profissional boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checkin_profissional_at timestamp with time zone;
