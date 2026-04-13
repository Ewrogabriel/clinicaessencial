
-- 1. Create despesas table
CREATE TABLE IF NOT EXISTS public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinicas(id),
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT,
  data_vencimento DATE,
  data_pagamento TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pendente',
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage despesas" ON public.despesas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Add missing columns to fechamentos_comissao
ALTER TABLE public.fechamentos_comissao ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.fechamentos_comissao ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinicas(id);

-- 3. Add observacoes to commissions
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 4. Create partner_applications table for public form
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  empresa TEXT,
  telefone TEXT,
  email TEXT NOT NULL,
  categoria TEXT,
  mensagem TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert partner applications" ON public.partner_applications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view partner applications" ON public.partner_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update partner applications" ON public.partner_applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
