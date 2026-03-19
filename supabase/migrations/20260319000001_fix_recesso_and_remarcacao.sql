-- ============================================================
-- Fix 1: Recreate recesso_clinica with correct FK to clinicas
-- ============================================================
DROP TABLE IF EXISTS public.recesso_clinica CASCADE;

CREATE TABLE public.recesso_clinica (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  data_inicio DATE        NOT NULL,
  data_fim    DATE        NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recesso_clinica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic staff can read recesso"
  ON public.recesso_clinica FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_users cu
      WHERE cu.clinic_id = recesso_clinica.clinic_id
        AND cu.user_id   = auth.uid()
    )
  );

CREATE POLICY "admin can manage recesso"
  ON public.recesso_clinica FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role    IN ('admin', 'gestor', 'master')
      LIMIT 1
    )
  );

-- ============================================================
-- Fix 2: Correct check constraint on solicitacoes_remarcacao
-- ============================================================
ALTER TABLE public.solicitacoes_remarcacao
  DROP CONSTRAINT IF EXISTS solicitacoes_remarcacao_status_check;

ALTER TABLE public.solicitacoes_remarcacao
  ADD CONSTRAINT solicitacoes_remarcacao_status_check
  CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado'));

-- ============================================================
-- Fix 3: Add pagamentos_sessoes row when agendamento is created
--         (via trigger so it works regardless of insert source)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_create_payment_on_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only create payment if valor_sessao is set and > 0
  IF NEW.valor_sessao IS NOT NULL AND NEW.valor_sessao > 0 THEN
    INSERT INTO public.pagamentos (
      paciente_id,
      clinic_id,
      valor,
      status,
      forma_pagamento,
      data_vencimento,
      descricao,
      agendamento_id,
      created_at
    ) VALUES (
      NEW.paciente_id,
      NEW.clinic_id,
      NEW.valor_sessao,
      'pendente',
      COALESCE(NEW.forma_pagamento, 'pix'),
      COALESCE(NEW.data_vencimento, NEW.data_horario::date),
      'Sessão - ' || COALESCE(NEW.tipo_atendimento, 'Atendimento'),
      NEW.id,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS trg_create_payment_on_appointment ON public.agendamentos;

CREATE TRIGGER trg_create_payment_on_appointment
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_payment_on_appointment();

-- ============================================================
-- Fix 4: Add missing columns to agendamentos if not present
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'valor_sessao'
  ) THEN
    ALTER TABLE public.agendamentos ADD COLUMN valor_sessao NUMERIC(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'data_vencimento'
  ) THEN
    ALTER TABLE public.agendamentos ADD COLUMN data_vencimento DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE public.agendamentos ADD COLUMN forma_pagamento TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'agendamento_id'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL;
  END IF;
END $$;
