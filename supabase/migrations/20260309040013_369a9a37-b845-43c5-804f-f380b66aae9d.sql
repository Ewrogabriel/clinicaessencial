
-- Exercise plans table
CREATE TABLE public.planos_exercicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  profissional_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  objetivo TEXT,
  duracao_semanas INTEGER DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'ativo',
  gerado_por_ia BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercises in each plan
CREATE TABLE public.exercicios_plano (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id UUID REFERENCES public.planos_exercicios(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  series INTEGER,
  repeticoes TEXT,
  carga TEXT,
  tempo_execucao TEXT,
  frequencia TEXT,
  video_url TEXT,
  imagem_url TEXT,
  observacoes TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teleconsulta post-call notes (linked to prontuário via evolution)
ALTER TABLE public.teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS notas_pos_consulta TEXT,
  ADD COLUMN IF NOT EXISTS evolution_id UUID REFERENCES public.evolutions(id) ON DELETE SET NULL;

-- RLS for exercise plans
ALTER TABLE public.planos_exercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercicios_plano ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read planos" ON public.planos_exercicios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert planos" ON public.planos_exercicios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update planos" ON public.planos_exercicios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete planos" ON public.planos_exercicios FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read exercicios" ON public.exercicios_plano FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert exercicios" ON public.exercicios_plano FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update exercicios" ON public.exercicios_plano FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete exercicios" ON public.exercicios_plano FOR DELETE TO authenticated USING (true);

-- Realtime for exercise plans
ALTER PUBLICATION supabase_realtime ADD TABLE public.planos_exercicios;
