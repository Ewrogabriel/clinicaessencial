-- Migration: Add reconciliation tracking columns
-- Adds `rejection_reason` and `note` audit fields to bank_transactions.
-- These columns are optional and extend the existing workflow.

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_note      TEXT;

-- Index to speed up reconciliation panel queries by status + clinic
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status_clinic
  ON bank_transactions (clinic_id, status, data_transacao DESC);

-- Index for undo window check (reviewed_at lookups)
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reviewed_at
  ON bank_transactions (reviewed_at)
  WHERE reviewed_at IS NOT NULL;

-- email_delivery_log: track all outgoing emails for resend / audit
CREATE TABLE IF NOT EXISTS email_delivery_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID REFERENCES clinicas(id) ON DELETE SET NULL,
  recipient_email  TEXT NOT NULL,
  subject          TEXT,
  template_type    TEXT NOT NULL,
  entity_id        TEXT,
  entity_type      TEXT,
  html_content     TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at          TIMESTAMPTZ,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only authenticated users of the same clinic can read delivery logs
ALTER TABLE email_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read own clinic email logs"
  ON email_delivery_log FOR SELECT
  TO authenticated
  USING (
    clinic_id IS NULL
    OR clinic_id IN (
      SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated insert email logs"
  ON email_delivery_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
