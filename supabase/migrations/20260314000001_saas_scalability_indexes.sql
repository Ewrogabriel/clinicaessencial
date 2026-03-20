-- Scalability indexes for multi-tenant SaaS performance.
-- Covers high-traffic tables not yet indexed by clinic_id.

-- ── planos (patient service plans) ─────────────────────────────────────────
-- Queries always filter by clinic – needs fast lookup
ALTER TABLE public.planos
    ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinicas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_planos_clinic_id
    ON public.planos(clinic_id);

CREATE INDEX IF NOT EXISTS idx_planos_paciente_id
    ON public.planos(paciente_id);

CREATE INDEX IF NOT EXISTS idx_planos_clinic_status
    ON public.planos(clinic_id, status);

-- ── pagamentos ──────────────────────────────────────────────────────────────
-- Already has clinic_id from a prior migration; ensure composite index exists.
CREATE INDEX IF NOT EXISTS idx_pagamentos_clinic_data
    ON public.pagamentos(clinic_id, data_pagamento);

CREATE INDEX IF NOT EXISTS idx_pagamentos_paciente_id
    ON public.pagamentos(paciente_id);

-- ── matriculas ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matriculas_clinic_id
    ON public.matriculas(clinic_id);

CREATE INDEX IF NOT EXISTS idx_matriculas_paciente_id
    ON public.matriculas(paciente_id);

-- ── commissions ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commissions_profissional_id
    ON public.commissions(profissional_id);

CREATE INDEX IF NOT EXISTS idx_commissions_clinic_created
    ON public.commissions(clinic_id, created_at DESC);

-- ── expenses ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_clinic_date
    ON public.expenses(clinic_id, data DESC);

-- ── evolutions ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_evolutions_paciente_clinic
    ON public.evolutions(paciente_id, clinic_id);

-- ── evaluations ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_evaluations_paciente_clinic
    ON public.evaluations(paciente_id, clinic_id);

-- ── notificacoes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_created
    ON public.notificacoes(user_id, created_at DESC);

-- ── mensagens_internas ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mensagens_receiver_read
    ON public.mensagens_internas(receiver_id, lida, created_at DESC);
