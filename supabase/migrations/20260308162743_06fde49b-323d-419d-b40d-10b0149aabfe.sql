
-- Add bonus fields to fechamentos_comissao
ALTER TABLE public.fechamentos_comissao 
  ADD COLUMN bonus_valor NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN bonus_descricao TEXT;

-- Add categoria to convenios
ALTER TABLE public.convenios 
  ADD COLUMN categoria TEXT;

-- Create categorias_parceiros table for managing categories
CREATE TABLE public.categorias_parceiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.categorias_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_parceiros_admin_all" ON public.categorias_parceiros
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "categorias_parceiros_select_all" ON public.categorias_parceiros
  FOR SELECT TO authenticated
  USING (true);
