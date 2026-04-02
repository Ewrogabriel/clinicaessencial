-- bank_transaction_categories: custom per-clinic transaction categories for bank reconciliation
CREATE TABLE IF NOT EXISTS public.bank_transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, nome)
);

ALTER TABLE public.bank_transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_categories_select" ON public.bank_transaction_categories
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'master')
  );

CREATE POLICY "bank_categories_insert" ON public.bank_transaction_categories
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'master')
  );

CREATE POLICY "bank_categories_delete" ON public.bank_transaction_categories
  FOR DELETE TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'master')
  );
