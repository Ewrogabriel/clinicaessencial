-- Add auto_renew column to planos table to enable plan auto-renewal
ALTER TABLE public.planos
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false;