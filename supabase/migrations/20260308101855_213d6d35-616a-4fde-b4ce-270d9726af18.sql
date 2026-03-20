
-- Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formas_pagamento_select_all" ON public.formas_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "formas_pagamento_admin_all" ON public.formas_pagamento FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Criar tabela de configuração PIX
CREATE TABLE IF NOT EXISTS public.config_pix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forma_pagamento_id UUID NOT NULL REFERENCES public.formas_pagamento(id) ON DELETE CASCADE,
  chave_pix VARCHAR(255) NOT NULL,
  tipo_chave VARCHAR(20) NOT NULL,
  nome_beneficiario VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.config_pix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_pix_select_all" ON public.config_pix FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_pix_admin_all" ON public.config_pix FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Criar tabela de pagamentos de mensalidade
CREATE TABLE IF NOT EXISTS public.pagamentos_mensalidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  matricula_id UUID,
  mes_referencia DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id),
  status VARCHAR(50) DEFAULT 'aberto',
  data_pagamento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(paciente_id, mes_referencia)
);

ALTER TABLE public.pagamentos_mensalidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pag_mensalidade_admin_all" ON public.pagamentos_mensalidade FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "pag_mensalidade_patient_select" ON public.pagamentos_mensalidade FOR SELECT TO authenticated USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Criar tabela de pagamentos de sessões
CREATE TABLE IF NOT EXISTS public.pagamentos_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  agendamento_id UUID,
  valor DECIMAL(10, 2) NOT NULL,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id),
  status VARCHAR(50) DEFAULT 'aberto',
  data_pagamento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pagamentos_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pag_sessoes_admin_all" ON public.pagamentos_sessoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "pag_sessoes_patient_select" ON public.pagamentos_sessoes FOR SELECT TO authenticated USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_ativo ON public.formas_pagamento(ativo);
CREATE INDEX IF NOT EXISTS idx_config_pix_forma ON public.config_pix(forma_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mensalidade_paciente ON public.pagamentos_mensalidade(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mensalidade_status ON public.pagamentos_mensalidade(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_sessoes_paciente ON public.pagamentos_sessoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_sessoes_status ON public.pagamentos_sessoes(status);

-- Inserir formas de pagamento padrão
INSERT INTO public.formas_pagamento (nome, descricao, tipo, ordem) VALUES
  ('PIX', 'Transferência instantânea via PIX', 'pix', 1),
  ('Cartão de Crédito', 'Pagamento com cartão de crédito', 'cartao', 2),
  ('Dinheiro', 'Pagamento em dinheiro', 'dinheiro', 3),
  ('Boleto Bancário', 'Pagamento via boleto', 'boleto', 4),
  ('Cheque', 'Pagamento com cheque', 'cheque', 5)
ON CONFLICT DO NOTHING;
