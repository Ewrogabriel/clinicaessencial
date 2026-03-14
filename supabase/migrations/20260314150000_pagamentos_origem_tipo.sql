-- ============================================================
-- Add origem_tipo and agendamento_id to pagamentos table.
-- This allows correlating every confirmed payment (matricula,
-- plano, sessão avulsa or manual) back to its origin, and
-- shows them unified in the Financeiro module.
-- ============================================================

-- 1. New columns
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT
    CHECK (origem_tipo IN ('matricula', 'plano', 'sessao_avulsa', 'manual'))
    DEFAULT 'manual';

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS agendamento_id UUID
    REFERENCES public.agendamentos(id) ON DELETE SET NULL;

-- 2. Backfill existing rows from FK hints
UPDATE public.pagamentos
  SET origem_tipo = 'plano'
  WHERE plano_id IS NOT NULL
    AND origem_tipo = 'manual';

UPDATE public.pagamentos
  SET origem_tipo = 'matricula'
  WHERE matricula_id IS NOT NULL
    AND origem_tipo = 'manual';

-- 3. Index for new FK and type filter
CREATE INDEX IF NOT EXISTS idx_pagamentos_origem_tipo
  ON public.pagamentos(origem_tipo);

CREATE INDEX IF NOT EXISTS idx_pagamentos_agendamento
  ON public.pagamentos(agendamento_id);

-- ============================================================
-- Trigger: auto-create a sessão avulsa payment entry when an
-- appointment is marked as 'realizado' and is not linked to a
-- matrícula or plano.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_sessao_avulsa_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status changes TO 'realizado'
  IF NEW.status <> 'realizado' OR OLD.status = 'realizado' THEN
    RETURN NEW;
  END IF;

  -- Skip if already linked to a matricula
  IF NEW.matricula_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if linked to a plano (observacoes contains 'plano:<uuid>')
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes ~ 'plano:[0-9a-f-]{36}' THEN
    RETURN NEW;
  END IF;

  -- Skip if a payment already exists for this appointment
  IF EXISTS (
    SELECT 1 FROM public.pagamentos WHERE agendamento_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Insert a pending sessao_avulsa payment record
  INSERT INTO public.pagamentos (
    paciente_id,
    profissional_id,
    valor,
    status,
    data_pagamento,
    data_vencimento,
    descricao,
    origem_tipo,
    agendamento_id,
    clinic_id,
    created_by
  )
  VALUES (
    NEW.paciente_id,
    NEW.profissional_id,
    COALESCE(NEW.valor_sessao, 0),
    'pendente',
    CURRENT_DATE,
    CURRENT_DATE,
    CONCAT(
      'Sessão Avulsa - ',
      COALESCE(NEW.tipo_atendimento, 'Atendimento'),
      ' - ',
      TO_CHAR(NEW.data_horario AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI')
    ),
    'sessao_avulsa',
    NEW.id,
    NEW.clinic_id,
    NEW.profissional_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_sessao_avulsa_payment ON public.agendamentos;

CREATE TRIGGER trg_create_sessao_avulsa_payment
  AFTER UPDATE OF status ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.create_sessao_avulsa_payment();
