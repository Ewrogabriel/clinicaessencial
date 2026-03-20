-- Table for professional specialties and courses
CREATE TABLE public.profissional_formacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('especialidade', 'curso')),
  nome TEXT NOT NULL,
  instituicao TEXT,
  data_conclusao DATE,
  carga_horaria INTEGER,
  certificado_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profissional_formacoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "formacoes_prof_select" ON public.profissional_formacoes
  FOR SELECT USING (
    profissional_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );

CREATE POLICY "formacoes_prof_insert" ON public.profissional_formacoes
  FOR INSERT WITH CHECK (
    profissional_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "formacoes_prof_update" ON public.profissional_formacoes
  FOR UPDATE USING (
    profissional_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "formacoes_prof_delete" ON public.profissional_formacoes
  FOR DELETE USING (
    profissional_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );