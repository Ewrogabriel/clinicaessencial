
-- Create contrato_templates table
CREATE TABLE IF NOT EXISTS public.contrato_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinicas(id),
  nome TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'paciente',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage templates for their clinic"
  ON public.contrato_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add status_clinico and ultima_avaliacao_data to pacientes
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS status_clinico TEXT DEFAULT 'Sem avaliação';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS ultima_avaliacao_data DATE;
