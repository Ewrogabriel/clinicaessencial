
-- Add user_id column to pacientes so we can link patients to auth users
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_pacientes_user_id ON public.pacientes(user_id);

-- Allow patients to read their own record
CREATE POLICY "pacientes_self_select" ON public.pacientes
  FOR SELECT USING (auth.uid() = user_id);

-- Allow patients to read their own agendamentos
CREATE POLICY "agendamentos_patient_select" ON public.agendamentos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = agendamentos.paciente_id AND p.user_id = auth.uid())
  );

-- Allow patients to update their own agendamentos (for cancel/reschedule)
CREATE POLICY "agendamentos_patient_update" ON public.agendamentos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = agendamentos.paciente_id AND p.user_id = auth.uid())
  );

-- Allow patients to read their own payments
CREATE POLICY "pagamentos_patient_select" ON public.pagamentos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = pagamentos.paciente_id AND p.user_id = auth.uid())
  );

-- Allow patients to read their own planos
CREATE POLICY "planos_patient_select" ON public.planos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = planos.paciente_id AND p.user_id = auth.uid())
  );

-- Allow patients to read their own attachments
CREATE POLICY "attachments_patient_select" ON public.patient_attachments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = patient_attachments.paciente_id AND p.user_id = auth.uid())
  );

-- Allow patients to insert solicitacoes_remarcacao using user_id lookup
DROP POLICY IF EXISTS "solic_paciente_insert" ON public.solicitacoes_remarcacao;
CREATE POLICY "solic_paciente_insert" ON public.solicitacoes_remarcacao
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = solicitacoes_remarcacao.paciente_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "solic_paciente_select" ON public.solicitacoes_remarcacao;
CREATE POLICY "solic_paciente_select" ON public.solicitacoes_remarcacao
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = solicitacoes_remarcacao.paciente_id AND p.user_id = auth.uid())
  );

-- Allow patients to read profiles (for profissional names)
CREATE POLICY "profiles_patient_read" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'paciente'::app_role));
