
-- Tabela de solicitações de ficha do paciente
CREATE TABLE IF NOT EXISTS public.ficha_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  motivo_rejeicao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ficha_requests ENABLE ROW LEVEL SECURITY;

-- Paciente pode criar e ver suas próprias solicitações
CREATE POLICY "ficha_requests_patient_select"
  ON public.ficha_requests FOR SELECT
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

CREATE POLICY "ficha_requests_patient_insert"
  ON public.ficha_requests FOR INSERT
  WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Admin pode ver todas e atualizar
CREATE POLICY "ficha_requests_admin_select"
  ON public.ficha_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ficha_requests_admin_update"
  ON public.ficha_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ficha_requests_admin_delete"
  ON public.ficha_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index
CREATE INDEX IF NOT EXISTS idx_ficha_requests_paciente_id ON public.ficha_requests(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ficha_requests_status ON public.ficha_requests(status);
