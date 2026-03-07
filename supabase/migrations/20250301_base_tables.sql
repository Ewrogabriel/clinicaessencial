-- Create base tables for app-essencial

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pacientes table
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  data_nascimento DATE,
  cpf VARCHAR(11),
  sexo VARCHAR(10),
  profissional_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  endereco VARCHAR(255),
  numero VARCHAR(10),
  complemento VARCHAR(255),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(8),
  responsavel_nome VARCHAR(255),
  responsavel_email VARCHAR(255),
  responsavel_telefone VARCHAR(20),
  responsavel_cpf VARCHAR(11),
  responsavel_parentesco VARCHAR(50),
  responsavel_endereco VARCHAR(255),
  responsavel_numero VARCHAR(10),
  responsavel_complemento VARCHAR(255),
  responsavel_bairro VARCHAR(100),
  responsavel_cidade VARCHAR(100),
  responsavel_estado VARCHAR(2),
  responsavel_cep VARCHAR(8)
);

CREATE INDEX IF NOT EXISTS idx_pacientes_profissional_id ON pacientes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_created_by ON pacientes(created_by);
CREATE INDEX IF NOT EXISTS idx_pacientes_email ON pacientes(email);
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf ON pacientes(cpf);
