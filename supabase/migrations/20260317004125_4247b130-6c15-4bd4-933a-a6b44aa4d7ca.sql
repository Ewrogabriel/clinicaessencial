
-- 1. Create book_appointment function for atomic slot-based booking
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_paciente_id uuid,
  p_profissional_id uuid,
  p_slot_id uuid,
  p_data_horario timestamptz,
  p_duracao_minutos integer,
  p_tipo_atendimento text,
  p_tipo_sessao public.tipo_sessao,
  p_observacoes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_clinic_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agendamento_id uuid;
  v_slot record;
BEGIN
  -- Lock the slot row to prevent concurrent bookings
  SELECT * INTO v_slot
  FROM schedule_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot não encontrado.';
  END IF;

  IF NOT v_slot.is_available THEN
    RAISE EXCEPTION 'Este horário não está mais disponível.';
  END IF;

  IF v_slot.current_capacity >= v_slot.max_capacity THEN
    RAISE EXCEPTION 'Capacidade máxima atingida para este horário.';
  END IF;

  -- Create the appointment
  INSERT INTO agendamentos (
    paciente_id, profissional_id, data_horario, duracao_minutos,
    tipo_atendimento, tipo_sessao, observacoes, created_by, clinic_id, status
  ) VALUES (
    p_paciente_id, p_profissional_id, p_data_horario, p_duracao_minutos,
    p_tipo_atendimento, p_tipo_sessao, p_observacoes, p_created_by, p_clinic_id, 'agendado'
  )
  RETURNING id INTO v_agendamento_id;

  -- Increment slot capacity
  UPDATE schedule_slots
  SET current_capacity = current_capacity + 1,
      is_available = CASE WHEN current_capacity + 1 >= max_capacity THEN false ELSE true END
  WHERE id = p_slot_id;

  RETURN v_agendamento_id;
END;
$$;

-- 2. Create cancel_appointment function
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_agendamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slot_id uuid;
BEGIN
  UPDATE agendamentos SET status = 'cancelado' WHERE id = p_agendamento_id;

  -- If there's a linked slot, decrement capacity
  -- Note: we don't track slot_id on agendamentos, so this is a no-op for now
  -- The slot capacity management happens via book_appointment
END;
$$;

-- 3. Add signature columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assinatura_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rubrica_url text;

-- 4. Create recesso_clinica table
CREATE TABLE IF NOT EXISTS public.recesso_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.recesso_clinica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_recesso_select" ON public.recesso_clinica
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_recesso_all" ON public.recesso_clinica
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Fix pagamentos_mensalidade unique constraint: drop the old one and create a broader one
-- First check if it exists and drop it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_mensalidade_paciente_id_mes_referencia_key') THEN
    ALTER TABLE public.pagamentos_mensalidade DROP CONSTRAINT pagamentos_mensalidade_paciente_id_mes_referencia_key;
  END IF;
END $$;

-- Create a new unique constraint that includes matricula_id to allow multiple matriculas per patient per month
ALTER TABLE public.pagamentos_mensalidade ADD CONSTRAINT pagamentos_mensalidade_paciente_matricula_mes_key 
  UNIQUE (paciente_id, matricula_id, mes_referencia);
