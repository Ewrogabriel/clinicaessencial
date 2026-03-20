-- Multi-Clinic Group Architecture: structural additions
-- Adds clinic_group_id to clinicas and agendamentos, plus group-scoped RLS.

-- ============================================================
-- 1. Link clinicas to their clinic group (optional FK)
-- ============================================================
ALTER TABLE public.clinicas
    ADD COLUMN IF NOT EXISTS clinic_group_id UUID
    REFERENCES public.clinic_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinicas_clinic_group_id
    ON public.clinicas(clinic_group_id);

-- ============================================================
-- 2. Track which clinic group an appointment belongs to
-- ============================================================
ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS clinic_group_id UUID
    REFERENCES public.clinic_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_clinic_group_id
    ON public.agendamentos(clinic_group_id);

-- ============================================================
-- 3. Helper: resolve clinic_group_id from a clinic_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_clinic_group_id(_clinic_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT clinic_group_id
    FROM public.clinicas
    WHERE id = _clinic_id
    LIMIT 1;
$$;

-- ============================================================
-- 4. Helper: check if current user belongs to a clinic group
--    (via any clinic in that group)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_in_clinic_group(_clinic_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clinic_users cu
        JOIN public.clinicas c ON c.id = cu.clinic_id
        WHERE cu.user_id = auth.uid()
          AND c.clinic_group_id = _clinic_group_id
    );
$$;

-- ============================================================
-- 5. RLS: Patients are accessible across clinics in same group
--    (cross-booking: patient registered in group can book at any unit)
-- ============================================================

-- Drop old permissive select policy if it exists, replace with group-aware one
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pacientes'
          AND policyname = 'pacientes_clinic_group_select'
    ) THEN
        DROP POLICY "pacientes_clinic_group_select" ON public.pacientes;
    END IF;
END $$;

CREATE POLICY "pacientes_clinic_group_select" ON public.pacientes
    FOR SELECT USING (
        -- Direct clinic membership (existing single-clinic case)
        id IN (
            SELECT cp.paciente_id
            FROM public.clinic_pacientes cp
            JOIN public.clinic_users cu ON cu.clinic_id = cp.clinic_id
            WHERE cu.user_id = auth.uid()
        )
        OR
        -- Group-level cross-clinic access: patient is in any clinic in same group
        id IN (
            SELECT cp.paciente_id
            FROM public.clinic_pacientes cp
            JOIN public.clinicas c ON c.id = cp.clinic_id
            WHERE c.clinic_group_id IS NOT NULL
              AND public.user_in_clinic_group(c.clinic_group_id)
        )
    );

-- ============================================================
-- 6. RLS: Appointments accessible within same clinic group
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'agendamentos'
          AND policyname = 'agendamentos_clinic_group_select'
    ) THEN
        DROP POLICY "agendamentos_clinic_group_select" ON public.agendamentos;
    END IF;
END $$;

CREATE POLICY "agendamentos_clinic_group_select" ON public.agendamentos
    FOR SELECT USING (
        -- Direct clinic membership
        clinic_id IN (
            SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
        )
        OR
        -- Group-level access when cross-booking enabled
        (
            clinic_group_id IS NOT NULL
            AND public.user_in_clinic_group(clinic_group_id)
        )
    );

-- ============================================================
-- 7. Ensure cross_booking_enabled flag is respected in insert
-- ============================================================
-- Allow booking in any clinic in same group when cross_booking_enabled = true
CREATE OR REPLACE FUNCTION public.can_cross_book(_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clinic_group_members cgm
        JOIN public.clinicas c ON c.id = _clinic_id
        WHERE cgm.clinic_id = _clinic_id
          AND cgm.cross_booking_enabled = true
          AND cgm.group_id = c.clinic_group_id
          -- User must belong to this group
          AND public.user_in_clinic_group(c.clinic_group_id)
    );
$$;
