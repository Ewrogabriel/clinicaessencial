
-- Audit trail table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_logs_tabela ON public.audit_logs(tabela);
CREATE INDEX idx_audit_logs_registro ON public.audit_logs(registro_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and gestores can view audit logs
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- System can insert (via trigger with SECURITY DEFINER)
CREATE POLICY "audit_logs_system_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tabela, registro_id, acao, dados_novos, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tabela, registro_id, acao, dados_anteriores, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to critical tables
CREATE TRIGGER audit_agendamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_pacientes
  AFTER INSERT OR UPDATE OR DELETE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_pagamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_matriculas
  AFTER INSERT OR UPDATE OR DELETE ON public.matriculas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
