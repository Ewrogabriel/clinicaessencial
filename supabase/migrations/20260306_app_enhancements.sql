-- Migration: 20260306_app_enhancements.sql
-- Description: Daily tips table, birthday helper functions, and professional availability improvements.

-- 1. Table for Daily Tips (Dicas Diárias)
CREATE TABLE IF NOT EXISTS public.daily_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    autor_id UUID REFERENCES public.profiles(user_id),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for daily_tips
ALTER TABLE public.daily_tips ENABLE ROW LEVEL SECURITY;

-- Policies for daily_tips
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active tips') THEN
        CREATE POLICY "Anyone can read active tips" ON public.daily_tips
            FOR SELECT USING (ativo = true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage tips') THEN
        CREATE POLICY "Admins can manage tips" ON public.daily_tips
            FOR ALL USING (public.has_role('admin', auth.uid()));
    END IF;
END $$;

-- 2. Function to get patients with birthdays in a range (defaulting to today/this week)
CREATE OR REPLACE FUNCTION public.get_upcoming_birthdays(days_offset INTEGER DEFAULT 7)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    telefone TEXT,
    data_nascimento DATE,
    dia_aniversario INTEGER,
    mes_aniversario INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, p.nome, p.telefone, p.data_nascimento::DATE,
        EXTRACT(DAY FROM p.data_nascimento)::INTEGER,
        EXTRACT(MONTH FROM p.data_nascimento)::INTEGER
    FROM public.pacientes p
    WHERE p.data_nascimento IS NOT NULL
      AND (
        (EXTRACT(MONTH FROM p.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM p.data_nascimento) >= EXTRACT(DAY FROM CURRENT_DATE))
        OR
        (EXTRACT(MONTH FROM p.data_nascimento) = EXTRACT(MONTH FROM (CURRENT_DATE + interval '1 day' * days_offset)) AND EXTRACT(DAY FROM p.data_nascimento) <= EXTRACT(DAY FROM (CURRENT_DATE + interval '1 day' * days_offset)))
      )
    ORDER BY EXTRACT(MONTH FROM p.data_nascimento), EXTRACT(DAY FROM p.data_nascimento);
END;
$$;

-- 3. Add column to track professional whatsapp individually if needed (already in profiles.telefone but can be specific)
-- Profiles already has telefone.

-- 4. Audit/Log for enrollment changes (optional but good for 'valid_from' history)
CREATE TABLE IF NOT EXISTS public.enrollment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES public.matriculas(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES public.profiles(user_id),
    change_date DATE NOT NULL DEFAULT CURRENT_DATE,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.enrollment_history ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read enrollment history') THEN
        CREATE POLICY "Admins can read enrollment history" ON public.enrollment_history
            FOR SELECT USING (public.has_role('admin', auth.uid()) OR public.has_role('gestor', auth.uid()));
    END IF;
END $$;
