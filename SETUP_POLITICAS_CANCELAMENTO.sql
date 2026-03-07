-- Criar tabela de politicas de cancelamento
CREATE TABLE IF NOT EXISTS politicas_cancelamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID REFERENCES profiles(user_id),
  
  -- Tempo para cancelamento com justificativa (em horas)
  tempo_cancelamento_com_justificativa INTEGER DEFAULT 3,
  
  -- Tempo para reagendar antes da sessão (em horas)
  tempo_minimo_reagendamento INTEGER DEFAULT 2,
  
  -- Tempo para remarcação de sessão cancelada pelo paciente (em dias)
  tempo_remarcacao_cancelada INTEGER DEFAULT 30,
  
  -- Tempo para cancelamento sem justificativa (em horas)
  tempo_cancelamento_sem_justificativa INTEGER DEFAULT 24,
  
  -- Limite de cancelamentos por período sem taxa
  limite_cancelamentos_mes INTEGER DEFAULT 2,
  
  -- Taxa para cancelamento acima do limite (em porcentagem)
  taxa_cancelamento_extra DECIMAL(5, 2) DEFAULT 0,
  
  -- Se o cancelamento reduz a mensalidade
  cancelamento_reduz_mensalidade BOOLEAN DEFAULT false,
  
  -- Se deve gerar reposição automática
  gera_reposicao_automatica BOOLEAN DEFAULT true,
  
  -- Tempo para responder solicitação de remarcação (em dias)
  tempo_resposta_remarcacao INTEGER DEFAULT 7,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_politicas_cancelamento_clinica ON politicas_cancelamento(clinica_id);

-- Inserir políticas padrão para clinicas existentes
INSERT INTO politicas_cancelamento (clinica_id)
SELECT user_id FROM profiles WHERE role = 'admin'
ON CONFLICT DO NOTHING;
