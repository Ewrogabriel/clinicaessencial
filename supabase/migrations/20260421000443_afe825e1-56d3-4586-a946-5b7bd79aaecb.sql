
-- Permitir que o paciente envie seus próprios anexos
CREATE POLICY "attachments_patient_insert"
ON public.patient_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = patient_attachments.paciente_id
      AND p.user_id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

-- Permitir que o paciente apague apenas os anexos que ele mesmo enviou
CREATE POLICY "attachments_patient_delete_own"
ON public.patient_attachments
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = patient_attachments.paciente_id
      AND p.user_id = auth.uid()
  )
);

-- Storage: permitir que o paciente envie/baixe arquivos da sua pasta no bucket patient-documents
-- A pasta é o próprio paciente.id; verificamos se o usuário autenticado é o dono daquele paciente.
CREATE POLICY "patient_uploads_own_folder_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id = auth.uid()
      AND p.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "patient_uploads_own_folder_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id = auth.uid()
      AND p.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "patient_uploads_own_folder_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id = auth.uid()
      AND p.id::text = (storage.foldername(name))[1]
  )
);
