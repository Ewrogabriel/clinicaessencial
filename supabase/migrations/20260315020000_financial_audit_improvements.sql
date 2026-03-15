-- ============================================================
-- Financial Audit Improvements
-- Adds 'reembolsado' (refunded) and 'vencido' (overdue)
-- to the status_pagamento enum, plus DB helpers.
-- ============================================================

-- 1. Extend the status_pagamento enum with new values
ALTER TYPE public.status_pagamento ADD VALUE IF NOT EXISTS 'reembolsado';
ALTER TYPE public.status_pagamento ADD VALUE IF NOT EXISTS 'vencido';

-- 2. Function: mark_overdue_pagamentos
--    Sets status = 'vencido' for all 'pendente' payments whose
--    data_vencimento has passed today.  Call this from a cron job
--    or on-demand from the application layer.
CREATE OR REPLACE FUNCTION public.mark_overdue_pagamentos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.pagamentos
     SET status     = 'vencido',
         updated_at = now()
   WHERE status          = 'pendente'
     AND data_vencimento IS NOT NULL
     AND data_vencimento <= CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.mark_overdue_pagamentos() IS
  'Marks all pendente payments with an expired data_vencimento as vencido. '
  'Returns the number of rows updated.';

-- 3. Index to speed up overdue queries
CREATE INDEX IF NOT EXISTS idx_pagamentos_status_vencimento
  ON public.pagamentos(status, data_vencimento)
  WHERE status IN ('pendente', 'vencido');
