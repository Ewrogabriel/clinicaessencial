
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinicas(id),
  availability_slot_id UUID,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 50,
  max_capacity INTEGER NOT NULL DEFAULT 1,
  current_capacity INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage schedule_slots"
  ON public.schedule_slots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_prof_date ON public.schedule_slots(professional_id, date);
