CREATE TABLE public.contratos_digitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  assinatura_url text,
  assinado_em timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_digitais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_digitais_admin_all" ON public.contratos_digitais
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "contratos_digitais_prof_insert" ON public.contratos_digitais
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'profissional'));

CREATE POLICY "contratos_digitais_prof_select" ON public.contratos_digitais
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'profissional'));

CREATE POLICY "contratos_digitais_patient_select" ON public.contratos_digitais
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));