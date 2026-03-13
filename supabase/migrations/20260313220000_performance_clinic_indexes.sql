-- Add performance indexes for clinic_id filtering on high-traffic tables
-- These indexes are critical for multi-tenant query performance

CREATE INDEX IF NOT EXISTS idx_agendamentos_clinic_id
    ON public.agendamentos (clinic_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_clinic_date
    ON public.agendamentos (clinic_id, data_horario);

CREATE INDEX IF NOT EXISTS idx_evolutions_clinic_id
    ON public.evolutions (clinic_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_clinic_id
    ON public.evaluations (clinic_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_clinic_id
    ON public.pagamentos (clinic_id);
