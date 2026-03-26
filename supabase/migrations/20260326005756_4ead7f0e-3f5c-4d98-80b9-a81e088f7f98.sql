-- Add clinic_id and importacao_batch_id to pre_cadastros
ALTER TABLE public.pre_cadastros ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinicas(id);
ALTER TABLE public.pre_cadastros ADD COLUMN IF NOT EXISTS importacao_batch_id TEXT;

-- Add assinatura_url and rubrica_url to clinic_settings
ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS assinatura_url TEXT;
ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS rubrica_url TEXT;

-- Add conselho_profissional to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conselho_profissional TEXT;

-- Add CID to documentos_clinicos and evaluations
ALTER TABLE public.documentos_clinicos ADD COLUMN IF NOT EXISTS cid TEXT;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS cid TEXT;

-- Create conselhos_profissionais table
CREATE TABLE IF NOT EXISTS public.conselhos_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conselhos_profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view councils" ON public.conselhos_profissionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage councils" ON public.conselhos_profissionais FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert common professional councils
INSERT INTO public.conselhos_profissionais (nome, sigla) VALUES
  ('Conselho Regional de Fisioterapia e Terapia Ocupacional', 'CREFITO'),
  ('Conselho Regional de Medicina', 'CRM'),
  ('Conselho Regional de Psicologia', 'CRP'),
  ('Conselho Regional de Nutricionistas', 'CRN'),
  ('Conselho Regional de Enfermagem', 'COREN'),
  ('Conselho Regional de Fonoaudiologia', 'CRFa'),
  ('Conselho Regional de Educação Física', 'CREF'),
  ('Conselho Regional de Odontologia', 'CRO'),
  ('Conselho Regional de Biomedicina', 'CRBM'),
  ('Conselho Regional de Farmácia', 'CRF')
ON CONFLICT (sigla) DO NOTHING;

-- Add descricao to recesso_clinica (code uses it but column is motivo)
ALTER TABLE public.recesso_clinica ADD COLUMN IF NOT EXISTS descricao TEXT;