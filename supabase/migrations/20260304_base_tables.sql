-- ====================================================
-- MIGRATION BASE: Todas as tabelas do app-essencial
-- Execute ANTES do script de matrícula avançada
-- PostgreSQL 14 (Supabase) compatible
-- ====================================================

-- ============================================================
-- ENUMS (tipos customizados)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'profissional', 'gestor', 'paciente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forma_pagamento AS ENUM ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_agendamento AS ENUM ('agendado','confirmado','realizado','cancelado','falta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_paciente AS ENUM ('ativo','inativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_pagamento AS ENUM ('pendente','pago','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_plano AS ENUM ('ativo','vencido','cancelado','finalizado','suspenso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_sessao AS ENUM ('individual','grupo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- FUNÇÃO updated_at (antes dos triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

-- ============================================================
-- TABELA: profiles (profissionais/usuários)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  rg TEXT,
  cnpj TEXT,
  data_nascimento DATE,
  estado_civil TEXT,
  especialidade TEXT,
  registro_profissional TEXT,
  graduacao TEXT,
  especializacoes TEXT[],
  cursos TEXT[],
  bio TEXT,
  tipo_contratacao TEXT,
  commission_rate NUMERIC(5,2),
  commission_fixed NUMERIC(12,2),
  cor_agenda TEXT,
  foto_url TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: user_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ============================================================
-- FUNÇÃO has_role (precisa de user_roles existindo)
-- ============================================================
CREATE OR REPLACE FUNCTION has_role(_role app_role, _user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- TABELA: clinic_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT 'Clínica',
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  instagram TEXT,
  cnpj TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: modalidades
-- ============================================================
CREATE TABLE IF NOT EXISTS modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: pacientes
-- ============================================================
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  foto_url TEXT,
  tipo_atendimento TEXT NOT NULL DEFAULT 'pilates',
  status status_paciente NOT NULL DEFAULT 'ativo',
  profissional_id UUID,
  user_id UUID,
  observacoes TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  rua TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  tem_responsavel_legal BOOLEAN DEFAULT false,
  responsavel_nome TEXT,
  responsavel_cpf TEXT,
  responsavel_rg TEXT,
  responsavel_telefone TEXT,
  responsavel_email TEXT,
  responsavel_parentesco TEXT,
  responsavel_endereco TEXT,
  responsavel_numero TEXT,
  responsavel_complemento TEXT,
  responsavel_bairro TEXT,
  responsavel_rua TEXT,
  responsavel_cidade TEXT,
  responsavel_estado TEXT,
  responsavel_cep TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: agendamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  profissional_id UUID NOT NULL,
  data_horario TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  tipo_atendimento TEXT NOT NULL DEFAULT 'pilates',
  tipo_sessao tipo_sessao NOT NULL DEFAULT 'individual',
  status status_agendamento NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  recorrencia_grupo_id UUID,
  recorrencia_fim DATE,
  dias_semana INTEGER[],
  frequencia_semanal INTEGER,
  valor_sessao NUMERIC(12,2),
  valor_mensal NUMERIC(12,2),
  -- Campos do módulo matrícula
  enrollment_id UUID,
  rescheduled_from_id UUID,
  cancellation_reason TEXT,
  cancellation_justification TEXT,
  justification_status TEXT CHECK (justification_status IN ('pending','approved','denied')),
  checkin_paciente BOOLEAN,
  checkin_paciente_at TIMESTAMPTZ,
  checkin_profissional BOOLEAN,
  checkin_profissional_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: planos (pacotes/consultas avulsas)
-- ============================================================
CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  profissional_id UUID NOT NULL,
  tipo_atendimento TEXT NOT NULL DEFAULT 'pilates',
  total_sessoes INTEGER NOT NULL DEFAULT 1,
  sessoes_utilizadas INTEGER NOT NULL DEFAULT 0,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  status status_plano NOT NULL DEFAULT 'ativo',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  observacoes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: pagamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
  profissional_id UUID NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  status status_pagamento NOT NULL DEFAULT 'pendente',
  forma_pagamento forma_pagamento,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  descricao TEXT,
  observacoes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: commissions (comissões por agendamento avulso)
-- ============================================================
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  professional_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: evaluations (avaliações clínicas)
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  queixa_principal TEXT NOT NULL,
  historico_doenca TEXT,
  antecedentes_pessoais TEXT,
  objetivos_tratamento TEXT,
  conduta_inicial TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: evolutions (evoluções/prontuário)
-- ============================================================
CREATE TABLE IF NOT EXISTS evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  data_evolucao DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT NOT NULL,
  conduta TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: expenses (despesas da clínica)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_vencimento DATE,
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: disponibilidade_profissional
-- ============================================================
CREATE TABLE IF NOT EXISTS disponibilidade_profissional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  max_pacientes INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: bloqueios_profissional
-- ============================================================
CREATE TABLE IF NOT EXISTS bloqueios_profissional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL,
  data DATE NOT NULL,
  dia_inteiro BOOLEAN NOT NULL DEFAULT true,
  hora_inicio TIME,
  hora_fim TIME,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: agenda_extra
-- ============================================================
CREATE TABLE IF NOT EXISTS agenda_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  max_pacientes INTEGER NOT NULL DEFAULT 1,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: feriados
-- ============================================================
CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: avisos (mural)
-- ============================================================
CREATE TABLE IF NOT EXISTS avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: notificacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  resumo TEXT NOT NULL,
  conteudo TEXT,
  link TEXT,
  metadata JSONB,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: mensagens_internas
-- ============================================================
CREATE TABLE IF NOT EXISTS mensagens_internas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id UUID NOT NULL,
  destinatario_id UUID NOT NULL,
  assunto TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: precos_planos
-- ============================================================
CREATE TABLE IF NOT EXISTS precos_planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  modalidade TEXT NOT NULL DEFAULT 'pilates',
  frequencia_semanal INTEGER NOT NULL DEFAULT 2,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: descontos_pacientes
-- ============================================================
CREATE TABLE IF NOT EXISTS descontos_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  preco_plano_id UUID REFERENCES precos_planos(id) ON DELETE SET NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL DEFAULT 0,
  motivo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: solicitacoes_remarcacao
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitacoes_remarcacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL,
  nova_data_horario TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  respondido_por UUID,
  respondido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: produtos
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque INTEGER NOT NULL DEFAULT 0,
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: patient_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  descricao TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: professional_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS professional_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL,
  nome TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pacientes_status ON pacientes(status);
CREATE INDEX IF NOT EXISTS idx_pacientes_profissional ON pacientes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON agendamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional ON agendamentos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_horario);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_enrollment ON agendamentos(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_paciente ON pagamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON notificacoes(user_id);

-- ============================================================
-- RLS: habilitar em todas as tabelas
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidade_profissional ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios_profissional ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_internas ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE descontos_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_remarcacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: allow all authenticated users
-- (ajuste por role conforme necessário)
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','user_roles','clinic_settings','modalidades','pacientes',
    'agendamentos','planos','pagamentos','commissions','evaluations',
    'evolutions','expenses','disponibilidade_profissional','bloqueios_profissional',
    'agenda_extra','feriados','avisos','notificacoes','mensagens_internas',
    'precos_planos','descontos_pacientes','solicitacoes_remarcacao',
    'produtos','patient_attachments','professional_documents'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_auth" ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_auth" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- TRIGGER: handle new auth user → create profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Atribuir role padrão de profissional se nenhuma role existir
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'profissional')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger no auth.users (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END;
$$;

-- ============================================================
SELECT 'Base tables migration concluída com sucesso!' AS status;
