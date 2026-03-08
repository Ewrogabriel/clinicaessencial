
-- Commission rules table per professional
CREATE TABLE public.regras_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL,
  tipo_atendimento text NOT NULL DEFAULT 'geral',
  percentual numeric DEFAULT 0,
  valor_fixo numeric DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.regras_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_comissao_admin_all" ON public.regras_comissao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "regras_comissao_gestor_all" ON public.regras_comissao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "regras_comissao_prof_select" ON public.regras_comissao
  FOR SELECT TO authenticated
  USING (profissional_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER regras_comissao_updated_at
  BEFORE UPDATE ON public.regras_comissao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
