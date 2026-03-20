
CREATE TABLE public.politicas_cancelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  prazo_aviso_horas integer NOT NULL DEFAULT 24,
  multa_percentual numeric NOT NULL DEFAULT 0,
  aplica_falta boolean NOT NULL DEFAULT true,
  aplica_cancelamento boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.politicas_cancelamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "politicas_cancel_admin_all" ON public.politicas_cancelamento
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "politicas_cancel_select_all" ON public.politicas_cancelamento
  FOR SELECT TO authenticated
  USING (true);
