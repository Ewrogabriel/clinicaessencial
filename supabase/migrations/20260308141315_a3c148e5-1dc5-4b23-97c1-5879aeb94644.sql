-- Create reservas_produtos table
CREATE TABLE IF NOT EXISTS public.reservas_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 1,
  observacao text,
  status varchar(50) NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reservas_produtos ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "reservas_admin_all"
  ON public.reservas_produtos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Patient can view and insert their own reservations
CREATE POLICY "reservas_patient_select"
  ON public.reservas_produtos
  FOR SELECT
  TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

CREATE POLICY "reservas_patient_insert"
  ON public.reservas_produtos
  FOR INSERT
  TO authenticated
  WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Profissional can view reservations
CREATE POLICY "reservas_prof_select"
  ON public.reservas_produtos
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'profissional'));

-- Create trigger for updated_at
CREATE TRIGGER update_reservas_produtos_updated_at
  BEFORE UPDATE ON public.reservas_produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();