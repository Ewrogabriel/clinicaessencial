
-- Table to track monthly commission closings per professional
CREATE TABLE public.fechamentos_comissao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL,
  mes_referencia DATE NOT NULL,
  total_atendimentos INTEGER NOT NULL DEFAULT 0,
  total_valor NUMERIC NOT NULL DEFAULT 0,
  total_comissao NUMERIC NOT NULL DEFAULT 0,
  compensacao_anterior NUMERIC NOT NULL DEFAULT 0,
  descricao_compensacao TEXT,
  valor_final NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'fechado',
  fechado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profissional_id, mes_referencia)
);

-- Enable RLS
ALTER TABLE public.fechamentos_comissao ENABLE ROW LEVEL SECURITY;

-- Admin/Gestor full access
CREATE POLICY "fechamentos_admin_all" ON public.fechamentos_comissao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Professional can read their own
CREATE POLICY "fechamentos_prof_select" ON public.fechamentos_comissao
  FOR SELECT TO authenticated
  USING (profissional_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fechamentos_comissao;
