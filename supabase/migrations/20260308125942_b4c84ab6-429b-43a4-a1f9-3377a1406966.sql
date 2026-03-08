
-- Lista de Espera table
CREATE TABLE public.lista_espera (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID,
  tipo_atendimento TEXT NOT NULL DEFAULT 'fisioterapia',
  dia_semana INTEGER[], -- dias preferidos (0=dom, 1=seg...)
  hora_preferida_inicio TIME,
  hora_preferida_fim TIME,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando', -- aguardando, notificado, atendido, cancelado
  notificado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

-- Admin/gestor full access
CREATE POLICY "lista_espera_admin_all" ON public.lista_espera
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Professional can see entries for their specialty
CREATE POLICY "lista_espera_prof_select" ON public.lista_espera
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'profissional'));

-- Patient can see own entries
CREATE POLICY "lista_espera_patient_select" ON public.lista_espera
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid()));

-- Patient can insert own entries
CREATE POLICY "lista_espera_patient_insert" ON public.lista_espera
  FOR INSERT TO authenticated
  WITH CHECK (paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_lista_espera_updated_at
  BEFORE UPDATE ON public.lista_espera
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
