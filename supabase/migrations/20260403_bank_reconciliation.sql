-- Migration: Bank Reconciliation Base System
-- Creates bank_accounts and bank_transactions tables if they don't exist,
-- and adds any missing columns to existing tables.

-- =====================================================
-- bank_accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  banco_nome           TEXT NOT NULL,
  agencia              TEXT,
  conta                TEXT,
  tipo_conta           TEXT CHECK (tipo_conta IN ('corrente', 'poupanca')),
  titulario            TEXT,
  saldo_atual          NUMERIC(15,2),
  data_sincronizacao   TIMESTAMP,
  ativo                BOOLEAN DEFAULT true,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to bank_accounts if the table already existed
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS titulario          TEXT,
  ADD COLUMN IF NOT EXISTS saldo_atual        NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS data_sincronizacao TIMESTAMP;

-- =====================================================
-- bank_transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  bank_account_id  UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  data_transacao   DATE NOT NULL,
  descricao        TEXT NOT NULL,
  valor            NUMERIC(15,2) NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  categoria        TEXT,
  documento        TEXT,
  saldo            NUMERIC(15,2),
  status           TEXT CHECK (status IN ('pendente', 'conciliado', 'rejeitado')),
  pagamento_id     UUID REFERENCES public.pagamentos(id),
  observacoes      TEXT,
  data_conciliacao TIMESTAMP,
  import_batch_id  TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to bank_transactions if the table already existed
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS observacoes      TEXT,
  ADD COLUMN IF NOT EXISTS data_conciliacao TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP DEFAULT NOW();

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bank_accounts_clinic
  ON public.bank_accounts(clinic_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_clinic
  ON public.bank_transactions(clinic_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_status
  ON public.bank_transactions(status);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_data
  ON public.bank_transactions(data_transacao DESC);

-- =====================================================
-- Row Level Security
-- =====================================================
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_accounts'
      AND policyname = 'users_can_view_bank_accounts'
  ) THEN
    CREATE POLICY "users_can_view_bank_accounts"
      ON public.bank_accounts FOR SELECT
      USING (
        clinic_id IN (
          SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_accounts'
      AND policyname = 'users_can_manage_bank_accounts'
  ) THEN
    CREATE POLICY "users_can_manage_bank_accounts"
      ON public.bank_accounts FOR ALL
      USING (
        clinic_id IN (
          SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions'
      AND policyname = 'users_can_view_bank_transactions'
  ) THEN
    CREATE POLICY "users_can_view_bank_transactions"
      ON public.bank_transactions FOR SELECT
      USING (
        clinic_id IN (
          SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions'
      AND policyname = 'users_can_manage_bank_transactions'
  ) THEN
    CREATE POLICY "users_can_manage_bank_transactions"
      ON public.bank_transactions FOR ALL
      USING (
        clinic_id IN (
          SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
