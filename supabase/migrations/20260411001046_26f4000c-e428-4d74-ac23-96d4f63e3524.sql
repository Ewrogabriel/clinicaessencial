-- Clinic theme customization table
CREATE TABLE public.clinic_theme (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '142 76% 36%',
  secondary_color TEXT DEFAULT '217 33% 17%',
  accent_color TEXT DEFAULT '174 58% 39%',
  sidebar_bg TEXT DEFAULT '220 14% 96%',
  sidebar_text TEXT DEFAULT '220 9% 46%',
  header_bg TEXT DEFAULT '0 0% 100%',
  header_text TEXT DEFAULT '220 9% 20%',
  card_bg TEXT DEFAULT '0 0% 100%',
  card_border TEXT DEFAULT '220 13% 91%',
  button_primary TEXT DEFAULT '142 76% 36%',
  button_text TEXT DEFAULT '0 0% 100%',
  muted_color TEXT DEFAULT '220 14% 96%',
  destructive_color TEXT DEFAULT '0 84% 60%',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);

ALTER TABLE public.clinic_theme ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clinic themes"
ON public.clinic_theme FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Clinic users can update their theme"
ON public.clinic_theme FOR UPDATE TO authenticated
USING (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic users can insert their theme"
ON public.clinic_theme FOR INSERT TO authenticated
WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE TRIGGER update_clinic_theme_updated_at
BEFORE UPDATE ON public.clinic_theme
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Matricula payment tracking table
CREATE TABLE public.matricula_payment_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula_id UUID REFERENCES public.matriculas(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) NOT NULL,
  mes_referencia TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  data_pagamento DATE,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id),
  observacoes TEXT,
  clinic_id UUID REFERENCES public.clinicas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matricula_payment_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment tracking"
ON public.matricula_payment_tracking FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert payment tracking"
ON public.matricula_payment_tracking FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment tracking"
ON public.matricula_payment_tracking FOR UPDATE TO authenticated
USING (true);

CREATE TRIGGER update_matricula_payment_tracking_updated_at
BEFORE UPDATE ON public.matricula_payment_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_matricula_payment_tracking_matricula ON public.matricula_payment_tracking(matricula_id);
CREATE INDEX idx_matricula_payment_tracking_mes ON public.matricula_payment_tracking(mes_referencia);
CREATE INDEX idx_matricula_payment_tracking_clinic ON public.matricula_payment_tracking(clinic_id);