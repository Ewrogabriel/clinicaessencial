-- Migration to add wipe clinic data functionality

-- Create a secure RPC to wipe all data related to a clinic
CREATE OR REPLACE FUNCTION public.wipe_clinic_data(_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify permissions: Only master or gestor of this system should be doing this
  -- Typically, this is called by an authenticated user who is master.
  IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e masters podem realizar esta ação.';
  END IF;

  -- Ensure clinic exists
  IF NOT EXISTS (SELECT 1 FROM public.clinicas WHERE id = _clinic_id) THEN
    RAISE EXCEPTION 'Clínica não encontrada.';
  END IF;

  -- Delete data in topological order (children first)
  -- The following tables are typically cascade or manually deleted.
  
  -- Related payments and financial
  DELETE FROM public.pagamentos_mensalidade WHERE clinic_id = _clinic_id;
  DELETE FROM public.pagamentos_sessoes WHERE clinic_id = _clinic_id;
  DELETE FROM public.payment_reconciliation WHERE clinic_id = _clinic_id;
  DELETE FROM public.bank_transactions WHERE clinic_id = _clinic_id;
  DELETE FROM public.bank_statements WHERE clinic_id = _clinic_id;
  DELETE FROM public.bank_accounts WHERE clinic_id = _clinic_id;
  DELETE FROM public.despesas WHERE clinic_id = _clinic_id;
  DELETE FROM public.pagamentos WHERE clinic_id = _clinic_id;
  DELETE FROM public.financial_categories WHERE clinic_id = _clinic_id;

  -- Related clinical records
  DELETE FROM public.evolutions WHERE clinic_id = _clinic_id;
  DELETE FROM public.evaluations WHERE clinic_id = _clinic_id;
  DELETE FROM public.documentos_clinicos WHERE clinic_id = _clinic_id;

  -- Related schedules and sessions
  DELETE FROM public.teleconsulta_sessions WHERE clinic_id = _clinic_id;
  DELETE FROM public.agendamentos WHERE clinic_id = _clinic_id;
  DELETE FROM public.slot_bookings WHERE clinic_id = _clinic_id;
  
  -- Core entities
  DELETE FROM public.matriculas WHERE clinic_id = _clinic_id;
  DELETE FROM public.pacientes WHERE clinic_id = _clinic_id;
  DELETE FROM public.pre_cadastros WHERE clinic_id = _clinic_id;
  DELETE FROM public.importacao_logs WHERE clinic_id = _clinic_id;
  
  -- Note: Other tables with ON DELETE CASCADE like clinic_users, whatsapp configs, etc
  -- will automatically be deleted when public.clinicas is deleted (or we can just leave it if keeping the clinic).
  -- Wait, the user wants "Arquivar / Deletar". If it's "Deletar", we wipe data then delete the clinic.
  
  DELETE FROM public.clinicas WHERE id = _clinic_id;
  
END;
$$;
