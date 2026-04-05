
-- =====================================================
-- 1. Expand professional SELECT on evolutions
-- =====================================================
DROP POLICY IF EXISTS "evolutions_prof_select" ON public.evolutions;
CREATE POLICY "evolutions_prof_select" ON public.evolutions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = evolutions.clinic_id
    )
  );

-- =====================================================
-- 2. Expand professional SELECT on evaluations
-- =====================================================
DROP POLICY IF EXISTS "evaluations_prof_select" ON public.evaluations;
CREATE POLICY "evaluations_prof_select" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = evaluations.clinic_id
    )
  );

-- =====================================================
-- 3. Expand professional SELECT on documentos_clinicos
-- =====================================================
DROP POLICY IF EXISTS "doc_prof_select" ON public.documentos_clinicos;
CREATE POLICY "doc_prof_select" ON public.documentos_clinicos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = documentos_clinicos.clinic_id
    )
  );

-- =====================================================
-- 4. Expand professional SELECT on planos (no clinic_id, join via paciente)
-- =====================================================
DROP POLICY IF EXISTS "planos_prof_select" ON public.planos;
CREATE POLICY "planos_prof_select" ON public.planos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_pacientes cp
      JOIN clinic_users cu ON cu.clinic_id = cp.clinic_id
      WHERE cp.paciente_id = planos.paciente_id AND cu.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. Expand professional SELECT on matriculas
-- =====================================================
DROP POLICY IF EXISTS "matriculas_prof_select" ON public.matriculas;
CREATE POLICY "matriculas_prof_select" ON public.matriculas
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = matriculas.clinic_id
    )
  );

-- =====================================================
-- 6. Expand professional SELECT on pagamentos
-- =====================================================
DROP POLICY IF EXISTS "pagamentos_prof_select" ON public.pagamentos;
CREATE POLICY "pagamentos_prof_select" ON public.pagamentos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = pagamentos.clinic_id
    )
  );

-- =====================================================
-- 7. Expand professional SELECT on agendamentos (all clinic)
-- =====================================================
DROP POLICY IF EXISTS "agendamentos_prof_select" ON public.agendamentos;
CREATE POLICY "agendamentos_prof_select" ON public.agendamentos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = agendamentos.clinic_id
    )
  );

-- =====================================================
-- 8. Expand professional SELECT on contratos_digitais
-- =====================================================
DROP POLICY IF EXISTS "contratos_digitais_prof_select" ON public.contratos_digitais;
CREATE POLICY "contratos_digitais_prof_select" ON public.contratos_digitais
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM clinic_users cu
      WHERE cu.user_id = auth.uid() AND cu.clinic_id = contratos_digitais.clinic_id
    )
  );

-- =====================================================
-- 9. Storage: ensure clinic-uploads is publicly readable
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'clinic-uploads'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-uploads', 'clinic-uploads', true);
  ELSE
    UPDATE storage.buckets SET public = true WHERE id = 'clinic-uploads';
  END IF;
END $$;

-- Allow anyone to read from clinic-uploads (public receipts)
DROP POLICY IF EXISTS "clinic_uploads_public_read" ON storage.objects;
CREATE POLICY "clinic_uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-uploads');

-- Allow authenticated users to upload to clinic-uploads
DROP POLICY IF EXISTS "clinic_uploads_auth_insert" ON storage.objects;
CREATE POLICY "clinic_uploads_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-uploads');
