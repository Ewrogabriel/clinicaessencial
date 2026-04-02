-- ============================================================
-- WhatsApp Message Logs: updated_at trigger
-- Adds an updated_at column and trigger to whatsapp_message_logs
-- so that any future status updates (e.g. delivered_at) are tracked.
-- ============================================================

ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_updated_at
  ON public.whatsapp_message_logs(clinic_id, updated_at DESC);

CREATE TRIGGER set_whatsapp_logs_updated_at
  BEFORE UPDATE ON public.whatsapp_message_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
