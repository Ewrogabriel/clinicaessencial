-- Add contract type and CNPJ fields to profiles
ALTER TABLE public.profiles
ADD COLUMN tipo_contratacao text DEFAULT NULL,
ADD COLUMN cnpj text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.tipo_contratacao IS 'Contract type: autonomo, mei, clt, pj';
COMMENT ON COLUMN public.profiles.cnpj IS 'CNPJ number when tipo_contratacao is pj';
