
-- Trigger function: when agendamento linked to a plano changes status,
-- update sessoes_utilizadas accordingly
CREATE OR REPLACE FUNCTION public.fn_update_plano_sessoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plano_id uuid;
BEGIN
  -- Check if this agendamento is linked to a plano via observacoes field
  -- Format: "plano:<uuid>"
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes LIKE 'plano:%' THEN
    v_plano_id := substring(NEW.observacoes from 'plano:([0-9a-f-]+)')::uuid;
    
    IF v_plano_id IS NOT NULL THEN
      -- On INSERT: no change to sessoes_utilizadas (session just scheduled)
      -- On UPDATE: check status transitions
      IF TG_OP = 'UPDATE' THEN
        -- Session marked as realizado (completed) -> increment
        IF NEW.status = 'realizado' AND OLD.status != 'realizado' THEN
          UPDATE planos SET sessoes_utilizadas = sessoes_utilizadas + 1, updated_at = now()
          WHERE id = v_plano_id;
        END IF;
        
        -- Session was realizado but changed to cancelado/falta -> decrement
        IF OLD.status = 'realizado' AND NEW.status IN ('cancelado', 'falta') THEN
          UPDATE planos SET sessoes_utilizadas = GREATEST(0, sessoes_utilizadas - 1), updated_at = now()
          WHERE id = v_plano_id;
        END IF;
        
        -- Session cancelled from agendado/confirmado/pendente -> no change (wasn't counted)
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on agendamentos table
DROP TRIGGER IF EXISTS trg_update_plano_sessoes ON public.agendamentos;
CREATE TRIGGER trg_update_plano_sessoes
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_plano_sessoes();
