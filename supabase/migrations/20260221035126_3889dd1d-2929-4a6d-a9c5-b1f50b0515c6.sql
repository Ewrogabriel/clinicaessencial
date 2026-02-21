
-- Enum para status do agendamento
DO $$ BEGIN
  CREATE TYPE status_agendamento AS ENUM ('agendado', 'confirmado', 'realizado', 'cancelado', 'falta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para tipo de sessão
DO $$ BEGIN
  CREATE TYPE tipo_sessao AS ENUM ('individual', 'grupo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela de agendamentos com suporte a recorrência
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  data_horario TIMESTAMPTZ NOT NULL,
  duracao_minutos INT NOT NULL DEFAULT 50,
  tipo_atendimento tipo_atendimento NOT NULL DEFAULT 'fisioterapia',
  tipo_sessao tipo_sessao NOT NULL DEFAULT 'individual',
  status status_agendamento NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  -- Campos de recorrência
  recorrente BOOLEAN NOT NULL DEFAULT false,
  recorrencia_grupo_id UUID,
  dias_semana INT[] DEFAULT '{}',
  frequencia_semanal INT DEFAULT 1,
  recorrencia_fim DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data_horario);
CREATE INDEX idx_agendamentos_profissional ON public.agendamentos(profissional_id);
CREATE INDEX idx_agendamentos_paciente ON public.agendamentos(paciente_id);
CREATE INDEX idx_agendamentos_recorrencia_grupo ON public.agendamentos(recorrencia_grupo_id);

-- Trigger updated_at
CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os agendamentos"
  ON public.agendamentos FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais veem seus agendamentos"
  ON public.agendamentos FOR SELECT
  USING (profissional_id = auth.uid());

CREATE POLICY "Admins podem inserir agendamentos"
  ON public.agendamentos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais podem inserir seus agendamentos"
  ON public.agendamentos FOR INSERT
  WITH CHECK (profissional_id = auth.uid());

CREATE POLICY "Admins podem atualizar agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissionais podem atualizar seus agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (profissional_id = auth.uid());

CREATE POLICY "Admins podem deletar agendamentos"
  ON public.agendamentos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
