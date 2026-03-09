
-- Table for storing clinical documents (prescriptions, reports, certificates, referrals)
CREATE TABLE public.documentos_clinicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('receituario', 'relatorio', 'atestado', 'encaminhamento')),
  titulo text NOT NULL DEFAULT '',
  conteudo text NOT NULL DEFAULT '',
  profissional_id uuid NOT NULL,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinicas(id),
  dados_extras jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_clinicos ENABLE ROW LEVEL SECURITY;

-- Professionals can CRUD their own documents
CREATE POLICY "doc_prof_select" ON public.documentos_clinicos FOR SELECT TO authenticated
  USING (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "doc_prof_insert" ON public.documentos_clinicos FOR INSERT TO authenticated
  WITH CHECK (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "doc_prof_update" ON public.documentos_clinicos FOR UPDATE TO authenticated
  USING (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "doc_prof_delete" ON public.documentos_clinicos FOR DELETE TO authenticated
  USING (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Patients can view their own documents
CREATE POLICY "doc_patient_select" ON public.documentos_clinicos FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_documentos_clinicos_updated_at
  BEFORE UPDATE ON public.documentos_clinicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
