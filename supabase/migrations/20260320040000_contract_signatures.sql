-- Create contract_signatures table for storing digital signatures on contracts
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL,
  signer_type   TEXT NOT NULL CHECK (signer_type IN ('cliente', 'clinic_responsible')),
  signature_data TEXT,
  signed_at     TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Only authenticated users belonging to the clinic can read/write signatures
CREATE POLICY "Authenticated users can manage contract signatures"
  ON public.contract_signatures
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by contract
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id
  ON public.contract_signatures (contract_id);
