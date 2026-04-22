
-- 1. Adicionar colunas de preferências de contrato em clinic_settings
ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS pref_contract_multa_atraso_pct numeric DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pref_contract_juros_mensal_pct numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pref_contract_prazo_cancelamento_h integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS pref_contract_dia_vencimento integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS pref_contract_prazo_reposicao_dias integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pref_contract_vigencia_meses integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS pref_contract_raio_nao_concorrencia_km numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pref_contract_multa_nao_captacao_fator numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS pref_contract_multa_nao_captacao_valor numeric,
  ADD COLUMN IF NOT EXISTS pref_contract_dia_pagamento_comissao integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS pref_contract_prazo_aviso_previo_dias integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pref_contract_multa_uso_marca_valor numeric DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS pref_contract_cidade_foro text,
  ADD COLUMN IF NOT EXISTS pref_contract_estado_foro text,
  ADD COLUMN IF NOT EXISTS pref_contract_enrollment_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pref_contract_witness1_name text,
  ADD COLUMN IF NOT EXISTS pref_contract_witness1_cpf text,
  ADD COLUMN IF NOT EXISTS pref_contract_witness2_name text,
  ADD COLUMN IF NOT EXISTS pref_contract_witness2_cpf text;

-- 2. Adicionar colunas de preferências por paciente (overrides) em pacientes
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS contract_multa_atraso_pct numeric,
  ADD COLUMN IF NOT EXISTS contract_juros_mensal_pct numeric,
  ADD COLUMN IF NOT EXISTS contract_prazo_cancelamento_h integer,
  ADD COLUMN IF NOT EXISTS contract_dia_vencimento integer,
  ADD COLUMN IF NOT EXISTS contract_prazo_reposicao_dias integer,
  ADD COLUMN IF NOT EXISTS contract_vigencia_meses integer,
  ADD COLUMN IF NOT EXISTS contract_cidade_foro text,
  ADD COLUMN IF NOT EXISTS contract_estado_foro text,
  ADD COLUMN IF NOT EXISTS contract_enrollment_fee numeric,
  ADD COLUMN IF NOT EXISTS contract_payment_method text;

-- 3. Adicionar colunas de contrato profissional em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_raio_nao_concorrencia_km numeric,
  ADD COLUMN IF NOT EXISTS contract_multa_nao_captacao_fator numeric,
  ADD COLUMN IF NOT EXISTS contract_multa_nao_captacao_valor numeric,
  ADD COLUMN IF NOT EXISTS contract_dia_pagamento_comissao integer,
  ADD COLUMN IF NOT EXISTS contract_prazo_aviso_previo_dias integer,
  ADD COLUMN IF NOT EXISTS contract_multa_uso_marca_valor numeric,
  ADD COLUMN IF NOT EXISTS contract_valor_sessao_fixo numeric;

-- 4. Tabela de histórico de contratos (arquivamento)
CREATE TABLE IF NOT EXISTS public.documentos_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  profissional_id uuid,
  tipo_documento text NOT NULL DEFAULT 'paciente',
  arquivo_url text NOT NULL,
  versao integer DEFAULT 1,
  metadados jsonb,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_contratos_select" ON public.documentos_contratos;
CREATE POLICY "documentos_contratos_select" ON public.documentos_contratos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'master')
  OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'secretario')
  OR has_role(auth.uid(), 'profissional')
  OR EXISTS (SELECT 1 FROM pacientes p WHERE p.id = paciente_id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "documentos_contratos_insert" ON public.documentos_contratos;
CREATE POLICY "documentos_contratos_insert" ON public.documentos_contratos
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'master')
  OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'secretario')
  OR has_role(auth.uid(), 'profissional')
  OR EXISTS (SELECT 1 FROM pacientes p WHERE p.id = paciente_id AND p.user_id = auth.uid())
);

-- 5. Bucket de contratos
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contratos_authenticated_all" ON storage.objects;
CREATE POLICY "contratos_authenticated_all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'contratos')
WITH CHECK (bucket_id = 'contratos');

-- 6. Função: marcar agendamentos como realizados após 24h sem resposta
CREATE OR REPLACE FUNCTION public.auto_mark_realizado_after_24h()
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.agendamentos
  SET status = 'realizado', updated_at = now()
  WHERE status IN ('agendado', 'confirmado')
    AND data_horario < (now() - interval '24 hours');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;
