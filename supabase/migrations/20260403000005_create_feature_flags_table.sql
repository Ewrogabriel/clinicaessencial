-- Feature flags for master admin
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN DEFAULT false,
  plano_minimo TEXT DEFAULT 'basico',
  clinic_id UUID REFERENCES clinicas(id) ON DELETE CASCADE, -- NULL = global
  categoria TEXT DEFAULT 'geral',
  criado_por UUID REFERENCES profiles(user_id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature flags - master only" ON feature_flags FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'master')
);

INSERT INTO feature_flags (nome, descricao, ativo, plano_minimo, categoria) VALUES
  ('teleconsultacao', 'Módulo de teleconsultação', true, 'basico', 'teleconsultacao'),
  ('gamificacao', 'Sistema de gamificação', true, 'profissional', 'gamificacao'),
  ('ia_assistente', 'Assistente de IA', true, 'profissional', 'inteligencia'),
  ('relatorios_avancados', 'Relatórios avançados', true, 'profissional', 'relatorios'),
  ('marketing_automatico', 'Marketing automático', false, 'premium', 'marketing')
ON CONFLICT (nome) DO NOTHING;
