-- Criar políticas RLS para o bucket essencialfisiopilatesbq

-- Permitir admins/gestores fazerem upload
CREATE POLICY "storage_clinic_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'essencialfisiopilatesbq' 
  AND (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'gestor')
  )
);

-- Permitir admins/gestores atualizarem arquivos
CREATE POLICY "storage_clinic_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'essencialfisiopilatesbq'
  AND (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'gestor')
  )
);

-- Permitir admins/gestores deletarem arquivos
CREATE POLICY "storage_clinic_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'essencialfisiopilatesbq'
  AND (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'gestor')
  )
);

-- Permitir leitura pública (bucket já é público, mas garantimos)
CREATE POLICY "storage_clinic_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'essencialfisiopilatesbq');