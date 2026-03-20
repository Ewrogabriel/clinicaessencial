
-- Add tipo column to lista_espera to distinguish between waiting list and interest list
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'espera';
-- Add matricula_id for patients who want to change their existing enrollment schedule
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS matricula_id uuid REFERENCES public.matriculas(id) ON DELETE SET NULL;

-- Create table for schedule change approval requests
CREATE TABLE public.solicitacoes_mudanca_horario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_espera_id uuid NOT NULL REFERENCES public.lista_espera(id) ON DELETE CASCADE,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  dia_semana_atual integer[],
  horario_atual text,
  dia_semana_novo integer[] NOT NULL,
  horario_novo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  aprovador_id uuid,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.solicitacoes_mudanca_horario ENABLE ROW LEVEL SECURITY;

-- Admin/gestor full access
CREATE POLICY "mudanca_horario_admin_all" ON public.solicitacoes_mudanca_horario
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Professionals can view
CREATE POLICY "mudanca_horario_prof_select" ON public.solicitacoes_mudanca_horario
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'profissional'));

-- Patients can view their own
CREATE POLICY "mudanca_horario_patient_select" ON public.solicitacoes_mudanca_horario
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid()));

-- Patients can insert their own
CREATE POLICY "mudanca_horario_patient_insert" ON public.solicitacoes_mudanca_horario
  FOR INSERT TO authenticated
  WITH CHECK (paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid()));
