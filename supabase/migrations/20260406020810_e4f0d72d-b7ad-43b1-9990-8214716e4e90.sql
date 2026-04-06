
-- Drop the existing prof-only select policy and recreate to include admin/gestor
DROP POLICY IF EXISTS "doc_prof_select" ON public.documentos_clinicos;

CREATE POLICY "doc_clinic_select" ON public.documentos_clinicos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clinic_users cu
    WHERE cu.user_id = auth.uid() AND cu.clinic_id = documentos_clinicos.clinic_id
  )
);

-- Update delete/update policies to also allow gestor
DROP POLICY IF EXISTS "doc_prof_delete" ON public.documentos_clinicos;
CREATE POLICY "doc_prof_delete" ON public.documentos_clinicos
FOR DELETE TO authenticated
USING (
  profissional_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

DROP POLICY IF EXISTS "doc_prof_update" ON public.documentos_clinicos;
CREATE POLICY "doc_prof_update" ON public.documentos_clinicos
FOR UPDATE TO authenticated
USING (
  profissional_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

-- Also allow admin/gestor to insert
DROP POLICY IF EXISTS "doc_prof_insert" ON public.documentos_clinicos;
CREATE POLICY "doc_prof_insert" ON public.documentos_clinicos
FOR INSERT TO authenticated
WITH CHECK (
  profissional_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);
