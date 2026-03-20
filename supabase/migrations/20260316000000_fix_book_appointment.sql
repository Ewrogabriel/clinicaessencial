-- ============================================================
-- Fix: book_appointment RPC + matriculas tipo_atendimento
-- ============================================================

-- 1. Ensure tipo_atendimento column exists in matriculas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'matriculas'
          AND column_name  = 'tipo_atendimento'
    ) THEN
        ALTER TABLE public.matriculas ADD COLUMN tipo_atendimento TEXT;
    END IF;
END $$;

-- 2. Ensure due_day column exists in matriculas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'matriculas'
          AND column_name  = 'due_day'
    ) THEN
        ALTER TABLE public.matriculas
            ADD COLUMN due_day INTEGER DEFAULT 10 CHECK (due_day BETWEEN 1 AND 31);
    END IF;
END $$;

-- 3. Create/replace book_appointment RPC
--    Works with disponibilidade_profissional (the live-DB slot source used by
--    useScheduleSlots). Does NOT require a schedule_slots table.
--
--    Parameters intentionally match the TypeScript caller in appointmentService.ts
--    so PostgREST can resolve the function by named-parameter lookup.
CREATE OR REPLACE FUNCTION public.book_appointment(
    p_paciente_id      UUID,
    p_profissional_id  UUID,
    p_slot_id          UUID,
    p_data_horario     TIMESTAMPTZ,
    p_duracao_minutos  INTEGER,
    p_tipo_atendimento TEXT,
    p_tipo_sessao      TEXT,
    p_observacoes      TEXT DEFAULT NULL,
    p_created_by       UUID DEFAULT NULL,
    p_clinic_id        UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slot_hora_inicio  TIME;
    v_slot_hora_fim     TIME;
    v_max_cap           INTEGER;
    v_current_count     INTEGER;
    v_agendamento_id    UUID;
    v_window_start      TIMESTAMPTZ;
    v_window_end        TIMESTAMPTZ;
BEGIN
    -- Resolve the slot via disponibilidade_profissional
    SELECT hora_inicio, hora_fim, max_pacientes
      INTO v_slot_hora_inicio, v_slot_hora_fim, v_max_cap
      FROM public.disponibilidade_profissional
     WHERE id = p_slot_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Horário não encontrado.';
    END IF;

    v_max_cap := COALESCE(v_max_cap, 1);

    -- Compute the absolute time-window boundaries once so the capacity check
    -- can use a simple range scan without per-row casts (index-friendly).
    v_window_start := (p_data_horario::date + v_slot_hora_inicio)::timestamp AT TIME ZONE 'UTC';
    v_window_end   := (p_data_horario::date + v_slot_hora_fim)::timestamp AT TIME ZONE 'UTC';

    -- Count active appointments for this professional in this time-window
    SELECT COUNT(*) INTO v_current_count
      FROM public.agendamentos
     WHERE profissional_id = p_profissional_id
       AND data_horario >= v_window_start
       AND data_horario <  v_window_end
       AND status NOT IN ('cancelado', 'falta');

    IF v_current_count >= v_max_cap THEN
        RAISE EXCEPTION 'Este horário está sem vagas disponíveis.';
    END IF;

    -- Insert the appointment (no slot_id column in agendamentos in the live DB)
    INSERT INTO public.agendamentos (
        paciente_id,
        profissional_id,
        data_horario,
        duracao_minutos,
        tipo_atendimento,
        tipo_sessao,
        status,
        observacoes,
        created_by,
        clinic_id
    ) VALUES (
        p_paciente_id,
        p_profissional_id,
        p_data_horario,
        p_duracao_minutos,
        p_tipo_atendimento,
        p_tipo_sessao,
        'agendado',
        p_observacoes,
        p_created_by,
        p_clinic_id
    )
    RETURNING id INTO v_agendamento_id;

    RETURN v_agendamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_appointment(
    UUID, UUID, UUID, TIMESTAMPTZ, INTEGER, TEXT, TEXT, TEXT, UUID, UUID
) TO authenticated;
