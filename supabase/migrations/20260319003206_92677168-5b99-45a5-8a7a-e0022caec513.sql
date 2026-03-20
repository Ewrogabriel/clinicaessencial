ALTER TABLE public.pagamentos_mensalidade 
ADD COLUMN IF NOT EXISTS data_vencimento DATE,
ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinicas(id);