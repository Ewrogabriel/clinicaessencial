-- ============================================================
-- WhatsApp Business Integration: Database Structure
-- Creates tables for WhatsApp config, automation settings,
-- and message logs with clinic-scoped RLS policies.
-- ============================================================

-- ============================================================
-- 1. TABELA: whatsapp_config
--    Stores API credentials and activation status per clinic.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  api_token         TEXT,        -- NOTE: consider using Supabase Vault for token encryption at rest
  phone_number_id   TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_clinic_id
  ON public.whatsapp_config(clinic_id);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Clinic members can read their own config
CREATE POLICY "whatsapp_config_select_own" ON public.whatsapp_config
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'master'::app_role)
  );

-- Only admin and master can insert/update/delete
CREATE POLICY "whatsapp_config_admin_insert" ON public.whatsapp_config
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "whatsapp_config_admin_update" ON public.whatsapp_config
  FOR UPDATE TO authenticated
  USING (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "whatsapp_config_admin_delete" ON public.whatsapp_config
  FOR DELETE TO authenticated
  USING (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. TABELA: whatsapp_automation_settings
--    One row per clinic with all automation toggles and params.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_automation_settings (
  id                                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                           UUID        NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,

  -- Confirmação de sessão
  session_confirmation_enabled        BOOLEAN     NOT NULL DEFAULT false,
  session_confirmation_hours_before   INTEGER     NOT NULL DEFAULT 48,
  session_confirmation_message        TEXT,

  -- Lembrete de mensalidade
  monthly_reminder_enabled            BOOLEAN     NOT NULL DEFAULT false,
  monthly_reminder_days_before        INTEGER     NOT NULL DEFAULT 7,
  monthly_reminder_message            TEXT,
  monthly_reminder_patient_ids        JSONB,      -- NULL = all patients; array of patient UUIDs

  -- Alerta de pagamento atrasado
  overdue_alert_enabled               BOOLEAN     NOT NULL DEFAULT false,
  overdue_alert_days                  INTEGER     NOT NULL DEFAULT 1,
  overdue_alert_include_pix           BOOLEAN     NOT NULL DEFAULT false,
  overdue_alert_message               TEXT,
  overdue_alert_patient_ids           JSONB,      -- NULL = all patients; array of patient UUIDs

  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_clinic_id
  ON public.whatsapp_automation_settings(clinic_id);

ALTER TABLE public.whatsapp_automation_settings ENABLE ROW LEVEL SECURITY;

-- Clinic members can read their own automation settings
CREATE POLICY "whatsapp_auto_select_own" ON public.whatsapp_automation_settings
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'master'::app_role)
  );

-- Only admin and master can insert/update/delete
CREATE POLICY "whatsapp_auto_admin_insert" ON public.whatsapp_automation_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "whatsapp_auto_admin_update" ON public.whatsapp_automation_settings
  FOR UPDATE TO authenticated
  USING (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "whatsapp_auto_admin_delete" ON public.whatsapp_automation_settings
  FOR DELETE TO authenticated
  USING (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. TABELA: whatsapp_message_logs
--    Audit log for every WhatsApp message sent by the system.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  patient_id       UUID        REFERENCES public.pacientes(id) ON DELETE SET NULL,
  appointment_id   UUID        REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  message_type     TEXT        NOT NULL
                               CHECK (message_type IN (
                                 'session_confirmation',
                                 'monthly_reminder',
                                 'overdue_alert'
                               )),
  status           TEXT        NOT NULL DEFAULT 'sent'
                               CHECK (status IN ('sent', 'failed', 'delivered', 'read')),
  message_content  TEXT,
  phone_number     TEXT        CHECK (phone_number ~ '^\+?[0-9]{7,15}$'),
  error_message    TEXT,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_clinic_id
  ON public.whatsapp_message_logs(clinic_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_patient_id
  ON public.whatsapp_message_logs(patient_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at
  ON public.whatsapp_message_logs(clinic_id, sent_at DESC);

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Clinic members can read (only) their own message logs
CREATE POLICY "whatsapp_logs_select_own" ON public.whatsapp_message_logs
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'master'::app_role)
  );

-- Only the system (via service role / backend) should insert logs;
-- admin/master can insert for operational needs
CREATE POLICY "whatsapp_logs_admin_insert" ON public.whatsapp_message_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
    )
  );

-- Logs are immutable for regular users; only master can update/delete
CREATE POLICY "whatsapp_logs_master_update" ON public.whatsapp_message_logs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "whatsapp_logs_master_delete" ON public.whatsapp_message_logs
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));
