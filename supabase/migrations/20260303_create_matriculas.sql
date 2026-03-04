-- Tabela de matrículas (mensalidades recorrentes)
CREATE TABLE public.matriculas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modalidade_id UUID REFERENCES public.modalidades(id) ON DELETE SET NULL,
  
  -- Informações da matrícula
  tipo TEXT NOT NULL DEFAULT 'mensal', -- 'mensal', 'trimestral', 'semestral', 'anual'
  valor_mensal DECIMAL(10, 2) NOT NULL,
  total_sessoes_mes INTEGER NOT NULL DEFAULT 4,
  data_inicio DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ativa', -- 'ativa', 'suspensa', 'cancelada', 'vencida'
  data_suspensao DATE,
  motivo_suspensao TEXT,
  
  -- Controle de sessões
  sessoes_utilizadas INTEGER NOT NULL DEFAULT 0,
  sessoes_faltadas INTEGER NOT NULL DEFAULT 0,
  
  -- Descontos e ajustes
  desconto DECIMAL(10, 2) DEFAULT 0,
  descricao_desconto TEXT,
  observacoes TEXT,
  
  -- Metadados
  criada_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "matriculas_paciente_read" ON public.matriculas FOR SELECT
  USING (
    auth.uid() = paciente_id OR
    auth.uid() = profissional_id OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "matriculas_insert" ON public.matriculas FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'gestor') OR
    auth.uid() = profissional_id
  );

CREATE POLICY "matriculas_update" ON public.matriculas FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'gestor') OR
    auth.uid() = profissional_id
  );

-- Índices para performance
CREATE INDEX idx_matriculas_paciente ON public.matriculas(paciente_id);
CREATE INDEX idx_matriculas_profissional ON public.matriculas(profissional_id);
CREATE INDEX idx_matriculas_status ON public.matriculas(status);
CREATE INDEX idx_matriculas_data_vencimento ON public.matriculas(data_vencimento);

-- Tabela para histórico de sessões da matrícula
CREATE TABLE public.sessoes_matricula (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula_id UUID NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  
  data_sessao DATE NOT NULL,
  horario_previsto TIME,
  status TEXT NOT NULL DEFAULT 'prevista', -- 'prevista', 'realizada', 'faltou', 'cancelada'
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sessoes_matricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessoes_matricula_read" ON public.sessoes_matricula FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = matricula_id AND
      (auth.uid() = m.paciente_id OR auth.uid() = m.profissional_id OR
       has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
    )
  );

CREATE INDEX idx_sessoes_matricula ON public.sessoes_matricula(matricula_id);
CREATE INDEX idx_sessoes_data ON public.sessoes_matricula(data_sessao);
