-- Add convenio_id to pacientes table
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS convenio_id uuid REFERENCES public.convenios(id);

-- Create clinic goals table (metas da clínica)
CREATE TABLE IF NOT EXISTS public.metas_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id),
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'mensal', -- mensal, anual, trimestral, outro
  meta_valor numeric,
  meta_quantidade integer,
  unidade text, -- R$, atendimentos, pacientes, etc
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'ativa', -- ativa, concluida, cancelada
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.metas_clinica ENABLE ROW LEVEL SECURITY;

-- RLS policies for metas_clinica
CREATE POLICY "metas_clinica_admin_all" ON public.metas_clinica
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "metas_clinica_staff_select" ON public.metas_clinica
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'profissional') OR has_role(auth.uid(), 'secretario'));

-- Add ficha PDF fields to ficha_requests table
ALTER TABLE public.ficha_requests
ADD COLUMN IF NOT EXISTS pdf_url text,
ADD COLUMN IF NOT EXISTS pdf_available_until timestamptz;