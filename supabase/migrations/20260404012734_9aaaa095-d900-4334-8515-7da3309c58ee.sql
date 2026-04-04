
-- Allow professionals and gestors to see patients in their clinics
CREATE POLICY "pacientes_clinic_member_select" ON public.pacientes
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.clinic_pacientes cp
    JOIN public.clinic_users cu ON cu.clinic_id = cp.clinic_id
    WHERE cp.paciente_id = pacientes.id
      AND cu.user_id = auth.uid()
  )
);

-- Allow professionals to read clinic_pacientes for their clinics
CREATE POLICY "clinic_pacientes_member_select" ON public.clinic_pacientes
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.clinic_users cu
    WHERE cu.clinic_id = clinic_pacientes.clinic_id
      AND cu.user_id = auth.uid()
  )
);
