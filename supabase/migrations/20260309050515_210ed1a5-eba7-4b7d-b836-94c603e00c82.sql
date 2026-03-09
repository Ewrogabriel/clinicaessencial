
-- Tabela de recompensas configuráveis (troca de pontos por descontos)
CREATE TABLE public.rewards_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  pontos_necessarios INTEGER NOT NULL DEFAULT 100,
  tipo TEXT NOT NULL DEFAULT 'desconto_percentual',
  valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  percentual_desconto NUMERIC(5,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  limite_resgates INTEGER,
  validade_dias INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de resgates realizados
CREATE TABLE public.rewards_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  pontos_gastos INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  codigo_desconto TEXT,
  utilizado_em TIMESTAMP WITH TIME ZONE,
  expira_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_redemptions ENABLE ROW LEVEL SECURITY;

-- Catalog: everyone authenticated can read active rewards
CREATE POLICY "Anyone can view active rewards" ON public.rewards_catalog
  FOR SELECT TO authenticated USING (true);

-- Catalog: only admins can manage
CREATE POLICY "Admins manage rewards catalog" ON public.rewards_catalog
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Redemptions: users see own, admins see all
CREATE POLICY "Patients view own redemptions" ON public.rewards_redemptions
  FOR SELECT TO authenticated USING (
    paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Patients can create redemptions" ON public.rewards_redemptions
  FOR INSERT TO authenticated WITH CHECK (
    paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage redemptions" ON public.rewards_redemptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
