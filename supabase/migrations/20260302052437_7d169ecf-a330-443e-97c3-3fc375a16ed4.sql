
-- Add structured address fields for legal guardian
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS responsavel_cep text,
  ADD COLUMN IF NOT EXISTS responsavel_rua text,
  ADD COLUMN IF NOT EXISTS responsavel_numero text,
  ADD COLUMN IF NOT EXISTS responsavel_complemento text,
  ADD COLUMN IF NOT EXISTS responsavel_bairro text,
  ADD COLUMN IF NOT EXISTS responsavel_cidade text,
  ADD COLUMN IF NOT EXISTS responsavel_estado text;
