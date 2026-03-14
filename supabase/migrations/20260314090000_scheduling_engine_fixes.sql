-- =====================================================
-- Migration: Scheduling Engine Fixes
-- Date: 2026-03-14
-- Fixes:
--   1. cancel_appointment RPC: atomically cancels an appointment
--      and decrements the corresponding slot capacity.
--   2. sync_slot_capacity trigger: handle DELETE case so that
--      hard-deleted appointments (e.g. admin purge) also release
--      the slot spot.
--   3. schedule_slots indexes: add clinic_id + date compound index
--      and a partial index on available slots for faster calendar
--      loading.
-- =====================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. cancel_appointment RPC
--    • Sets appointment status to 'cancelado'
--    • Decrements the slot's current_capacity (floor at 0)
--    • Idempotent: safe to call on an already-cancelled appointment
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_agendamento_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_slot_id UUID;
    v_status  TEXT;
BEGIN
    SELECT slot_id, status INTO v_slot_id, v_status
    FROM public.agendamentos
    WHERE id = p_agendamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado: %', p_agendamento_id;
    END IF;

    -- Already cancelled — nothing to do
    IF v_status = 'cancelado' THEN
        RETURN;
    END IF;

    UPDATE public.agendamentos
    SET status = 'cancelado'
    WHERE id = p_agendamento_id;

    -- Release the slot if applicable (the trigger handles this too, but we do
    -- it here as well so the RPC is self-contained when called directly)
    IF v_slot_id IS NOT NULL THEN
        UPDATE public.schedule_slots
        SET current_capacity = GREATEST(current_capacity - 1, 0),
            updated_at        = NOW()
        WHERE id = v_slot_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sync_slot_capacity trigger — add DELETE handling
--    When an appointment row is physically deleted (e.g. admin data purge),
--    we must release the slot capacity just like a cancellation.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_slot_capacity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.slot_id IS NOT NULL THEN
        UPDATE public.schedule_slots
        SET current_capacity = current_capacity + 1,
            updated_at        = NOW()
        WHERE id = NEW.slot_id;

    ELSIF TG_OP = 'UPDATE' AND NEW.slot_id IS NOT NULL
        AND OLD.status != 'cancelado' AND NEW.status = 'cancelado' THEN
        UPDATE public.schedule_slots
        SET current_capacity = GREATEST(current_capacity - 1, 0),
            updated_at        = NOW()
        WHERE id = NEW.slot_id;

    ELSIF TG_OP = 'UPDATE' AND NEW.slot_id IS NOT NULL
        AND OLD.status = 'cancelado' AND NEW.status != 'cancelado' THEN
        UPDATE public.schedule_slots
        SET current_capacity = current_capacity + 1,
            updated_at        = NOW()
        WHERE id = NEW.slot_id;

    ELSIF TG_OP = 'DELETE' AND OLD.slot_id IS NOT NULL
        AND OLD.status != 'cancelado' THEN
        -- Physical delete of an active appointment releases the spot
        UPDATE public.schedule_slots
        SET current_capacity = GREATEST(current_capacity - 1, 0),
            updated_at        = NOW()
        WHERE id = OLD.slot_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger to include DELETE events
DROP TRIGGER IF EXISTS trg_agendamentos_sync_slot_capacity ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_sync_slot_capacity
    AFTER INSERT OR UPDATE OF status OR DELETE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.sync_slot_capacity();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Additional indexes for scheduling performance
-- ─────────────────────────────────────────────────────────────────────────────

-- Compound index for clinic + date lookups (calendar view)
CREATE INDEX IF NOT EXISTS idx_schedule_slots_clinic_date
    ON public.schedule_slots(clinic_id, date);

-- Partial index: fast lookup of available (non-blocked, not full) slots
CREATE INDEX IF NOT EXISTS idx_schedule_slots_available
    ON public.schedule_slots(date, professional_id)
    WHERE is_blocked = FALSE AND current_capacity < max_capacity;

-- Index on agendamentos.slot_id for trigger and join performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_slot_id
    ON public.agendamentos(slot_id)
    WHERE slot_id IS NOT NULL;
