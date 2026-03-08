-- Create convenios table
CREATE TABLE public.convenios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  telefone text,
  whatsapp text,
  email text,
  site text,
  instagram text,
  endereco text,
  imagem_card_url text,
  imagem_descricao_url text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "convenios_admin_all" ON public.convenios FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Everyone can read active
CREATE POLICY "convenios_select_active" ON public.convenios FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER set_convenios_updated_at
  BEFORE UPDATE ON public.convenios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for convenio images
INSERT INTO storage.buckets (id, name, public) VALUES ('convenios', 'convenios', true);

-- Storage policies
CREATE POLICY "convenios_images_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'convenios');

CREATE POLICY "convenios_images_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'convenios' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "convenios_images_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'convenios' AND has_role(auth.uid(), 'admin'));