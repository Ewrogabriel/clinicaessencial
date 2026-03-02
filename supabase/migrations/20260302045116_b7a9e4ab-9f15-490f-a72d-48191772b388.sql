
-- Add professional profile fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS foto_url text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS graduacao text,
ADD COLUMN IF NOT EXISTS especializacoes text[],
ADD COLUMN IF NOT EXISTS cursos text[],
ADD COLUMN IF NOT EXISTS especialidade text,
ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_fixed numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS registro_profissional text;

-- Create professional documents table
CREATE TABLE public.professional_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_documents ENABLE ROW LEVEL SECURITY;

-- Only admin and the professional themselves can see documents
CREATE POLICY "prof_docs_admin_all" ON public.professional_documents
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "prof_docs_self_select" ON public.professional_documents
FOR SELECT USING (profissional_id = auth.uid());

CREATE POLICY "prof_docs_self_insert" ON public.professional_documents
FOR INSERT WITH CHECK (profissional_id = auth.uid());

CREATE POLICY "prof_docs_self_delete" ON public.professional_documents
FOR DELETE USING (profissional_id = auth.uid());

-- Create storage bucket for professional documents
INSERT INTO storage.buckets (id, name, public) VALUES ('professional-documents', 'professional-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "prof_docs_storage_select" ON storage.objects
FOR SELECT USING (bucket_id = 'professional-documents' AND (
  has_role(auth.uid(), 'admin'::app_role) OR
  auth.uid()::text = (storage.foldername(name))[1]
));

CREATE POLICY "prof_docs_storage_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'professional-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "prof_docs_storage_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'professional-documents' AND (
  has_role(auth.uid(), 'admin'::app_role) OR
  auth.uid()::text = (storage.foldername(name))[1]
));

-- Add gestor role to commissions policies
CREATE POLICY "commissions_gestor_select" ON public.commissions
FOR SELECT USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "commissions_gestor_insert" ON public.commissions
FOR INSERT WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "commissions_gestor_update" ON public.commissions
FOR UPDATE USING (has_role(auth.uid(), 'gestor'::app_role));

-- Allow professionals to read profiles (for patient viewing professional profiles)
CREATE POLICY "profiles_prof_select" ON public.profiles
FOR SELECT USING (has_role(auth.uid(), 'profissional'::app_role));
