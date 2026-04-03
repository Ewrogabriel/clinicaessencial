-- Migration: Investment Reconciliation Integration
-- Integrates bank reconciliation with the investments module

-- =====================================================
-- 1. Add investment columns to bank_transactions
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'investimento_id'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD COLUMN investimento_id UUID REFERENCES public.investments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'movement_type'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD COLUMN movement_type TEXT CHECK (movement_type IN ('aplicacao', 'resgate', 'rendimento', 'taxa', 'aporte', 'dividendo'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'is_investment'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD COLUMN is_investment BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_investimento
  ON public.bank_transactions(investimento_id)
  WHERE investimento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_is_investment
  ON public.bank_transactions(is_investment)
  WHERE is_investment = TRUE;

-- =====================================================
-- 2. Add investment columns to investments table
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investments' AND column_name = 'bank_transaction_id'
  ) THEN
    ALTER TABLE public.investments
      ADD COLUMN bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investments' AND column_name = 'data_resgate'
  ) THEN
    ALTER TABLE public.investments
      ADD COLUMN data_resgate DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investments' AND column_name = 'valor_resgatado'
  ) THEN
    ALTER TABLE public.investments
      ADD COLUMN valor_resgatado NUMERIC(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investments' AND column_name = 'rendimento_total'
  ) THEN
    ALTER TABLE public.investments
      ADD COLUMN rendimento_total NUMERIC(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investments' AND column_name = 'historico_movimentacoes'
  ) THEN
    ALTER TABLE public.investments
      ADD COLUMN historico_movimentacoes JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investments' AND column_name = 'notas'
  ) THEN
    ALTER TABLE public.investments
      ADD COLUMN notas TEXT;
  END IF;
END $$;

-- =====================================================
-- 3. Create investment_transactions table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  investimento_id      UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  bank_transaction_id  UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('aporte', 'resgate', 'rendimento', 'taxa', 'dividendo')),
  valor                NUMERIC(15,2) NOT NULL,
  data_movimento       DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao            TEXT,
  created_at           TIMESTAMP DEFAULT NOW(),
  created_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_investimento
  ON public.investment_transactions(investimento_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_bank_tx
  ON public.investment_transactions(bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investment_transactions_clinic
  ON public.investment_transactions(clinic_id);

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage investment_transactions"
  ON public.investment_transactions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================================================
-- 4. Create reconciliation view
-- =====================================================
CREATE OR REPLACE VIEW public.vw_investment_reconciliation AS
SELECT
  bt.id                  AS transaction_id,
  bt.clinic_id,
  bt.data_transacao,
  bt.valor,
  bt.descricao,
  bt.is_investment,
  bt.movement_type,
  bt.status              AS transaction_status,
  i.id                   AS investimento_id,
  i.nome                 AS investimento_nome,
  i.tipo                 AS investimento_tipo,
  i.instituicao,
  i.valor_aplicado,
  i.taxa_contratada,
  i.indexador,
  i.percentual_indexador,
  i.data_vencimento,
  i.status               AS investimento_status,
  it.tipo                AS movimento_tipo,
  it.valor               AS movimento_valor
FROM public.bank_transactions bt
LEFT JOIN public.investments i ON bt.investimento_id = i.id
LEFT JOIN public.investment_transactions it ON bt.id = it.bank_transaction_id
WHERE bt.is_investment = TRUE
ORDER BY bt.data_transacao DESC;
