-- 1. Adicionar coluna observacoes em commissions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='observacoes') THEN
        ALTER TABLE commissions ADD COLUMN observacoes TEXT;
    END IF;
END $$;

-- 2. Garantir que as colunas críticas em fechamentos_comissao existem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fechamentos_comissao' AND column_name='clinic_id') THEN
        ALTER TABLE fechamentos_comissao ADD COLUMN clinic_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fechamentos_comissao' AND column_name='data_pagamento') THEN
        ALTER TABLE fechamentos_comissao ADD COLUMN data_pagamento TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Garantir permissões básicas para o role authenticated nessas tabelas
GRANT ALL ON TABLE commissions TO authenticated;
GRANT ALL ON TABLE fechamentos_comissao TO authenticated;
GRANT ALL ON TABLE expenses TO authenticated;
