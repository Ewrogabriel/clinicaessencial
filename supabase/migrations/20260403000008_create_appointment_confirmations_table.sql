-- Enhanced appointment confirmation tracking
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS confirmacao_enviada_em TIMESTAMPTZ;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS lembrete_24h_enviado BOOLEAN DEFAULT false;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS lembrete_1h_enviado BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS appointment_confirmation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE CASCADE,
  canal TEXT NOT NULL, -- whatsapp, email, sms
  tipo TEXT NOT NULL, -- confirmacao, lembrete_24h, lembrete_1h
  enviado_em TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'enviado',
  erro TEXT
);

ALTER TABLE appointment_confirmation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Confirmation logs" ON appointment_confirmation_log FOR ALL USING (
  EXISTS (
    SELECT 1 FROM agendamentos a 
    JOIN user_roles ur ON ur.user_id = auth.uid()
    WHERE a.id = appointment_confirmation_log.agendamento_id
    AND (ur.clinic_id = a.clinic_id OR ur.role = 'master')
  )
);
