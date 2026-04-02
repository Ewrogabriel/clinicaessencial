-- Challenges/Goals system
CREATE TABLE IF NOT EXISTS gamification_desafios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'individual', -- individual, equipe
  periodo TEXT DEFAULT 'mensal', -- semanal, mensal
  meta INTEGER NOT NULL DEFAULT 1,
  pontos_recompensa INTEGER DEFAULT 100,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gamification_progresso_desafios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id UUID REFERENCES gamification_desafios(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  progresso_atual INTEGER DEFAULT 0,
  concluido BOOLEAN DEFAULT false,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(desafio_id, paciente_id)
);

ALTER TABLE gamification_desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_progresso_desafios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Desafios por clínica" ON gamification_desafios FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND (ur.clinic_id = gamification_desafios.clinic_id OR ur.role = 'master'))
);

CREATE POLICY "Progresso por clínica" ON gamification_progresso_desafios FOR ALL USING (
  EXISTS (SELECT 1 FROM gamification_desafios gd JOIN user_roles ur ON ur.user_id = auth.uid() WHERE gd.id = gamification_progresso_desafios.desafio_id AND (ur.clinic_id = gd.clinic_id OR ur.role = 'master'))
);
