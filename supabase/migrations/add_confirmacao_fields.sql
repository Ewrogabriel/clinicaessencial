-- Adicionar coluna para armazenar resposta de confirmação (sim/não)
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS confirmacao_presenca TEXT DEFAULT NULL;

-- Adicionar coluna para armazenar quando o link foi enviado
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS confirmacao_enviada_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Adicionar coluna para armazenar quando paciente respondeu
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS confirmacao_respondida_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
