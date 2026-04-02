-- Achievement/badge system
CREATE TABLE IF NOT EXISTS gamification_conquistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  icone TEXT DEFAULT 'trophy',
  pontos INTEGER DEFAULT 0,
  conquistado BOOLEAN DEFAULT false,
  data_conquista TIMESTAMPTZ,
  tipo TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_conquistas_paciente ON gamification_conquistas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_gamification_conquistas_clinic ON gamification_conquistas(clinic_id);

ALTER TABLE gamification_conquistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conquistas por clínica" ON gamification_conquistas FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND (ur.clinic_id = gamification_conquistas.clinic_id OR ur.role = 'master'))
);
