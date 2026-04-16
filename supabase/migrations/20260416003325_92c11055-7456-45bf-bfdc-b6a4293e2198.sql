
-- Create commission_rules table
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
  professional_id UUID,
  modalidade TEXT,
  tipo_sessao TEXT,
  tipo_calculo TEXT DEFAULT 'percentual',
  percentage DECIMAL(5,2) DEFAULT 0,
  valor_fixo DECIMAL(10,2) DEFAULT 0,
  missed_session_pct DECIMAL(5,2) DEFAULT 0.5,
  ativo BOOLEAN DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view commission_rules"
  ON public.commission_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/gestor can manage commission_rules"
  ON public.commission_rules FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  );

CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create wipe_clinic_data function
CREATE OR REPLACE FUNCTION public.wipe_clinic_data(_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete in dependency order
  DELETE FROM pagamentos_mensalidade WHERE clinic_id = _clinic_id;
  DELETE FROM pagamentos_sessoes WHERE clinic_id = _clinic_id;
  DELETE FROM pagamentos WHERE clinic_id = _clinic_id;
  DELETE FROM agendamentos WHERE clinic_id = _clinic_id;
  DELETE FROM evolutions WHERE clinic_id = _clinic_id;
  DELETE FROM evaluations WHERE clinic_id = _clinic_id;
  DELETE FROM documentos_clinicos WHERE clinic_id = _clinic_id;
  DELETE FROM contratos_digitais WHERE clinic_id = _clinic_id;
  DELETE FROM emissoes_nf WHERE clinic_id = _clinic_id;
  DELETE FROM matriculas WHERE clinic_id = _clinic_id;
  DELETE FROM planos WHERE clinic_id = _clinic_id;
  DELETE FROM commissions WHERE clinic_id = _clinic_id;
  DELETE FROM fechamentos_comissao WHERE clinic_id = _clinic_id;
  DELETE FROM despesas WHERE clinic_id = _clinic_id;
  DELETE FROM expenses WHERE clinic_id = _clinic_id;
  DELETE FROM bank_transactions WHERE clinic_id = _clinic_id;
  DELETE FROM bank_accounts WHERE clinic_id = _clinic_id;
  DELETE FROM disponibilidade_profissional WHERE clinic_id = _clinic_id;
  DELETE FROM bloqueios_profissional WHERE clinic_id = _clinic_id;
  DELETE FROM agenda_extra WHERE clinic_id = _clinic_id;
  DELETE FROM equipamentos WHERE clinic_id = _clinic_id;
  DELETE FROM avisos WHERE clinic_id = _clinic_id;
  DELETE FROM clinic_pacientes WHERE clinic_id = _clinic_id;
  DELETE FROM clinic_users WHERE clinic_id != _clinic_id OR user_id != (SELECT user_id FROM clinic_users WHERE clinic_id = _clinic_id LIMIT 1);
  -- Delete patients that are only linked to this clinic
  DELETE FROM pacientes WHERE id IN (
    SELECT p.id FROM pacientes p
    LEFT JOIN clinic_pacientes cp ON cp.paciente_id = p.id
    WHERE cp.id IS NULL
  );
  DELETE FROM commission_rules WHERE clinic_id = _clinic_id;
END;
$$;
