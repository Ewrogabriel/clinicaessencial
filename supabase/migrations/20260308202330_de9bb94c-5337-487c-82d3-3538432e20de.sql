
CREATE TABLE IF NOT EXISTS public.equipamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  marca text,
  modelo text,
  cor text,
  quantidade integer NOT NULL DEFAULT 1,
  descricao text,
  tipo text NOT NULL DEFAULT 'equipamento',
  e_consumo boolean NOT NULL DEFAULT false,
  estoque_atual integer DEFAULT 0,
  estoque_minimo integer DEFAULT 0,
  data_aquisicao date,
  data_ultima_revisao date,
  data_proxima_revisao date,
  observacoes_manutencao text,
  status text NOT NULL DEFAULT 'ativo',
  foto_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipamentos_admin_all" ON public.equipamentos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "equipamentos_staff_select" ON public.equipamentos FOR SELECT
  USING (has_role(auth.uid(), 'profissional'::app_role) OR has_role(auth.uid(), 'secretario'::app_role));

CREATE INDEX idx_equipamentos_clinic ON public.equipamentos(clinic_id);
CREATE INDEX idx_equipamentos_tipo ON public.equipamentos(tipo);
CREATE INDEX idx_equipamentos_status ON public.equipamentos(status);
