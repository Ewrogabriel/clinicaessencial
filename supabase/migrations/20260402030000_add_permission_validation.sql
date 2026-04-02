-- Migration: Add user_permissions JSONB column and audit logging
-- Adds fine-grained permission storage per user profile.

-- Add user_permissions JSONB to profiles (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_permissions JSONB DEFAULT '{}';

-- Index for permission lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_permissions
  ON profiles USING GIN (user_permissions)
  WHERE user_permissions IS NOT NULL AND user_permissions != '{}';

-- audit_logs: generic audit trail for permission changes and financial operations
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,
  changes       JSONB,
  performed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by
  ON audit_logs (performed_by, created_at DESC);

-- RLS: only admins can read audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = auth.uid());
