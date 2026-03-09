-- Add validity days to platform_plans
ALTER TABLE public.platform_plans ADD COLUMN IF NOT EXISTS validade_dias integer DEFAULT NULL;

-- Create manual_sections table for AI-generated documentation
CREATE TABLE IF NOT EXISTS public.manual_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  imagem_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_sections ENABLE ROW LEVEL SECURITY;

-- Public read for manual
CREATE POLICY "Anyone can read manual" ON public.manual_sections FOR SELECT USING (true);

-- Only master/admin can manage
CREATE POLICY "Authenticated users can manage manual" ON public.manual_sections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);