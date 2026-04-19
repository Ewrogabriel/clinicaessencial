-- Corrigir trigger fn_update_plano_sessoes para detectar 'plano:<uuid>' em qualquer posição da observação
-- (atualmente usa LIKE 'plano:%' que exige a string começar com "plano:")

CREATE OR REPLACE FUNCTION public.fn_update_plano_sessoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plano_id uuid;
  v_match text;
BEGIN
  -- Detect "plano:<uuid>" anywhere in observacoes via regex
  IF NEW.observacoes IS NOT NULL THEN
    v_match := substring(NEW.observacoes from 'plano:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})');
    IF v_match IS NOT NULL THEN
      v_plano_id := v_match::uuid;

      IF TG_OP = 'UPDATE' THEN
        -- Session marked as realizado -> increment
        IF NEW.status = 'realizado' AND OLD.status IS DISTINCT FROM 'realizado' THEN
          UPDATE planos
            SET sessoes_utilizadas = sessoes_utilizadas + 1, updated_at = now()
            WHERE id = v_plano_id;
        END IF;

        -- Session was realizado but now cancelled/missed -> decrement
        IF OLD.status = 'realizado' AND NEW.status IN ('cancelado', 'falta', 'reposicao') THEN
          UPDATE planos
            SET sessoes_utilizadas = GREATEST(0, sessoes_utilizadas - 1), updated_at = now()
            WHERE id = v_plano_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger is attached (drop & recreate for safety)
DROP TRIGGER IF EXISTS trg_update_plano_sessoes ON public.agendamentos;
CREATE TRIGGER trg_update_plano_sessoes
AFTER INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_plano_sessoes();