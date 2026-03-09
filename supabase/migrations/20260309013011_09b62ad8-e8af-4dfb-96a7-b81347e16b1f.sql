
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aceita_teleconsulta boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aceita_domiciliar boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teleconsulta_plataforma text DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teleconsulta_link text DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS domiciliar_raio_km numeric DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS domiciliar_valor_adicional numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS domiciliar_observacoes text DEFAULT null;
