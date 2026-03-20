
-- NFe provider configuration table
CREATE TABLE IF NOT EXISTS public.config_nfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente text NOT NULL DEFAULT 'homologacao', -- 'homologacao' or 'producao'
  prestador_cnpj text,
  prestador_inscricao_municipal text,
  prestador_codigo_municipio text,
  servico_codigo_tributacao text,
  servico_cnae text,
  servico_item_lista text,
  servico_discriminacao_padrao text DEFAULT 'Serviços de Fisioterapia e Pilates',
  aliquota_iss numeric DEFAULT 5.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.config_nfe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_nfe_admin_all" ON public.config_nfe
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Add Focus NFe reference ID to emissoes_nf
ALTER TABLE public.emissoes_nf ADD COLUMN IF NOT EXISTS focus_nfe_ref text;
ALTER TABLE public.emissoes_nf ADD COLUMN IF NOT EXISTS focus_nfe_status text;
ALTER TABLE public.emissoes_nf ADD COLUMN IF NOT EXISTS focus_nfe_erro text;
