
-- =============================================
-- FASE 3: Planos de Sessões
-- =============================================

CREATE TYPE public.status_plano AS ENUM ('ativo', 'vencido', 'cancelado', 'finalizado');
CREATE TYPE public.forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia');
CREATE TYPE public.status_pagamento AS ENUM ('pendente', 'pago', 'cancelado');

-- Tabela de Planos (pacotes de sessões)
CREATE TABLE public.planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  tipo_atendimento public.tipo_atendimento NOT NULL DEFAULT 'fisioterapia',
  total_sessoes INTEGER NOT NULL DEFAULT 10,
  sessoes_utilizadas INTEGER NOT NULL DEFAULT 0,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  status public.status_plano NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os planos"
  ON public.planos FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais veem seus planos"
  ON public.planos FOR SELECT
  USING (profissional_id = auth.uid());

CREATE POLICY "Admins podem inserir planos"
  ON public.planos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais podem inserir seus planos"
  ON public.planos FOR INSERT
  WITH CHECK (profissional_id = auth.uid());

CREATE POLICY "Admins podem atualizar planos"
  ON public.planos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais podem atualizar seus planos"
  ON public.planos FOR UPDATE
  USING (profissional_id = auth.uid());

CREATE POLICY "Admins podem deletar planos"
  ON public.planos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 4: Financeiro / Pagamentos
-- =============================================

CREATE TABLE public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  profissional_id UUID NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  forma_pagamento public.forma_pagamento,
  status public.status_pagamento NOT NULL DEFAULT 'pendente',
  descricao TEXT,
  observacoes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os pagamentos"
  ON public.pagamentos FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais veem seus pagamentos"
  ON public.pagamentos FOR SELECT
  USING (profissional_id = auth.uid());

CREATE POLICY "Admins podem inserir pagamentos"
  ON public.pagamentos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais podem inserir seus pagamentos"
  ON public.pagamentos FOR INSERT
  WITH CHECK (profissional_id = auth.uid());

CREATE POLICY "Admins podem atualizar pagamentos"
  ON public.pagamentos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais podem atualizar seus pagamentos"
  ON public.pagamentos FOR UPDATE
  USING (profissional_id = auth.uid());

CREATE POLICY "Admins podem deletar pagamentos"
  ON public.pagamentos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
