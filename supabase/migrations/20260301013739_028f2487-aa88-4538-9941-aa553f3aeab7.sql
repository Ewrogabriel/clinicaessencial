
-- Create evaluations table
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  queixa_principal TEXT NOT NULL,
  historico_doenca TEXT,
  antecedentes_pessoais TEXT,
  objetivos_tratamento TEXT,
  conduta_inicial TEXT,
  data_avaliacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver evaluations" ON public.evaluations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem inserir evaluations" ON public.evaluations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem atualizar evaluations" ON public.evaluations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Profissionais veem suas evaluations" ON public.evaluations FOR SELECT USING (profissional_id = auth.uid());
CREATE POLICY "Profissionais podem inserir evaluations" ON public.evaluations FOR INSERT WITH CHECK (profissional_id = auth.uid());

-- Create evolutions table
CREATE TABLE IF NOT EXISTS public.evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  conduta TEXT,
  data_evolucao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver evolutions" ON public.evolutions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem inserir evolutions" ON public.evolutions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem atualizar evolutions" ON public.evolutions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Profissionais veem suas evolutions" ON public.evolutions FOR SELECT USING (profissional_id = auth.uid());
CREATE POLICY "Profissionais podem inserir evolutions" ON public.evolutions FOR INSERT WITH CHECK (profissional_id = auth.uid());

-- Add foreign key for evolutions -> profiles
ALTER TABLE public.evolutions ADD CONSTRAINT evolutions_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES auth.users(id);

-- Create avisos table
CREATE TABLE IF NOT EXISTS public.avisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver avisos" ON public.avisos FOR SELECT USING (true);
CREATE POLICY "Admins podem inserir avisos" ON public.avisos FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem atualizar avisos" ON public.avisos FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem deletar avisos" ON public.avisos FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento TIMESTAMP WITH TIME ZONE,
  categoria TEXT DEFAULT 'outros',
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver expenses" ON public.expenses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem inserir expenses" ON public.expenses FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem atualizar expenses" ON public.expenses FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem deletar expenses" ON public.expenses FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create commissions table
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  agendamento_id UUID REFERENCES public.agendamentos(id),
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver commissions" ON public.commissions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem inserir commissions" ON public.commissions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem atualizar commissions" ON public.commissions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Profissionais veem suas commissions" ON public.commissions FOR SELECT USING (professional_id = auth.uid());
