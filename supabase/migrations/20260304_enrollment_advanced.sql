-- ====================================================
-- MIGRATION: Módulo Matrícula Recorrente Avançada
-- PostgreSQL 14 (Supabase) compatible
-- Execute no SQL Editor do Supabase
-- ====================================================
-- NOTA: FKs para tabelas pré-existentes (pacientes, agendamentos, profiles)
-- foram removidas para evitar erros de resolução de schema.
-- As relações são gerenciadas via queries no frontend.

-- ============================================================
-- ITEM 1: Criar tabela matriculas (enrollment)
-- ============================================================
CREATE TABLE IF NOT EXISTS matriculas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL,
  profissional_id UUID,
  tipo TEXT NOT NULL DEFAULT 'mensal',
  tipo_atendimento TEXT,
  valor_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_day INTEGER DEFAULT 10 CHECK (due_day BETWEEN 1 AND 31),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  cancellation_date DATE,
  desconto NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  criada_por UUID,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'cancelada', 'vencida')),
  total_sessoes_mes INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ITEM 2: Criar tabela weekly_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  time TIME NOT NULL,
  professional_id UUID NOT NULL,
  session_duration INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ITEM 3: Adicionar colunas em agendamentos (se não existirem)
-- ============================================================
DO $$
BEGIN
  -- Só executa se a tabela agendamentos já existir no schema public
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agendamentos'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'enrollment_id'
    ) THEN
      ALTER TABLE agendamentos ADD COLUMN enrollment_id UUID;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'rescheduled_from_id'
    ) THEN
      ALTER TABLE agendamentos ADD COLUMN rescheduled_from_id UUID;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'cancellation_reason'
    ) THEN
      ALTER TABLE agendamentos ADD COLUMN cancellation_reason TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'cancellation_justification'
    ) THEN
      ALTER TABLE agendamentos ADD COLUMN cancellation_justification TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'justification_status'
    ) THEN
      ALTER TABLE agendamentos ADD COLUMN justification_status TEXT
        CHECK (justification_status IN ('pending', 'approved', 'denied'));
    END IF;

  ELSE
    RAISE NOTICE 'Tabela agendamentos não encontrada — colunas adicionais serão ignoradas.';
  END IF;
END;
$$;

-- ============================================================
-- ITEM 4: Criar tabela commission_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL UNIQUE,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ITEM 5: Criar tabela commission_splits
-- (session_id referencia agendamentos sem FK constraint)
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  commission_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ITEM 6: Criar tabela cancellation_policies
-- ============================================================
CREATE TABLE IF NOT EXISTS cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_hours_before_cancel INTEGER NOT NULL DEFAULT 3,
  reschedule_limit_days INTEGER NOT NULL DEFAULT 30,
  require_justification_after_limit BOOLEAN NOT NULL DEFAULT true,
  monthly_reschedule_limit INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir política padrão
INSERT INTO cancellation_policies (min_hours_before_cancel, reschedule_limit_days, require_justification_after_limit, monthly_reschedule_limit)
SELECT 3, 30, true, 2
WHERE NOT EXISTS (SELECT 1 FROM cancellation_policies);

-- ============================================================
-- ITEM 7: Criar tabela reschedule_credits
-- (FKs para agendamentos removidas; enrollment_id mantém FK interna)
-- ============================================================
CREATE TABLE IF NOT EXISTS reschedule_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  generated_from_session_id UUID NOT NULL,
  expiration_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  used_for_session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ITEM 8: Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_matriculas_paciente_id ON matriculas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_status ON matriculas(status);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_enrollment_id ON weekly_schedules(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_professional_id ON weekly_schedules(professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_session_id ON commission_splits(session_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_professional_id ON commission_splits(professional_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_credits_enrollment_id ON reschedule_credits(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_credits_status ON reschedule_credits(status);

-- Índice em agendamentos.enrollment_id (só se a coluna foi criada)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'enrollment_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'agendamentos' AND indexname = 'idx_agendamentos_enrollment_id'
  ) THEN
    CREATE INDEX idx_agendamentos_enrollment_id ON agendamentos(enrollment_id);
  END IF;
END;
$$;

-- ============================================================
-- ITEM 9: Triggers para updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_matriculas_updated_at') THEN
    CREATE TRIGGER update_matriculas_updated_at
      BEFORE UPDATE ON matriculas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_weekly_schedules_updated_at') THEN
    CREATE TRIGGER update_weekly_schedules_updated_at
      BEFORE UPDATE ON weekly_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_commission_rules_updated_at') THEN
    CREATE TRIGGER update_commission_rules_updated_at
      BEFORE UPDATE ON commission_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cancellation_policies_updated_at') THEN
    CREATE TRIGGER update_cancellation_policies_updated_at
      BEFORE UPDATE ON cancellation_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reschedule_credits_updated_at') THEN
    CREATE TRIGGER update_reschedule_credits_updated_at
      BEFORE UPDATE ON reschedule_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ============================================================
-- ITEM 10: RLS Policies
-- (DROP IF EXISTS + CREATE: compatível com PostgreSQL 14)
-- ============================================================
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reschedule_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matriculas_authenticated" ON matriculas;
CREATE POLICY "matriculas_authenticated" ON matriculas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "weekly_schedules_authenticated" ON weekly_schedules;
CREATE POLICY "weekly_schedules_authenticated" ON weekly_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "commission_rules_authenticated" ON commission_rules;
CREATE POLICY "commission_rules_authenticated" ON commission_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "commission_splits_authenticated" ON commission_splits;
CREATE POLICY "commission_splits_authenticated" ON commission_splits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cancellation_policies_read" ON cancellation_policies;
CREATE POLICY "cancellation_policies_read" ON cancellation_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cancellation_policies_write" ON cancellation_policies;
CREATE POLICY "cancellation_policies_write" ON cancellation_policies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reschedule_credits_authenticated" ON reschedule_credits;
CREATE POLICY "reschedule_credits_authenticated" ON reschedule_credits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- ITEM 11: Funções utilitárias
-- ============================================================

CREATE OR REPLACE FUNCTION expire_reschedule_credits()
RETURNS void AS $$
BEGIN
  UPDATE reschedule_credits
  SET status = 'expired'
  WHERE status = 'available' AND expiration_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_session_value_for_enrollment(
  p_enrollment_id UUID, p_year INT, p_month INT
) RETURNS NUMERIC AS $$
DECLARE
  v_session_count INTEGER;
  v_monthly_value NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_session_count
  FROM agendamentos
  WHERE enrollment_id = p_enrollment_id
    AND EXTRACT(YEAR FROM data_horario::DATE) = p_year
    AND EXTRACT(MONTH FROM data_horario::DATE) = p_month
    AND status != 'cancelado';

  SELECT valor_mensal INTO v_monthly_value FROM matriculas WHERE id = p_enrollment_id;

  IF v_session_count = 0 THEN RETURN 0; END IF;
  RETURN ROUND(v_monthly_value / v_session_count, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
SELECT 'Migration concluída com sucesso!' AS status;