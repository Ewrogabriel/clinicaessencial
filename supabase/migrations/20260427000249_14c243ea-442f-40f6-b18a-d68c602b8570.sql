-- 1) Tabela reschedule_credits (não foi criada anteriormente)
CREATE TABLE IF NOT EXISTS public.reschedule_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  generated_from_session_id UUID NOT NULL,
  expiration_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  used_for_session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reschedule_credits_enrollment_id ON public.reschedule_credits(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_credits_status ON public.reschedule_credits(status);

ALTER TABLE public.reschedule_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reschedule_credits_authenticated" ON public.reschedule_credits;
CREATE POLICY "reschedule_credits_authenticated" ON public.reschedule_credits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reschedule_credits_updated_at') THEN
    CREATE TRIGGER update_reschedule_credits_updated_at
      BEFORE UPDATE ON public.reschedule_credits
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Corrigir get_public_clinic_site (coluna correta é "especialidade", não "especialidades")
CREATE OR REPLACE FUNCTION public.get_public_clinic_site(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_site clinic_sites%ROWTYPE;
  v_clinic clinicas%ROWTYPE;
  v_profissionais jsonb;
  v_prof_ids uuid[];
BEGIN
  SELECT * INTO v_site FROM clinic_sites WHERE slug = p_slug AND publicado = true LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_clinic FROM clinicas WHERE id = v_site.clinic_id;

  SELECT ARRAY(
    SELECT (jsonb_array_elements_text(v_site.equipe_config->'profissional_ids'))::uuid
  ) INTO v_prof_ids;

  IF v_prof_ids IS NULL OR array_length(v_prof_ids, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT user_id FROM clinic_users
      WHERE clinic_id = v_site.clinic_id AND role IN ('profissional','admin','gestor')
    ) INTO v_prof_ids;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', p.nome,
    'foto_url', p.foto_url,
    'conselho', p.conselho_profissional,
    'registro', COALESCE(p.registro_conselho, p.registro_profissional),
    'bio', p.bio,
    'especialidades', p.especialidade
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
$function$;