-- =====================================================
-- Migration: Ensure schedule_slots and improve pagamentos_mensalidade
-- Date: 2026-03-17
-- =====================================================

-- 1. Garante que a coluna data_vencimento existe em pagamentos_mensalidade
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'pagamentos_mensalidade'
          AND column_name  = 'data_vencimento'
    ) THEN
        ALTER TABLE public.pagamentos_mensalidade ADD COLUMN data_vencimento DATE;
    END IF;
END $$;

-- 2. Garante que as tabelas de agenda existem (caso migrations anteriores tenham falhado)
CREATE TABLE IF NOT EXISTS public.availability_slots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL,
    clinic_id       UUID NOT NULL,
    day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    duration_min    INTEGER NOT NULL DEFAULT 60,
    max_capacity    INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedule_slots (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id      UUID NOT NULL,
    clinic_id            UUID NOT NULL,
    availability_slot_id UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL,
    date                 DATE NOT NULL,
    start_time           TIME NOT NULL,
    end_time             TIME NOT NULL,
    duration_min         INTEGER NOT NULL DEFAULT 60,
    max_capacity         INTEGER NOT NULL DEFAULT 1,
    current_capacity     INTEGER NOT NULL DEFAULT 0 CHECK (current_capacity >= 0),
    is_blocked           BOOLEAN NOT NULL DEFAULT FALSE,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (professional_id, date, start_time)
);

-- 3. Recria a função book_appointment garantindo todos os parâmetros solicitados
CREATE OR REPLACE FUNCTION public.book_appointment(
    p_clinic_id        UUID,
    p_created_by       UUID,
    p_data_horario     TIMESTAMPTZ,
    p_duracao_minutos  INTEGER,
    p_observacoes      TEXT,
    p_paciente_id      UUID,
    p_profissional_id  UUID,
    p_slot_id          UUID,
    p_tipo_atendimento TEXT,
    p_tipo_sessao      TEXT
)
RETURNS UUID AS $$
DECLARE
    v_slot            RECORD;
    v_agendamento_id  UUID;
BEGIN
    -- Bloqueia o slot para evitar concorrência
    SELECT * INTO v_slot FROM public.schedule_slots WHERE id = p_slot_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Slot não encontrado.'; END IF;
    IF v_slot.is_blocked THEN RAISE EXCEPTION 'Este horário está bloqueado.'; END IF;
    IF v_slot.current_capacity >= v_slot.max_capacity THEN RAISE EXCEPTION 'Este horário está sem vagas disponíveis.'; END IF;

    -- Insere o agendamento
    INSERT INTO public.agendamentos (
        paciente_id,
        profissional_id,
        slot_id,
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
        p_slot_id,
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

    -- Incrementa capacidade do slot (se ainda não houver trigger configurada)
    UPDATE public.schedule_slots
    SET current_capacity = current_capacity + 1
    WHERE id = p_slot_id;

    RETURN v_agendamento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.book_appointment(UUID, UUID, TIMESTAMPTZ, INTEGER, TEXT, UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
