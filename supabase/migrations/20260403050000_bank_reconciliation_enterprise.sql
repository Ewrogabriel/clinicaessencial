-- Migration: Bank Reconciliation Enterprise Features
-- Implements all 15 improvement suggestions for the banking reconciliation system

-- =====================================================
-- 1. transaction_splits - Split payments across multiple transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  bank_transaction_id  UUID REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  payment_id           UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  amount               NUMERIC(15,2) NOT NULL,
  description          TEXT,
  created_at           TIMESTAMP DEFAULT NOW(),
  created_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction
  ON public.transaction_splits(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_clinic
  ON public.transaction_splits(clinic_id);

-- =====================================================
-- 2. transaction_anomalies - Detected anomalies
-- =====================================================
CREATE TABLE IF NOT EXISTS public.transaction_anomalies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  bank_transaction_id  UUID REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  anomaly_type         TEXT NOT NULL CHECK (anomaly_type IN ('duplicate', 'orphan', 'discrepancy', 'ambiguous', 'unreconciled', 'negative')),
  severity             TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  description          TEXT,
  detected_at          TIMESTAMP DEFAULT NOW(),
  resolved             BOOLEAN DEFAULT FALSE,
  resolved_at          TIMESTAMP,
  resolved_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_anomalies_transaction
  ON public.transaction_anomalies(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_clinic
  ON public.transaction_anomalies(clinic_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved
  ON public.transaction_anomalies(resolved);

-- =====================================================
-- 3. auto_reconciliation_log - Auto-matching audit log
-- =====================================================
CREATE TABLE IF NOT EXISTS public.auto_reconciliation_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  bank_transaction_id  UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  payment_id           UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  score                NUMERIC(5,2),
  auto_reconciled      BOOLEAN DEFAULT FALSE,
  timestamp            TIMESTAMP DEFAULT NOW(),
  reason               TEXT,
  triggered_by         TEXT DEFAULT 'auto' CHECK (triggered_by IN ('auto', 'manual', 'cron'))
);

CREATE INDEX IF NOT EXISTS idx_auto_recon_log_clinic
  ON public.auto_reconciliation_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_auto_recon_log_timestamp
  ON public.auto_reconciliation_log(timestamp DESC);

-- =====================================================
-- 4. clinic_reconciliation_config - Per-clinic configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clinic_reconciliation_config (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                  UUID UNIQUE REFERENCES public.clinicas(id) ON DELETE CASCADE,
  matching_window_days        INTEGER NOT NULL DEFAULT 15 CHECK (matching_window_days BETWEEN 1 AND 90),
  value_tolerance_percent     NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (value_tolerance_percent BETWEEN 0 AND 50),
  origin_priority             TEXT NOT NULL DEFAULT 'matricula,plano,sessao,manual',
  min_suggestion_score        NUMERIC(5,2) NOT NULL DEFAULT 60 CHECK (min_suggestion_score BETWEEN 0 AND 100),
  auto_reconcile_threshold    NUMERIC(5,2) NOT NULL DEFAULT 95 CHECK (auto_reconcile_threshold BETWEEN 0 AND 100),
  auto_reconcile_schedule     TEXT DEFAULT '0 1 * * *',
  auto_reconcile_enabled      BOOLEAN DEFAULT FALSE,
  alert_unreconciled_days     INTEGER DEFAULT 30,
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_config_clinic
  ON public.clinic_reconciliation_config(clinic_id);

-- =====================================================
-- 5. bank_transaction_fees - Gateway/bank fees tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transaction_fees (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id  UUID REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  fee_type             TEXT NOT NULL DEFAULT 'gateway' CHECK (fee_type IN ('gateway', 'bank', 'exchange', 'other')),
  amount               NUMERIC(15,2) NOT NULL DEFAULT 0,
  percent              NUMERIC(5,4),
  currency             TEXT DEFAULT 'BRL',
  exchange_rate        NUMERIC(10,6) DEFAULT 1,
  recorded_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fees_transaction
  ON public.bank_transaction_fees(bank_transaction_id);

-- =====================================================
-- 6. adjustments - Adjustments and provisions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.adjustments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  bank_transaction_id  UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  description          TEXT NOT NULL,
  amount               NUMERIC(15,2) NOT NULL,
  type                 TEXT NOT NULL DEFAULT 'ajuste' CHECK (type IN ('ajuste', 'provisao', 'contra_partida')),
  reason               TEXT NOT NULL,
  exclude_fiscal       BOOLEAN DEFAULT FALSE,
  created_by           UUID,
  approved_by          UUID,
  created_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_clinic
  ON public.adjustments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_transaction
  ON public.adjustments(bank_transaction_id);

-- =====================================================
-- 7. audit_logs_reconciliation - Immutable audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs_reconciliation (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  user_id        UUID,
  action         TEXT NOT NULL CHECK (action IN ('reconcile', 'split', 'undo', 'adjust', 'reject', 'edit', 'delete', 'auto_reconcile', 'refund', 'config_change')),
  resource_type  TEXT NOT NULL CHECK (resource_type IN ('transaction', 'payment', 'split', 'adjustment', 'config')),
  resource_id    UUID,
  before_state   JSONB,
  after_state    JSONB,
  reason         TEXT,
  ip_address     TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE allowed
CREATE INDEX IF NOT EXISTS idx_audit_recon_clinic
  ON public.audit_logs_reconciliation(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_recon_resource
  ON public.audit_logs_reconciliation(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_recon_created_at
  ON public.audit_logs_reconciliation(created_at DESC);

-- =====================================================
-- 8. Add missing columns to bank_transactions
-- =====================================================
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS currency           TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS exchange_rate      NUMERIC(10,6) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS gross_amount       NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS net_amount         NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS reconciled_partial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reconciled_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_refund          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_tx_id     UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_reason      TEXT,
  ADD COLUMN IF NOT EXISTS paciente_id        UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_total        NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS has_splits         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS anomaly_count      INTEGER DEFAULT 0;

-- =====================================================
-- 9. Row Level Security policies
-- =====================================================
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reconciliation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_reconciliation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_reconciliation ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- transaction_splits
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_splits' AND policyname = 'users_can_manage_transaction_splits') THEN
    CREATE POLICY "users_can_manage_transaction_splits"
      ON public.transaction_splits FOR ALL
      USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;

  -- transaction_anomalies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_anomalies' AND policyname = 'users_can_manage_transaction_anomalies') THEN
    CREATE POLICY "users_can_manage_transaction_anomalies"
      ON public.transaction_anomalies FOR ALL
      USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;

  -- auto_reconciliation_log
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auto_reconciliation_log' AND policyname = 'users_can_view_auto_recon_log') THEN
    CREATE POLICY "users_can_view_auto_recon_log"
      ON public.auto_reconciliation_log FOR SELECT
      USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;

  -- clinic_reconciliation_config
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinic_reconciliation_config' AND policyname = 'users_can_manage_recon_config') THEN
    CREATE POLICY "users_can_manage_recon_config"
      ON public.clinic_reconciliation_config FOR ALL
      USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;

  -- bank_transaction_fees
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_transaction_fees' AND policyname = 'users_can_manage_fees') THEN
    CREATE POLICY "users_can_manage_fees"
      ON public.bank_transaction_fees FOR ALL
      USING (
        bank_transaction_id IN (
          SELECT id FROM public.bank_transactions
          WHERE clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid())
        )
      );
  END IF;

  -- adjustments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adjustments' AND policyname = 'users_can_manage_adjustments') THEN
    CREATE POLICY "users_can_manage_adjustments"
      ON public.adjustments FOR ALL
      USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;

  -- audit_logs_reconciliation (SELECT only for all, INSERT for authenticated)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs_reconciliation' AND policyname = 'users_can_view_audit_logs') THEN
    CREATE POLICY "users_can_view_audit_logs"
      ON public.audit_logs_reconciliation FOR SELECT
      USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs_reconciliation' AND policyname = 'users_can_insert_audit_logs') THEN
    CREATE POLICY "users_can_insert_audit_logs"
      ON public.audit_logs_reconciliation FOR INSERT
      WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));
  END IF;
END $$;
