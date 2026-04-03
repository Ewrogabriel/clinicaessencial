CREATE POLICY "public_document_verification"
ON public.documentos_clinicos
FOR SELECT
TO anon
USING (true);