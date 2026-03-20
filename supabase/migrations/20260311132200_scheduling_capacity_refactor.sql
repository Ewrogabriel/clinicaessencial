-- Migration: Scheduling Capacity Refactor
-- Created at: 2026-03-11 13:22:00

-- Create availability_slots table
CREATE TABLE IF NOT EXISTS public.availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    clinic_id UUID REFERENCES public.clinicas(id) ON DELETE SET NULL,
    slot_duration INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create schedule_slots table
CREATE TABLE IF NOT EXISTS public.schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    current_capacity INTEGER NOT NULL DEFAULT 0,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'blocked')),
    clinic_id UUID REFERENCES public.clinicas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(professional_id, date, start_time)
);

-- Add slot_id to agendamentos
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'slot_id') THEN
        ALTER TABLE public.agendamentos ADD COLUMN slot_id UUID REFERENCES public.schedule_slots(id) ON DELETE SET NULL;
    END IF;
END $$;

-- RPC for booking appointment with atomicity
CREATE OR REPLACE FUNCTION public.book_appointment(
    p_paciente_id UUID,
    p_profissional_id UUID,
    p_slot_id UUID,
    p_data_horario TIMESTAMP WITH TIME ZONE,
    p_duracao_minutos INTEGER,
    p_tipo_atendimento TEXT,
    p_tipo_sessao TEXT,
    p_observacoes TEXT,
    p_created_by UUID,
    p_clinic_id UUID
) RETURNS UUID AS $$
DECLARE
    v_agendamento_id UUID;
    v_current_cap INTEGER;
    v_max_cap INTEGER;
BEGIN
    -- 1. Lock the slot for update to prevent concurrent bookings exceeding capacity
    SELECT current_capacity, max_capacity INTO v_current_cap, v_max_cap
    FROM public.schedule_slots
    WHERE id = p_slot_id
    FOR UPDATE;

    -- 2. Check if capacity is available
    IF v_current_cap >= v_max_cap THEN
        RAISE EXCEPTION 'Slot is full';
    END IF;

    -- 3. Insert the appointment
    INSERT INTO public.agendamentos (
        paciente_id,
        profissional_id,
        slot_id,
        data_horario,
        duracao_minutos,
        tipo_atendimento,
        tipo_sessao,
        observacoes,
        created_by,
        clinic_id,
        status
    ) VALUES (
        p_paciente_id,
        p_profissional_id,
        p_slot_id,
        p_data_horario,
        p_duracao_minutos,
        p_tipo_atendimento,
        p_tipo_sessao,
        p_observacoes,
        p_created_by,
        p_clinic_id,
        'agendado'
    ) RETURNING id INTO v_agendamento_id;

    -- 4. Update current capacity
    UPDATE public.schedule_slots
    SET current_capacity = current_capacity + 1,
        status = CASE WHEN current_capacity + 1 >= max_capacity THEN 'full'::text ELSE 'open'::text END,
        updated_at = now()
    WHERE id = p_slot_id;

    RETURN v_agendamento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- Basic Policies
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'availability_slots' AND policyname = 'Enable all for authenticated users') THEN
        CREATE POLICY "Enable all for authenticated users" ON public.availability_slots
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_slots' AND policyname = 'Enable all for authenticated users') THEN
        CREATE POLICY "Enable all for authenticated users" ON public.schedule_slots
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- RPC function to generate daily slots based on availability rules
CREATE OR REPLACE FUNCTION public.generate_day_slots(
    p_professional_id UUID,
    p_date DATE,
    p_clinic_id UUID
) RETURNS void AS $$
BEGIN
    -- Insert slots from availability_slots if they don't exist for the day
    INSERT INTO public.schedule_slots (
        professional_id,
        date,
        start_time,
        end_time,
        max_capacity,
        clinic_id,
        current_capacity,
        status
    )
    SELECT 
        p_professional_id,
        p_date,
        start_time,
        end_time,
        max_capacity,
        p_clinic_id,
        0,
        'open'
    FROM public.availability_slots
    WHERE professional_id = p_professional_id 
      AND weekday = extract(dow from p_date)::integer
      AND (clinic_id = p_clinic_id OR clinic_id IS NULL)
    ON CONFLICT (professional_id, date, start_time) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
