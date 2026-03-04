-- Create produtos table
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  preco numeric NOT NULL DEFAULT 0,
  quantidade_estoque integer NOT NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT 'geral',
  imagem_url text,
  permite_reserva boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

-- Create reservas table
CREATE TABLE public.reservas_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativa',
  data_reserva timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  data_limite date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create vendas_produtos table
CREATE TABLE public.vendas_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL,
  valor_total numeric NOT NULL,
  forma_pagamento text,
  status text NOT NULL DEFAULT 'concluida',
  data_venda timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas_produtos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for produtos
CREATE POLICY "produtos_select_all" ON public.produtos FOR SELECT USING (ativo = true OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "produtos_admin_all" ON public.produtos FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- RLS Policies for reservas
CREATE POLICY "reservas_paciente_select" ON public.reservas_produtos FOR SELECT USING (paciente_id IN (SELECT id FROM public.pacientes WHERE created_by = auth.uid()) OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "reservas_paciente_insert" ON public.reservas_produtos FOR INSERT WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE created_by = auth.uid()));

CREATE POLICY "reservas_admin_all" ON public.reservas_produtos FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- RLS Policies for vendas
CREATE POLICY "vendas_select" ON public.vendas_produtos FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin') OR paciente_id IN (SELECT id FROM public.pacientes WHERE created_by = auth.uid()));

CREATE POLICY "vendas_admin_all" ON public.vendas_produtos FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));
