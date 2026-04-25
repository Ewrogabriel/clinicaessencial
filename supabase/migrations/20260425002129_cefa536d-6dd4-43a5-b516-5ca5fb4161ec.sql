-- Public RPC to verify a clinical document by short code or full UUID,
-- bypassing RLS so the public verification page works.
CREATE OR REPLACE FUNCTION public.verify_documento_clinico(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_paciente record;
  v_profissional record;
  v_clinic_nome text;
  v_search text;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN NULL;
  END IF;

  v_search := lower(trim(p_code));

  -- Try exact UUID first
  BEGIN
    SELECT * INTO v_doc
    FROM public.documentos_clinicos
    WHERE id = v_search::uuid
    LIMIT 1;
  EXCEPTION WHEN others THEN
    v_doc := NULL;
  END;

  -- Try short code (first 8 chars of UUID, case-insensitive)
  IF v_doc IS NULL THEN
    SELECT * INTO v_doc
    FROM public.documentos_clinicos
    WHERE lower(substring(id::text, 1, 8)) = v_search
       OR lower(substring(id::text, 1, length(v_search))) = v_search
    LIMIT 1;
  END IF;

  IF v_doc IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, nome, cpf INTO v_paciente
  FROM public.pacientes WHERE id = v_doc.paciente_id;

  SELECT nome, registro_profissional, conselho_profissional, registro_conselho
  INTO v_profissional
  FROM public.profiles WHERE user_id = v_doc.profissional_id;

  SELECT nome INTO v_clinic_nome FROM public.clinic_settings LIMIT 1;

  RETURN jsonb_build_object(
    'documento', jsonb_build_object(
      'id', v_doc.id,
      'tipo', v_doc.tipo,
      'titulo', v_doc.titulo,
      'conteudo', v_doc.conteudo,
      'cid', v_doc.cid,
      'created_at', v_doc.created_at,
      'updated_at', v_doc.updated_at,
      'dados_extras', v_doc.dados_extras,
      'profissional_id', v_doc.profissional_id
    ),
    'paciente', CASE WHEN v_paciente.id IS NULL THEN NULL ELSE jsonb_build_object(
      'nome', v_paciente.nome,
      'cpf', v_paciente.cpf
    ) END,
    'profissional', CASE WHEN v_profissional.nome IS NULL THEN NULL ELSE jsonb_build_object(
      'nome', v_profissional.nome,
      'registro_profissional', v_profissional.registro_profissional,
      'conselho_profissional', v_profissional.conselho_profissional,
      'registro_conselho', v_profissional.registro_conselho
    ) END,
    'clinic_nome', v_clinic_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_documento_clinico(text) TO anon, authenticated;