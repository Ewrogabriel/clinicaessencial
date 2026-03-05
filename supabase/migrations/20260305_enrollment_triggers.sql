-- ====================================================
-- MIGRATION: Comissão automática + geração mensal de sessões
-- Execute no SQL Editor do Supabase
-- ====================================================

-- ============================================================
-- 1. TRIGGER: Auto-calcular comissão quando sessão é realizada
-- ============================================================
CREATE OR REPLACE FUNCTION auto_calculate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_session_value  NUMERIC;
  v_commission_val NUMERIC;
BEGIN
  -- Só age quando status muda para 'realizado'
  IF NEW.status = 'realizado' AND (OLD.status IS DISTINCT FROM 'realizado') THEN

    -- Busca o % de comissão do profissional
    SELECT percentage INTO v_commission_pct
    FROM commission_rules
    WHERE professional_id = NEW.profissional_id
    LIMIT 1;

    -- Se não tem regra, usa 0
    v_commission_pct := COALESCE(v_commission_pct, 0);
    v_session_value  := COALESCE(NEW.valor_sessao, 0);
    v_commission_val := ROUND((v_session_value * v_commission_pct / 100)::NUMERIC, 2);

    -- Remove split anterior se existir (ex: reagendamento)
    DELETE FROM commission_splits WHERE session_id = NEW.id;

    -- Insere novo split
    IF v_commission_val > 0 THEN
      INSERT INTO commission_splits (session_id, professional_id, commission_value)
      VALUES (NEW.id, NEW.profissional_id, v_commission_val);
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trg_auto_commission ON agendamentos;

CREATE TRIGGER trg_auto_commission
  AFTER UPDATE OF status ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_commission();

-- ============================================================
-- 2. FUNÇÃO: Gerar sessões do próximo mês para matrícula ativa
-- (Chamada manualmente via RPC do frontend ou pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_monthly_sessions(p_enrollment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_enrollment    RECORD;
  v_schedule      RECORD;
  v_month_start   DATE;
  v_month_end     DATE;
  v_session_value NUMERIC;
  v_total_weeks   NUMERIC := 4.33;
  v_count_schedules INTEGER;
  v_current       DATE;
  inserted        INTEGER := 0;
BEGIN
  -- Busca a matrícula
  SELECT * INTO v_enrollment FROM matriculas WHERE id = p_enrollment_id;

  IF v_enrollment IS NULL THEN
    RAISE EXCEPTION 'Matrícula não encontrada: %', p_enrollment_id;
  END IF;

  IF v_enrollment.status NOT IN ('ativa') THEN
    RETURN 0; -- Não gera se não estiver ativa
  END IF;

  -- Define o período: próximo mês
  v_month_start := date_trunc('month', now())::DATE + INTERVAL '1 month';
  v_month_end   := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Conta quantos schedules existem para calcular valor por sessão
  SELECT COUNT(*) INTO v_count_schedules
  FROM weekly_schedules WHERE enrollment_id = p_enrollment_id;

  IF v_count_schedules = 0 THEN RETURN 0; END IF;

  v_session_value := ROUND(v_enrollment.valor_mensal / (v_count_schedules * v_total_weeks), 2);

  -- Para cada horário semanal, gera as datas do mês
  FOR v_schedule IN
    SELECT * FROM weekly_schedules WHERE enrollment_id = p_enrollment_id
  LOOP
    v_current := v_month_start;
    WHILE v_current <= v_month_end LOOP
      IF EXTRACT(DOW FROM v_current) = v_schedule.weekday THEN
        -- Verifica se sessão já existe para não duplicar
        IF NOT EXISTS (
          SELECT 1 FROM agendamentos
          WHERE enrollment_id = p_enrollment_id
            AND profissional_id = v_schedule.professional_id
            AND data_horario::DATE = v_current
        ) THEN
          INSERT INTO agendamentos (
            paciente_id, profissional_id, data_horario,
            duracao_minutos, tipo_atendimento, tipo_sessao,
            status, recorrente, enrollment_id, valor_sessao,
            created_by
          ) VALUES (
            v_enrollment.paciente_id,
            v_schedule.professional_id,
            (v_current || ' ' || v_schedule.time)::TIMESTAMPTZ,
            v_schedule.session_duration,
            v_enrollment.tipo_atendimento,
            'individual',
            'agendado',
            true,
            p_enrollment_id,
            v_session_value,
            v_enrollment.criada_por
          );
          inserted := inserted + 1;
        END IF;
      END IF;
      v_current := v_current + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. FUNÇÃO: Gerar sessões para TODAS as matrículas ativas
-- (Chamar via pg_cron todo dia 25 do mês, por exemplo)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_all_monthly_sessions()
RETURNS TEXT AS $$
DECLARE
  v_enrollment RECORD;
  total_inserted INTEGER := 0;
  per_enrollment INTEGER;
BEGIN
  FOR v_enrollment IN
    SELECT id FROM matriculas WHERE status = 'ativa' AND auto_renew = true
  LOOP
    per_enrollment := generate_monthly_sessions(v_enrollment.id);
    total_inserted := total_inserted + per_enrollment;
  END LOOP;

  RETURN format('Sessões geradas: %s para %s matrículas ativas',
    total_inserted,
    (SELECT COUNT(*) FROM matriculas WHERE status = 'ativa' AND auto_renew = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. ADICIONAR coluna bloqueado_admin em matriculas
-- (Controle manual do admin para bloquear novos agendamentos)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matriculas' AND column_name = 'bloqueado_admin'
  ) THEN
    ALTER TABLE matriculas ADD COLUMN bloqueado_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matriculas' AND column_name = 'bloqueio_motivo'
  ) THEN
    ALTER TABLE matriculas ADD COLUMN bloqueio_motivo TEXT;
  END IF;
END;
$$;

-- ============================================================
-- 5. Garantir que cancellation_policies e commission_rules
--    existam (criadas pela migration anterior, idempotente)
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

INSERT INTO cancellation_policies (min_hours_before_cancel, reschedule_limit_days, require_justification_after_limit, monthly_reschedule_limit)
SELECT 3, 30, true, 2
WHERE NOT EXISTS (SELECT 1 FROM cancellation_policies);

-- ============================================================
SELECT 'Triggers e funções de matrícula criados com sucesso!' AS status;
