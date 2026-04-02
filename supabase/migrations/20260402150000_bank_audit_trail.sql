-- Migration: Add audit trail and original description columns to bank_transactions

-- Preserve original transaction description before any review overwrites it
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS original_description TEXT;

-- Populate original_description for existing rows that were already reviewed
-- (where descricao may have been overwritten by the old approve/reject logic)
UPDATE bank_transactions
SET original_description = descricao
WHERE original_description IS NULL;

-- Dedicated column for review notes – keeps descricao clean
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- JSONB audit history: array of {action, reviewer_id, timestamp, note}
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT '[]'::jsonb;

-- Index for matching queries
CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched_payment
  ON bank_transactions (matched_payment_id)
  WHERE matched_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched_confidence
  ON bank_transactions (matched_confidence)
  WHERE matched_confidence IS NOT NULL;

-- Index for bank accounts by clinic
CREATE INDEX IF NOT EXISTS idx_bank_accounts_clinic
  ON bank_accounts (clinic_id);
