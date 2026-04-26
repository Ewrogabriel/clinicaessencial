
-- Tabela para armazenar o site público de cada clínica
CREATE TABLE public.clinic_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL UNIQUE REFERENCES public.clinicas(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  publicado BOOLEAN NOT NULL DEFAULT false,
  -- Configurações visuais
  cor_primaria TEXT,
  cor_secundaria TEXT,
  hero_image_url TEXT,
  -- Seções (JSON estruturado)
  hero JSONB NOT NULL DEFAULT '{"titulo":"","subtitulo":"","cta_label":"Agendar avaliação","cta_url":""}'::jsonb,
  sobre JSONB NOT NULL DEFAULT '{"titulo":"Sobre nós","texto":""}'::jsonb,
  servicos JSONB NOT NULL DEFAULT '{"titulo":"Serviços","itens":[]}'::jsonb,
  equipe_config JSONB NOT NULL DEFAULT '{"titulo":"Nossa equipe","mostrar":true,"profissional_ids":[]}'::jsonb,
  diferenciais JSONB NOT NULL DEFAULT '{"titulo":"Diferenciais","itens":[]}'::jsonb,
  depoimentos JSONB NOT NULL DEFAULT '{"titulo":"Depoimentos","itens":[]}'::jsonb,
  faq JSONB NOT NULL DEFAULT '{"titulo":"Perguntas frequentes","itens":[]}'::jsonb,
  contato JSONB NOT NULL DEFAULT '{"titulo":"Fale conosco","mensagem":"","mostrar_endereco":true,"mostrar_telefone":true,"mostrar_email":true,"mostrar_whatsapp":true}'::jsonb,
  galeria JSONB NOT NULL DEFAULT '{"titulo":"Galeria","imagens":[]}'::jsonb,
  -- SEO
  meta_titulo TEXT,
  meta_descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_sites_slug ON public.clinic_sites(slug);
CREATE INDEX idx_clinic_sites_clinic_id ON public.clinic_sites(clinic_id);

ALTER TABLE public.clinic_sites ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas se publicado
CREATE POLICY "Sites publicados visíveis publicamente"
ON public.clinic_sites FOR SELECT
USING (publicado = true);

-- Membros da clínica podem ver/gerenciar o próprio site
CREATE POLICY "Membros da clínica podem ver o próprio site"
ON public.clinic_sites FOR SELECT
TO authenticated
USING (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admin/gestor podem inserir site"
ON public.clinic_sites FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'master'))
);

CREATE POLICY "Admin/gestor podem atualizar site"
ON public.clinic_sites FOR UPDATE
TO authenticated
USING (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'master'))
);

CREATE POLICY "Admin/gestor podem excluir site"
ON public.clinic_sites FOR DELETE
TO authenticated
USING (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'master'))
);

CREATE TRIGGER update_clinic_sites_updated_at
BEFORE UPDATE ON public.clinic_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC pública para resolver site por slug com dados da clínica + profissionais selecionados
CREATE OR REPLACE FUNCTION public.get_public_clinic_site(p_slug TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site clinic_sites%ROWTYPE;
  v_clinic clinicas%ROWTYPE;
  v_profissionais jsonb;
  v_prof_ids uuid[];
BEGIN
  SELECT * INTO v_site FROM clinic_sites WHERE slug = p_slug AND publicado = true LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_clinic FROM clinicas WHERE id = v_site.clinic_id;

  -- Pega ids selecionados ou todos os profissionais da clínica
  SELECT ARRAY(
    SELECT (jsonb_array_elements_text(v_site.equipe_config->'profissional_ids'))::uuid
  ) INTO v_prof_ids;

  IF v_prof_ids IS NULL OR array_length(v_prof_ids, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT user_id FROM clinic_users WHERE clinic_id = v_site.clinic_id AND role IN ('profissional','admin','gestor')
    ) INTO v_prof_ids;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', p.nome,
    'foto_url', p.foto_url,
    'conselho', p.conselho_profissional,
    'registro', COALESCE(p.registro_conselho, p.registro_profissional),
    'bio', p.bio,
    'especialidades', p.especialidades
  )), '[]'::jsonb) INTO v_profissionais
  FROM profiles p
  WHERE p.user_id = ANY(v_prof_ids);

  RETURN jsonb_build_object(
    'site', to_jsonb(v_site),
    'clinic', jsonb_build_object(
      'nome', v_clinic.nome,
      'logo_url', v_clinic.logo_url,
      'telefone', v_clinic.telefone,
      'whatsapp', v_clinic.whatsapp,
      'email', v_clinic.email,
      'instagram', v_clinic.instagram,
      'endereco', v_clinic.endereco,
      'numero', v_clinic.numero,
      'bairro', v_clinic.bairro,
      'cidade', v_clinic.cidade,
      'estado', v_clinic.estado,
      'cep', v_clinic.cep
    ),
    'profissionais', v_profissionais
  );
END;
$$;
