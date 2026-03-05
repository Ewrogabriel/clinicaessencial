
-- Create matriculas table
CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'mensal',
  tipo_atendimento text NOT NULL DEFAULT 'pilates',
  valor_mensal numeric NOT NULL DEFAULT 0,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date,
  due_day integer NOT NULL DEFAULT 10,
  auto_renew boolean NOT NULL DEFAULT true,
  observacoes text,
  desconto numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa',
  cancellation_date date,
  criada_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create weekly_schedules table
CREATE TABLE public.weekly_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  weekday integer NOT NULL,
  time text NOT NULL,
  professional_id uuid NOT NULL,
  session_duration integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add enrollment_id to agendamentos (nullable FK)
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.matriculas(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;

-- RLS for matriculas
CREATE POLICY "matriculas_admin_all" ON public.matriculas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "matriculas_prof_select" ON public.matriculas FOR SELECT TO authenticated
  USING (profissional_id = auth.uid());

CREATE POLICY "matriculas_prof_insert" ON public.matriculas FOR INSERT TO authenticated
  WITH CHECK (profissional_id = auth.uid());

-- RLS for weekly_schedules
CREATE POLICY "weekly_schedules_admin_all" ON public.weekly_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "weekly_schedules_select" ON public.weekly_schedules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "weekly_schedules_insert" ON public.weekly_schedules FOR INSERT TO authenticated
  WITH CHECK (true);
