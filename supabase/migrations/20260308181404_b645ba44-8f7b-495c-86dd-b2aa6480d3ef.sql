
-- 1. Tabela de clínicas
CREATE TABLE public.clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  endereco text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  telefone text,
  whatsapp text,
  email text,
  instagram text,
  logo_url text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

-- 2. Tabela junction: usuários <-> clínicas
CREATE TABLE public.clinic_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, user_id)
);

ALTER TABLE public.clinic_users ENABLE ROW LEVEL SECURITY;

-- 3. Tabela junction: pacientes <-> clínicas (compartilhamento)
CREATE TABLE public.clinic_pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, paciente_id)
);

ALTER TABLE public.clinic_pacientes ENABLE ROW LEVEL SECURITY;

-- 4. Adicionar clinic_id às tabelas operacionais
ALTER TABLE public.agendamentos ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.matriculas ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.pagamentos ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.pagamentos_mensalidade ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.pagamentos_sessoes ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.disponibilidade_profissional ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.lista_espera ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.emissoes_nf ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.avisos ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.modalidades ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.bloqueios_profissional ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.agenda_extra ADD COLUMN clinic_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.expenses ADD COLUMN clinic_id_ref uuid REFERENCES public.clinicas(id);
ALTER TABLE public.commissions ADD COLUMN clinic_id_ref uuid REFERENCES public.clinicas(id);

-- 5. Criar clínica padrão com os dados atuais de clinic_settings
INSERT INTO public.clinicas (id, nome, cnpj, endereco, numero, bairro, cidade, estado, cep, telefone, whatsapp, email, instagram, logo_url)
SELECT gen_random_uuid(), nome, cnpj, endereco, numero, bairro, cidade, estado, cep, telefone, whatsapp, email, instagram, logo_url
FROM public.clinic_settings
LIMIT 1;

-- Se não existir clinic_settings, criar uma padrão
INSERT INTO public.clinicas (nome)
SELECT 'Clínica Principal'
WHERE NOT EXISTS (SELECT 1 FROM public.clinicas);

-- 6. Associar todos os usuários à clínica padrão
INSERT INTO public.clinic_users (clinic_id, user_id, role)
SELECT c.id, ur.user_id, ur.role::text
FROM public.clinicas c
CROSS JOIN public.user_roles ur
LIMIT 100
ON CONFLICT DO NOTHING;

-- 7. Associar todos os pacientes à clínica padrão  
INSERT INTO public.clinic_pacientes (clinic_id, paciente_id)
SELECT c.id, p.id
FROM (SELECT id FROM public.clinicas LIMIT 1) c
CROSS JOIN public.pacientes p
ON CONFLICT DO NOTHING;

-- 8. Atualizar clinic_id nas tabelas operacionais para a clínica padrão
UPDATE public.agendamentos SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.matriculas SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.pagamentos SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.pagamentos_mensalidade SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.pagamentos_sessoes SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.disponibilidade_profissional SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.lista_espera SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.emissoes_nf SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.avisos SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.modalidades SET clinic_id = (SELECT id FROM public.clinicas LIMIT 1) WHERE clinic_id IS NULL;

-- 9. RLS para clinicas
CREATE POLICY "clinicas_select_own" ON public.clinicas FOR SELECT
  USING (
    id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "clinicas_admin_all" ON public.clinicas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 10. RLS para clinic_users
CREATE POLICY "clinic_users_select_own" ON public.clinic_users FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "clinic_users_admin_all" ON public.clinic_users FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 11. RLS para clinic_pacientes
CREATE POLICY "clinic_pacientes_select" ON public.clinic_pacientes FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "clinic_pacientes_admin_all" ON public.clinic_pacientes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 12. Função helper para verificar acesso à clínica
CREATE OR REPLACE FUNCTION public.user_has_clinic_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_users
    WHERE user_id = _user_id
      AND clinic_id = _clinic_id
  )
$$;
