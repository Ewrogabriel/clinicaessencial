
-- Allow patients to read their own matriculas
CREATE POLICY "matriculas_patient_select"
ON public.matriculas FOR SELECT
USING (
  paciente_id IN (
    SELECT id FROM pacientes WHERE user_id = auth.uid()
  )
);
