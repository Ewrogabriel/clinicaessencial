
-- Teleconsulta sessions table
CREATE TABLE public.teleconsulta_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  waiting_room_entered_at TIMESTAMPTZ,
  admitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat messages for teleconsulta
CREATE TABLE public.teleconsulta_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.teleconsulta_sessions(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'profissional',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teleconsulta_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teleconsulta_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for sessions
CREATE POLICY "Authenticated users can view teleconsulta sessions" ON public.teleconsulta_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert teleconsulta sessions" ON public.teleconsulta_sessions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update teleconsulta sessions" ON public.teleconsulta_sessions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for messages
CREATE POLICY "Authenticated users can view teleconsulta messages" ON public.teleconsulta_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert teleconsulta messages" ON public.teleconsulta_messages
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.teleconsulta_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teleconsulta_sessions;
