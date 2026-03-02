
-- Change tipo_atendimento from enum to text in pacientes
ALTER TABLE public.pacientes ALTER COLUMN tipo_atendimento DROP DEFAULT;
ALTER TABLE public.pacientes ALTER COLUMN tipo_atendimento TYPE text USING tipo_atendimento::text;
ALTER TABLE public.pacientes ALTER COLUMN tipo_atendimento SET DEFAULT 'fisioterapia';

-- Change tipo_atendimento from enum to text in agendamentos
ALTER TABLE public.agendamentos ALTER COLUMN tipo_atendimento DROP DEFAULT;
ALTER TABLE public.agendamentos ALTER COLUMN tipo_atendimento TYPE text USING tipo_atendimento::text;
ALTER TABLE public.agendamentos ALTER COLUMN tipo_atendimento SET DEFAULT 'fisioterapia';

-- Change tipo_atendimento from enum to text in planos
ALTER TABLE public.planos ALTER COLUMN tipo_atendimento DROP DEFAULT;
ALTER TABLE public.planos ALTER COLUMN tipo_atendimento TYPE text USING tipo_atendimento::text;
ALTER TABLE public.planos ALTER COLUMN tipo_atendimento SET DEFAULT 'fisioterapia';
