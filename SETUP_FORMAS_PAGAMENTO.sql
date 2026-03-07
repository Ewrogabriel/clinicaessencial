-- Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL, -- 'cartao', 'pix', 'dinheiro', 'boleto', 'cheque'
  ativo BOOLEAN DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de configuração PIX
CREATE TABLE IF NOT EXISTS config_pix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE CASCADE,
  chave_pix VARCHAR(255) NOT NULL,
  tipo_chave VARCHAR(20) NOT NULL, -- 'cpf', 'email', 'telefone', 'aleatorio'
  nome_beneficiario VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de pagamentos de mensalidade
CREATE TABLE IF NOT EXISTS pagamentos_mensalidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  matricula_id UUID,
  mes_referencia DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  forma_pagamento_id UUID REFERENCES formas_pagamento(id),
  status VARCHAR(50) DEFAULT 'aberto', -- 'aberto', 'pago', 'cancelado'
  data_pagamento TIMESTAMP,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(paciente_id, mes_referencia)
);

-- Criar tabela de pagamentos de sessões
CREATE TABLE IF NOT EXISTS pagamentos_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  agendamento_id UUID,
  valor DECIMAL(10, 2) NOT NULL,
  forma_pagamento_id UUID REFERENCES formas_pagamento(id),
  status VARCHAR(50) DEFAULT 'aberto', -- 'aberto', 'pago', 'cancelado'
  data_pagamento TIMESTAMP,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_ativo ON formas_pagamento(ativo);
CREATE INDEX IF NOT EXISTS idx_config_pix_forma ON config_pix(forma_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mensalidade_paciente ON pagamentos_mensalidade(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mensalidade_status ON pagamentos_mensalidade(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_sessoes_paciente ON pagamentos_sessoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_sessoes_status ON pagamentos_sessoes(status);

-- Inserir formas de pagamento padrão
INSERT INTO formas_pagamento (nome, descricao, tipo, ordem) VALUES
  ('PIX', 'Transferência instantânea via PIX', 'pix', 1),
  ('Cartão de Crédito', 'Pagamento com cartão de crédito', 'cartao', 2),
  ('Dinheiro', 'Pagamento em dinheiro', 'dinheiro', 3),
  ('Boleto Bancário', 'Pagamento via boleto', 'boleto', 4),
  ('Cheque', 'Pagamento com cheque', 'cheque', 5)
ON CONFLICT DO NOTHING;
