
-- Table for extra availability slots (agenda extra) on specific dates
CREATE TABLE public.agenda_extra (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id uuid NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  max_pacientes integer NOT NULL DEFAULT 1,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_extra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_extra_prof_insert" ON public.agenda_extra FOR INSERT
  WITH CHECK (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agenda_extra_prof_update" ON public.agenda_extra FOR UPDATE
  USING (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agenda_extra_prof_delete" ON public.agenda_extra FOR DELETE
  USING (profissional_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agenda_extra_select_all" ON public.agenda_extra FOR SELECT
  USING (true);
