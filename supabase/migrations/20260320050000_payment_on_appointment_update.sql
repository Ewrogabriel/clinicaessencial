-- ============================================================
-- Update trigger to also fire on UPDATE of agendamentos so that
-- appointments created via the book_appointment RPC (which uses
-- INSERT without financial fields, then UPDATE to set them) also
-- produce a correctly-valued pagamentos record.
-- ============================================================

-- Re-create the trigger function (idempotent via OR REPLACE)
CREATE OR REPLACE FUNCTION public.fn_create_payment_on_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only create/update payment when valor_sessao is set and > 0
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
    ON CONFLICT (agendamento_id) DO UPDATE
      SET forma_pagamento = COALESCE(EXCLUDED.forma_pagamento, pagamentos.forma_pagamento),
          data_vencimento = COALESCE(EXCLUDED.data_vencimento, pagamentos.data_vencimento),
          valor           = EXCLUDED.valor;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old INSERT-only trigger and replace with INSERT OR UPDATE trigger
DROP TRIGGER IF EXISTS trg_create_payment_on_appointment ON public.agendamentos;

CREATE TRIGGER trg_create_payment_on_appointment
  AFTER INSERT OR UPDATE OF valor_sessao, forma_pagamento, data_vencimento
  ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_payment_on_appointment();

-- Add a unique constraint on pagamentos.agendamento_id so ON CONFLICT works
-- (idempotent: only adds if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_agendamento_id_key'
  ) THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_agendamento_id_key UNIQUE (agendamento_id);
  END IF;
END $$;
