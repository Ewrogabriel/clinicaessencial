CREATE POLICY "agendamentos_patient_insert"
ON public.agendamentos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = agendamentos.paciente_id
      AND p.user_id = auth.uid()
  )
);