-- Rewards catalog and redemptions
CREATE TABLE IF NOT EXISTS gamification_recompensas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  custo_pontos INTEGER NOT NULL DEFAULT 100,
  estoque INTEGER, -- NULL = unlimited
  ativo BOOLEAN DEFAULT true,
  validade_dias INTEGER,
  imagem_url TEXT,
  categoria TEXT DEFAULT 'desconto',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gamification_resgates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recompensa_id UUID REFERENCES gamification_recompensas(id),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinicas(id) ON DELETE CASCADE,
  pontos_utilizados INTEGER NOT NULL,
  status TEXT DEFAULT 'pendente', -- pendente, aprovado, utilizado, expirado
  codigo_resgate TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  data_expiracao DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gamification_recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_resgates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recompensas por clínica" ON gamification_recompensas FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND (ur.clinic_id = gamification_recompensas.clinic_id OR ur.role = 'master'))
);

CREATE POLICY "Resgates por clínica" ON gamification_resgates FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND (ur.clinic_id = gamification_resgates.clinic_id OR ur.role = 'master'))
);
