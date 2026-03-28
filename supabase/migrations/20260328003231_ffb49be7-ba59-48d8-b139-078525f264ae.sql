-- Bank accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id),
  banco_codigo text NOT NULL,
  banco_nome text NOT NULL,
  agencia text,
  conta text,
  tipo text DEFAULT 'corrente',
  apelido text,
  ativo boolean DEFAULT true,
  api_enabled boolean DEFAULT false,
  api_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bank accounts" ON public.bank_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bank transactions (imported from statements)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinicas(id),
  data_transacao date NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  tipo text DEFAULT 'credito',
  saldo numeric,
  documento text,
  status text DEFAULT 'pendente',
  matched_payment_id uuid,
  matched_paciente_id uuid REFERENCES public.pacientes(id),
  matched_confidence numeric,
  reviewed boolean DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  import_batch_id uuid,
  dados_originais jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bank transactions" ON public.bank_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Statement import logs
CREATE TABLE IF NOT EXISTS public.statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  clinic_id uuid REFERENCES public.clinicas(id),
  file_name text,
  file_type text,
  total_transactions integer DEFAULT 0,
  matched_transactions integer DEFAULT 0,
  confirmed_transactions integer DEFAULT 0,
  status text DEFAULT 'processing',
  ai_analysis jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage statement imports" ON public.statement_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Investments table
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinicas(id),
  nome text NOT NULL,
  tipo text NOT NULL,
  instituicao text,
  valor_aplicado numeric NOT NULL,
  data_aplicacao date NOT NULL,
  data_vencimento date,
  taxa_contratada numeric,
  indexador text DEFAULT 'CDI',
  percentual_indexador numeric DEFAULT 100,
  valor_atual numeric,
  rendimento_bruto numeric DEFAULT 0,
  rendimento_liquido numeric DEFAULT 0,
  ir_valor numeric DEFAULT 0,
  iof_valor numeric DEFAULT 0,
  status text DEFAULT 'ativo',
  observacoes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage investments" ON public.investments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);