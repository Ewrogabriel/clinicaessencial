-- Add clinic_id to audit_logs for proper multi-tenant data isolation.
-- This allows admins/managers to query audit events scoped to their clinic.

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS clinic_id UUID
    REFERENCES public.clinicas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_id
    ON public.audit_logs(clinic_id);

-- Composite index for the most common query pattern: clinic + time range
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_created
    ON public.audit_logs(clinic_id, created_at DESC);

-- Drop the old broad admin policy and replace with clinic-scoped one
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'audit_logs'
          AND policyname = 'audit_logs_admin_select'
    ) THEN
        DROP POLICY "audit_logs_admin_select" ON public.audit_logs;
    END IF;
END $$;

-- Admins and gestores can only see audit logs for their own clinic(s).
-- Masters can see all.
CREATE POLICY "audit_logs_clinic_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        -- Master users can see everything
        has_role(auth.uid(), 'master'::app_role)
        OR
        -- Admins/gestores scoped to their clinics
        (
            (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
            AND (
                clinic_id IS NULL
                OR clinic_id IN (
                    SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
                )
            )
        )
    );
