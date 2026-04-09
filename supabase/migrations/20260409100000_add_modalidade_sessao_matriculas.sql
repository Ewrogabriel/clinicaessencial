-- Migration: Add modalidade_sessao column to matriculas
-- Allows choosing between 'grupo' (group) and 'individual' sessions
-- Default is 'grupo' as per business requirement

ALTER TABLE matriculas
  ADD COLUMN IF NOT EXISTS modalidade_sessao TEXT NOT NULL DEFAULT 'grupo'
    CHECK (modalidade_sessao IN ('grupo', 'individual'));
