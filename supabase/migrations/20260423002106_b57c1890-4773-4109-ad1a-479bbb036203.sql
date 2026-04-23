-- Tabela de notas fiscais
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  mes_referencia TEXT NOT NULL,
  data_upload TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID,
  status TEXT NOT NULL DEFAULT 'ativo',
  hash_arquivo TEXT,
  tamanho_bytes BIGINT,
  public_token TEXT UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  enviado_via TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_paciente ON public.notas_fiscais(paciente_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_clinic ON public.notas_fiscais(clinic_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_mes ON public.notas_fiscais(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_token ON public.notas_fiscais(public_token);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_hash ON public.notas_fiscais(clinic_id, hash_arquivo);

-- Trigger updated_at
CREATE TRIGGER trg_notas_fiscais_updated
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Equipe da clínica pode ver/gerenciar
CREATE POLICY "Equipe pode ver notas fiscais da clinica"
ON public.notas_fiscais FOR SELECT
USING (
  clinic_id IS NULL OR public.user_has_clinic_access(auth.uid(), clinic_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'master')
);

CREATE POLICY "Equipe pode inserir notas fiscais"
ON public.notas_fiscais FOR INSERT
WITH CHECK (
  clinic_id IS NULL OR public.user_has_clinic_access(auth.uid(), clinic_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'master')
);

CREATE POLICY "Equipe pode atualizar notas fiscais"
ON public.notas_fiscais FOR UPDATE
USING (
  clinic_id IS NULL OR public.user_has_clinic_access(auth.uid(), clinic_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'master')
);

CREATE POLICY "Equipe pode deletar notas fiscais"
ON public.notas_fiscais FOR DELETE
USING (
  clinic_id IS NULL OR public.user_has_clinic_access(auth.uid(), clinic_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'master')
);

-- Paciente pode ver suas próprias notas
CREATE POLICY "Paciente vê suas notas fiscais"
ON public.notas_fiscais FOR SELECT
USING (
  paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
);

-- Bucket de storage privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: equipe gerencia
CREATE POLICY "Equipe upload notas fiscais"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'notas-fiscais' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Equipe lê notas fiscais"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'notas-fiscais' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Equipe deleta notas fiscais"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'notas-fiscais' AND auth.uid() IS NOT NULL
);

-- Função pública para acesso via token (sem autenticação)
CREATE OR REPLACE FUNCTION public.get_nota_fiscal_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_nota RECORD;
  v_paciente RECORD;
  v_clinic RECORD;
  v_signed_url TEXT;
BEGIN
  SELECT * INTO v_nota
  FROM public.notas_fiscais
  WHERE public_token = p_token
    AND status = 'ativo'
    AND (public_token_expires_at IS NULL OR public_token_expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, nome INTO v_paciente FROM public.pacientes WHERE id = v_nota.paciente_id;
  SELECT nome, logo_url FROM public.clinic_settings LIMIT 1 INTO v_clinic;

  RETURN jsonb_build_object(
    'id', v_nota.id,
    'nome_arquivo', v_nota.nome_arquivo,
    'arquivo_path', v_nota.arquivo_path,
    'mes_referencia', v_nota.mes_referencia,
    'data_upload', v_nota.data_upload,
    'paciente_nome', v_paciente.nome,
    'clinic_nome', v_clinic.nome,
    'clinic_logo', v_clinic.logo_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nota_fiscal_by_token(TEXT) TO anon, authenticated;