-- ============================================================================
-- MIGRATION: Adicionar suporte a endereços e integrações com Banco Inter, Nibo, TransmiteNota
-- Data: 2026-03-20
-- ============================================================================

-- ============================================================================
-- 1. Adicionar campos de endereço à tabela pre_cadastros
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.pre_cadastros') IS NOT NULL THEN
    ALTER TABLE pre_cadastros
    ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
    ADD COLUMN IF NOT EXISTS rua VARCHAR(255),
    ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
    ADD COLUMN IF NOT EXISTS complemento VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
    ADD COLUMN IF NOT EXISTS estado VARCHAR(2);

    COMMENT ON COLUMN pre_cadastros.cep IS 'CEP do paciente (formato: 12345-678)';
    COMMENT ON COLUMN pre_cadastros.rua IS 'Nome da rua/logradouro';
    COMMENT ON COLUMN pre_cadastros.numero IS 'Número do endereço';
    COMMENT ON COLUMN pre_cadastros.complemento IS 'Complemento (apt, sala, etc)';
    COMMENT ON COLUMN pre_cadastros.bairro IS 'Bairro do paciente';
    COMMENT ON COLUMN pre_cadastros.cidade IS 'Cidade (município)';
    COMMENT ON COLUMN pre_cadastros.estado IS 'UF do estado (2 dígitos)';
  ELSE
    RAISE NOTICE 'Tabela pre_cadastros não existe, seção 1 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 2. Adicionar campos de endereço à tabela pacientes
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.pacientes') IS NOT NULL THEN
    ALTER TABLE pacientes
    ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
    ADD COLUMN IF NOT EXISTS rua VARCHAR(255),
    ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
    ADD COLUMN IF NOT EXISTS complemento VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
    ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
    ADD COLUMN IF NOT EXISTS nibo_client_id VARCHAR(255);

    COMMENT ON COLUMN pacientes.nibo_client_id IS 'ID do cliente correspondente no Nibo para herança de dados financeiros';
  ELSE
    RAISE NOTICE 'Tabela pacientes não existe, seção 2 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 3. Adicionar campos de rastreamento de integrações à tabela pagamentos_sessoes
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.pagamentos_sessoes') IS NOT NULL THEN
    ALTER TABLE pagamentos_sessoes
    ADD COLUMN IF NOT EXISTS inter_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS inter_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS nibo_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nfs_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nfs_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS nfs_url_pdf TEXT,
    ADD COLUMN IF NOT EXISTS nfs_emissao_em TIMESTAMP;

    COMMENT ON COLUMN pagamentos_sessoes.inter_id IS 'ID da transação no Banco Inter';
    COMMENT ON COLUMN pagamentos_sessoes.inter_status IS 'Status retornado pelo Banco Inter (ex: PAGO, VENCIDO, PENDENTE)';
    COMMENT ON COLUMN pagamentos_sessoes.nibo_id IS 'ID do lançamento no Nibo';
    COMMENT ON COLUMN pagamentos_sessoes.nfs_id IS 'ID da nota fiscal no TransmiteNota';
    COMMENT ON COLUMN pagamentos_sessoes.nfs_status IS 'Status da nota (ex: processando, emitida, erro)';
    COMMENT ON COLUMN pagamentos_sessoes.nfs_url_pdf IS 'Link para o PDF da nota fiscal';
    COMMENT ON COLUMN pagamentos_sessoes.nfs_emissao_em IS 'Data de emissão da NFS-e';
  ELSE
    RAISE NOTICE 'Tabela pagamentos_sessoes não existe, seção 3 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 4. Criar tabela config_integracoes
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.clinicas') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS config_integracoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  
  -- Banco Inter
  inter_client_id VARCHAR(255),
  inter_client_secret TEXT,
  inter_certificado_crt TEXT,
  inter_certificado_key TEXT,
  inter_ativo BOOLEAN DEFAULT FALSE,
  
  -- Nibo
  nibo_api_key TEXT,
  nibo_account_id VARCHAR(255),
  nibo_ativo BOOLEAN DEFAULT FALSE,
  nibo_plano VARCHAR(50),
  
  -- TransmiteNota (NFe/NFS-e)
  transmitenota_token TEXT,
  transmitenota_cnpj_tomador VARCHAR(20),
  transmitenota_ativo BOOLEAN DEFAULT FALSE,
  transmitenota_ambiente VARCHAR(20),
  
  -- Informações gerais
  responsavel_nome VARCHAR(255),
  responsavel_email VARCHAR(255),
  responsavel_telefone VARCHAR(20),
  
  -- Controle
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  atualizado_por UUID REFERENCES auth.users(id),
  
      CONSTRAINT unique_clinic_config UNIQUE(clinic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_config_integracoes_clinic_id ON config_integracoes(clinic_id);
    ALTER TABLE config_integracoes ENABLE ROW LEVEL SECURITY;

    IF to_regclass('public.user_clinic_access') IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'config_integracoes'
          AND policyname = 'Usuários podem gerenciar integrações da sua clínica'
      ) THEN
        CREATE POLICY "Usuários podem gerenciar integrações da sua clínica"
          ON config_integracoes
          FOR ALL
          USING (
            clinic_id IN (
              SELECT clinic_id FROM user_clinic_access WHERE user_id = auth.uid()
            )
          );
      END IF;
    ELSE
      RAISE NOTICE 'Tabela user_clinic_access não existe, policy de config_integracoes não foi criada.';
    END IF;

    COMMENT ON TABLE config_integracoes IS 'Configurações de integrações da clínica com Banco Inter, Nibo e TransmiteNota';
  ELSE
    RAISE NOTICE 'Tabela clinicas não existe, seção 4 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 5. Criar tabela de log de sincronizações
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.clinicas') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS integracao_sync_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
      tipo VARCHAR(50),
      acao VARCHAR(100),
      status VARCHAR(50),
      dados_enviados JSONB,
      resposta_recebida JSONB,
      erro_mensagem TEXT,
      sincronizado_em TIMESTAMP DEFAULT NOW(),
      proximo_retry TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sync_logs_clinic_id ON integracao_sync_logs(clinic_id);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_tipo ON integracao_sync_logs(tipo);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON integracao_sync_logs(status);

    COMMENT ON TABLE integracao_sync_logs IS 'Log de todas as sincronizações com sistemas externos (Inter, Nibo, TransmiteNota)';
  ELSE
    RAISE NOTICE 'Tabela clinicas não existe, seção 5 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 6. Trigger para atualizar campo atualizado_em
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.config_integracoes') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION update_config_integracoes_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.atualizado_em = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_config_integracoes_updated_at ON config_integracoes;

    CREATE TRIGGER trigger_config_integracoes_updated_at
      BEFORE UPDATE ON config_integracoes
      FOR EACH ROW
      EXECUTE FUNCTION update_config_integracoes_updated_at();
  ELSE
    RAISE NOTICE 'Tabela config_integracoes não existe, seção 6 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 7. Adicionar função RPC para sincronização segura
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.config_integracoes') IS NOT NULL
     AND to_regclass('public.integracao_sync_logs') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION sincronizar_integracao(
      p_clinic_id UUID,
      p_tipo VARCHAR,
      p_acao VARCHAR,
      p_payload JSONB
    )
    RETURNS JSONB AS $fn$
    DECLARE
      v_config RECORD;
      v_resultado JSONB;
      v_has_access_control BOOLEAN;
      v_user_has_access BOOLEAN;
    BEGIN
      -- Em ambientes sem user_clinic_access (staging legado), não bloqueia criação/execução da RPC.
      v_has_access_control := to_regclass('public.user_clinic_access') IS NOT NULL;

      IF v_has_access_control THEN
        EXECUTE
          'SELECT EXISTS (
             SELECT 1
             FROM user_clinic_access
             WHERE clinic_id = $1
               AND user_id = auth.uid()
           )'
        INTO v_user_has_access
        USING p_clinic_id;

        IF NOT COALESCE(v_user_has_access, FALSE) THEN
          RAISE EXCEPTION 'Acesso negado à clínica %', p_clinic_id;
        END IF;
      END IF;

      SELECT * INTO v_config FROM config_integracoes WHERE clinic_id = p_clinic_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuração de integração não encontrada para clínica %', p_clinic_id;
      END IF;

      INSERT INTO integracao_sync_logs (
        clinic_id, tipo, acao, status, dados_enviados
      ) VALUES (
        p_clinic_id, p_tipo, p_acao, 'pendente', p_payload
      );

      v_resultado := jsonb_build_object(
        'status', 'queued',
        'tipo', p_tipo,
        'acao', p_acao,
        'mensagem', 'Sincronização enfileirada para processamento'
      );

      RETURN v_resultado;
    END;
    $fn$ LANGUAGE plpgsql SECURITY DEFINER;

    GRANT EXECUTE ON FUNCTION sincronizar_integracao TO authenticated;
  ELSE
    RAISE NOTICE 'Dependências ausentes para criar sincronizar_integracao, seção 7 ignorada.';
  END IF;
END $$;

-- ============================================================================
-- Mensagem de confirmação
-- ============================================================================
-- Migração concluída com sucesso!
-- Novas tabelas e colunas adicionadas:
-- - Campos de endereço em: pre_cadastros, pacientes
-- - Campos de integração em: pagamentos_sessoes
-- - Tabela: config_integracoes (configurações de Banco Inter, Nibo, TransmiteNota)
-- - Tabela: integracao_sync_logs (histórico de sincronizações)
-- - Função RPC: sincronizar_integracao() para iniciar sincronizações

-- Verifique se a função existe
SELECT proname
FROM pg_proc
WHERE proname = 'sincronizar_integracao';
