-- ============================================================
-- Migration: Evolution API Integration
-- Adds multi-provider WhatsApp support + conversation inbox
-- ============================================================

-- 1. Extend whatsapp_config with provider fields
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta'
    CHECK (provider IN ('meta', 'evolution')),
  ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance TEXT,
  ADD COLUMN IF NOT EXISTS evolution_api_key TEXT;

COMMENT ON COLUMN whatsapp_config.provider IS 'meta = Meta/Facebook official API; evolution = Evolution API (self-hosted)';
COMMENT ON COLUMN whatsapp_config.evolution_api_url IS 'Base URL of the Evolution API server, e.g. https://evolution.meusite.com';
COMMENT ON COLUMN whatsapp_config.evolution_instance IS 'Instance name configured in the Evolution API server';
COMMENT ON COLUMN whatsapp_config.evolution_api_key IS 'Global API key or instance API key for the Evolution API server';

-- 2. Conversations table
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES pacientes(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  assigned_professional_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'closed')),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clinic_id, phone_number)
);

COMMENT ON TABLE whatsapp_conversations IS 'Tracks WhatsApp conversations per clinic contact. One row per unique phone number per clinic.';

-- 3. Messages table
CREATE TABLE IF NOT EXISTS whatsapp_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT NOT NULL,
  sent_by_professional_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  message_id_external TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE whatsapp_conversation_messages IS 'Individual messages within a WhatsApp conversation.';

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_clinic ON whatsapp_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_patient ON whatsapp_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_status ON whatsapp_conversations(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_last_msg ON whatsapp_conversations(clinic_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_conv ON whatsapp_conversation_messages(conversation_id, created_at DESC);

-- 5. Updated_at trigger helper
CREATE OR REPLACE FUNCTION update_whatsapp_conv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conv_updated_at ON whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conv_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_conv_updated_at();

-- 6. RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: clinic members can read/write their own clinic conversations
CREATE POLICY "clinic_members_conversations" ON whatsapp_conversations
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Messages: accessible if user can access the parent conversation
CREATE POLICY "clinic_members_messages" ON whatsapp_conversation_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM whatsapp_conversations
      WHERE clinic_id IN (
        SELECT clinic_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Service role bypass (for Edge Functions)
CREATE POLICY "service_role_conversations" ON whatsapp_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_messages" ON whatsapp_conversation_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Enable Realtime for live inbox updates
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversation_messages;
