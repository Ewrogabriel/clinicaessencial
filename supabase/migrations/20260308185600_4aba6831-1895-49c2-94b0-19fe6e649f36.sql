
-- 2. Platform plans table
CREATE TABLE public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  valor_mensal numeric NOT NULL DEFAULT 0,
  max_pacientes integer,
  max_profissionais integer,
  max_clinicas integer DEFAULT 1,
  recursos_disponiveis jsonb DEFAULT '[]'::jsonb,
  cor text DEFAULT '#3b82f6',
  destaque boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_plans_select_all" ON public.platform_plans FOR SELECT USING (true);
CREATE POLICY "platform_plans_master_all" ON public.platform_plans FOR ALL
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 3. Clinic subscriptions
CREATE TABLE public.clinic_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.platform_plans(id),
  status text NOT NULL DEFAULT 'ativa',
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date,
  responsavel_nome text,
  responsavel_email text,
  responsavel_telefone text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);
ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_subs_master_all" ON public.clinic_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "clinic_subs_admin_select" ON public.clinic_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Subscription payments
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.clinic_subscriptions(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  data_pagamento timestamptz,
  forma_pagamento text,
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_payments_master_all" ON public.subscription_payments FOR ALL
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 5. Clinic groups
CREATE TABLE public.clinic_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  created_by uuid NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_groups_master_all" ON public.clinic_groups FOR ALL
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "clinic_groups_select_auth" ON public.clinic_groups FOR SELECT USING (true);

-- 6. Clinic group members
CREATE TABLE public.clinic_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.clinic_groups(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  cross_booking_enabled boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, clinic_id)
);
ALTER TABLE public.clinic_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_group_members_master_all" ON public.clinic_group_members FOR ALL
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "clinic_group_members_select_auth" ON public.clinic_group_members FOR SELECT USING (true);

-- 7. Function to check plan limits
CREATE OR REPLACE FUNCTION public.check_plan_limit(_clinic_id uuid, _resource text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan platform_plans%ROWTYPE;
  v_current integer;
  v_max integer;
BEGIN
  SELECT pp.* INTO v_plan
  FROM platform_plans pp
  JOIN clinic_subscriptions cs ON cs.plan_id = pp.id
  WHERE cs.clinic_id = _clinic_id AND cs.status = 'ativa';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', -1);
  END IF;

  IF _resource = 'pacientes' THEN
    v_max := v_plan.max_pacientes;
    IF v_max IS NULL THEN RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', -1); END IF;
    SELECT count(*) INTO v_current FROM clinic_pacientes WHERE clinic_id = _clinic_id;
  ELSIF _resource = 'profissionais' THEN
    v_max := v_plan.max_profissionais;
    IF v_max IS NULL THEN RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', -1); END IF;
    SELECT count(*) INTO v_current FROM clinic_users WHERE clinic_id = _clinic_id;
  ELSE
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', -1);
  END IF;

  RETURN jsonb_build_object('allowed', v_current < v_max, 'current', v_current, 'max', v_max);
END;
$$;
