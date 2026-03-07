
-- Allow anon users to query pacientes by codigo_acesso (for login flow)
CREATE POLICY "pacientes_anon_select_by_code" ON public.pacientes
  FOR SELECT TO anon
  USING (codigo_acesso IS NOT NULL);
