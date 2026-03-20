-- Add importacao_batch_id to pre_cadastros for batch tracking
ALTER TABLE public.pre_cadastros
  ADD COLUMN IF NOT EXISTS importacao_batch_id uuid,
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinicas(id);

-- Create importacao_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.importacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id),
  created_by uuid REFERENCES auth.users(id),
  tipo text NOT NULL DEFAULT 'pacientes', -- pacientes | agendamentos | pagamentos
  formato_arquivo text, -- csv | xlsx | json
  total_linhas integer NOT NULL DEFAULT 0,
  total_sucesso integer NOT NULL DEFAULT 0,
  total_erros integer NOT NULL DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'concluido', -- concluido | parcial | falhou
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.importacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "importacao_logs_admin_select" ON public.importacao_logs
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'master')
  );

CREATE POLICY "importacao_logs_admin_insert" ON public.importacao_logs
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'master')
  );

-- Index for fast batch lookup
CREATE INDEX IF NOT EXISTS idx_pre_cadastros_batch_id ON public.pre_cadastros(importacao_batch_id);
CREATE INDEX IF NOT EXISTS idx_importacao_logs_batch_id ON public.importacao_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_importacao_logs_clinic_id ON public.importacao_logs(clinic_id);
