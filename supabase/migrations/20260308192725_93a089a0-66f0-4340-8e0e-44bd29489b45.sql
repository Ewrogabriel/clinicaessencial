
-- 1) LGPD consent fields on pacientes
ALTER TABLE public.pacientes 
  ADD COLUMN IF NOT EXISTS lgpd_consentimento boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lgpd_consentimento_data timestamp with time zone;

-- 2) NPS satisfaction survey table
CREATE TABLE public.pesquisa_satisfacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nota integer NOT NULL CHECK (nota >= 0 AND nota <= 10),
  comentario text,
  clinic_id uuid REFERENCES public.clinicas(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pesquisa_satisfacao ENABLE ROW LEVEL SECURITY;

-- Patients can insert their own
CREATE POLICY "nps_patient_insert" ON public.pesquisa_satisfacao
  FOR INSERT TO authenticated
  WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Patients can view their own
CREATE POLICY "nps_patient_select" ON public.pesquisa_satisfacao
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Admin/gestor full access
CREATE POLICY "nps_admin_all" ON public.pesquisa_satisfacao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
