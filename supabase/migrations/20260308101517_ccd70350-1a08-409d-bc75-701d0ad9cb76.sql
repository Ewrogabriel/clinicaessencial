
CREATE TABLE IF NOT EXISTS public.solicitacoes_alteracao_dados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  dados_atuais jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados_novos jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  motivo text,
  aprovador_id uuid,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE public.solicitacoes_alteracao_dados ENABLE ROW LEVEL SECURITY;

-- Pacientes podem ver suas próprias solicitações
CREATE POLICY "Pacientes veem suas solicitacoes"
  ON public.solicitacoes_alteracao_dados
  FOR SELECT TO authenticated
  USING (
    paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
  );

-- Pacientes podem criar solicitações
CREATE POLICY "Pacientes criam solicitacoes"
  ON public.solicitacoes_alteracao_dados
  FOR INSERT TO authenticated
  WITH CHECK (
    paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
  );

-- Admins e gestores podem ver todas
CREATE POLICY "Admins veem todas solicitacoes"
  ON public.solicitacoes_alteracao_dados
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  );

-- Admins e gestores podem atualizar (aprovar/rejeitar)
CREATE POLICY "Admins atualizam solicitacoes"
  ON public.solicitacoes_alteracao_dados
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  );
