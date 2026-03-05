-- Update commission trigger to handle professional ID changes
CREATE OR REPLACE FUNCTION auto_calculate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_session_value  NUMERIC;
  v_commission_val NUMERIC;
BEGIN
  -- Age quando status muda para 'realizado' OU quando o profissional muda e já está realizado
  IF (NEW.status = 'realizado' AND (OLD.status IS DISTINCT FROM 'realizado')) OR
     (NEW.status = 'realizado' AND NEW.profissional_id IS DISTINCT FROM OLD.profissional_id) THEN

    -- Busca o % de comissão do NOVO profissional
    SELECT percentage INTO v_commission_pct
    FROM commission_rules
    WHERE professional_id = NEW.profissional_id
    LIMIT 1;

    -- Se não tem regra, usa 0
    v_commission_pct := COALESCE(v_commission_pct, 0);
    v_session_value  := COALESCE(NEW.valor_sessao, 0);
    v_commission_val := ROUND((v_session_value * v_commission_pct / 100)::NUMERIC, 2);

    -- Remove split anterior se existir
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

-- Ensure trigger watches for both status AND professional_id changes
DROP TRIGGER IF EXISTS trg_auto_commission ON agendamentos;
CREATE TRIGGER trg_auto_commission
  AFTER UPDATE OF status, profissional_id ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_commission();
