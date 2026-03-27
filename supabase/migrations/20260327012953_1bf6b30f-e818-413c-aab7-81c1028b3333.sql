ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registro_conselho text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conselho_profissional text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rubrica_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assinatura_url text;