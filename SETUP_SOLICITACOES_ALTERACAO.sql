-- Tabela para solicitações de alteração de dados do paciente
CREATE TABLE IF NOT EXISTS solicitacoes_alteracao_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  dados_atuais JSONB NOT NULL,
  dados_novos JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  motivo TEXT,
  aprovador_id UUID REFERENCES users(id) ON DELETE SET NULL,
  motivo_rejeicao TEXT,
  created_at TIMESTAMP DEFAULT now(),
  approved_at TIMESTAMP,
  
  CONSTRAINT unique_pending_per_patient UNIQUE (paciente_id, status) WHERE status = 'pendente'
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_solicitacoes_paciente_id ON solicitacoes_alteracao_dados(paciente_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_alteracao_dados(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_at ON solicitacoes_alteracao_dados(created_at DESC);

-- Enable RLS
ALTER TABLE solicitacoes_alteracao_dados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Pacientes podem ver suas próprias solicitações
CREATE POLICY pacientes_view_own_requests ON solicitacoes_alteracao_dados
  FOR SELECT
  USING (paciente_id = auth.uid());

-- Pacientes podem criar suas próprias solicitações
CREATE POLICY pacientes_create_requests ON solicitacoes_alteracao_dados
  FOR INSERT
  WITH CHECK (paciente_id = auth.uid());

-- ADM pode ver todas as solicitações (você pode ajustar conforme necessário)
CREATE POLICY admin_view_all_requests ON solicitacoes_alteracao_dados
  FOR SELECT
  USING (true); -- Ajuste para verificar is_admin se tiver coluna
