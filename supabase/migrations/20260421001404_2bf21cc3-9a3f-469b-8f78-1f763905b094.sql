-- Reverter políticas adicionadas indevidamente para anexos de pacientes (eram para profissionais)
DROP POLICY IF EXISTS "attachments_patient_insert" ON public.patient_attachments;
DROP POLICY IF EXISTS "attachments_patient_delete_own" ON public.patient_attachments;
DROP POLICY IF EXISTS "patient_uploads_own_folder_insert" ON storage.objects;
DROP POLICY IF EXISTS "patient_uploads_own_folder_select" ON storage.objects;
DROP POLICY IF EXISTS "patient_uploads_own_folder_delete" ON storage.objects;

-- Storage: o profissional pode enviar/ver/apagar arquivos da própria pasta no bucket professional-documents.
-- A pasta é o user.id do profissional autenticado (1º segmento do path).
CREATE POLICY "professional_docs_self_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'professional-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "professional_docs_self_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'professional-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "professional_docs_self_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'professional-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "professional_docs_admin_all"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'professional-documents'
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'professional-documents'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);