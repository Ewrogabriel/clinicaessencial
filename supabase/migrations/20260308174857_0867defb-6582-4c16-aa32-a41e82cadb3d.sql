
-- =============================================
-- 1. PRÉ-CADASTRO DE PACIENTES
-- =============================================
CREATE TABLE public.pre_cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  rg text,
  telefone text NOT NULL,
  email text,
  data_nascimento date,
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  tipo_atendimento text DEFAULT 'fisioterapia',
  observacoes text,
  tem_responsavel_legal boolean DEFAULT false,
  responsavel_nome text,
  responsavel_cpf text,
  responsavel_telefone text,
  responsavel_email text,
  responsavel_parentesco text,
  status text NOT NULL DEFAULT 'pendente',
  revisado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pre_cadastros ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form)
CREATE POLICY "pre_cadastros_anon_insert" ON public.pre_cadastros
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admin/gestor can read/update/delete
CREATE POLICY "pre_cadastros_admin_select" ON public.pre_cadastros
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "pre_cadastros_admin_update" ON public.pre_cadastros
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "pre_cadastros_admin_delete" ON public.pre_cadastros
  FOR DELETE TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

-- =============================================
-- 2. NOTA FISCAL - campos no paciente + tabela de emissões
-- =============================================
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS solicita_nf boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nf_razao_social text,
  ADD COLUMN IF NOT EXISTS nf_cnpj_cpf text,
  ADD COLUMN IF NOT EXISTS nf_endereco text,
  ADD COLUMN IF NOT EXISTS nf_inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS nf_email text;

CREATE TABLE public.emissoes_nf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  emitida boolean DEFAULT false,
  emitida_por uuid,
  emitida_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(paciente_id, mes_referencia)
);

ALTER TABLE public.emissoes_nf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emissoes_nf_admin_all" ON public.emissoes_nf
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "emissoes_nf_patient_select" ON public.emissoes_nf
  FOR SELECT TO authenticated USING (
    paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid())
  );

-- =============================================
-- 3. VENDAS E ESTOQUE
-- =============================================
CREATE TABLE public.vendas_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendas_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_admin_all" ON public.vendas_produtos
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "vendas_patient_select" ON public.vendas_produtos
  FOR SELECT TO authenticated USING (
    paciente_id IN (SELECT id FROM pacientes WHERE user_id = auth.uid())
  );

CREATE TABLE public.entradas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 0,
  data_entrada date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entradas_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entradas_admin_all" ON public.entradas_estoque
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );
