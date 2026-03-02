
-- Create table for patient document attachments
CREATE TABLE public.patient_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_attachments ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "attachments_admin_all" ON public.patient_attachments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Profissional can manage attachments for their patients
CREATE POLICY "attachments_prof_select" ON public.patient_attachments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = patient_attachments.paciente_id AND p.profissional_id = auth.uid())
  );

CREATE POLICY "attachments_prof_insert" ON public.patient_attachments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = patient_attachments.paciente_id AND p.profissional_id = auth.uid())
  );

CREATE POLICY "attachments_prof_delete" ON public.patient_attachments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = patient_attachments.paciente_id AND p.profissional_id = auth.uid())
  );

-- Create storage bucket for patient documents
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false);

-- Storage policies
CREATE POLICY "patient_docs_auth_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'patient-documents' AND auth.role() = 'authenticated');

CREATE POLICY "patient_docs_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'patient-documents' AND auth.role() = 'authenticated');

CREATE POLICY "patient_docs_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'patient-documents' AND auth.role() = 'authenticated');
