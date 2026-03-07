-- ============================================
-- SETUP PARA SISTEMA DE RESERVA DE PRODUTOS
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================

-- Criar tabela reservas_produtos
CREATE TABLE IF NOT EXISTS public.reservas_produtos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 1,
  observacao text,
  status character varying(50) NOT NULL DEFAULT 'pendente'::character varying,
  data_reserva timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  data_finalizada timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_reservas_paciente ON public.reservas_produtos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_produto ON public.reservas_produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON public.reservas_produtos(status);

-- Criar tabela avisos (se não existir)
CREATE TABLE IF NOT EXISTS public.avisos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo character varying(50) NOT NULL,
  titulo character varying(255) NOT NULL,
  mensagem text NOT NULL,
  reserva_id uuid REFERENCES public.reservas_produtos(id) ON DELETE CASCADE,
  lido boolean DEFAULT false,
  profissional_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para avisos
CREATE INDEX IF NOT EXISTS idx_avisos_tipo ON public.avisos(tipo);
CREATE INDEX IF NOT EXISTS idx_avisos_lido ON public.avisos(lido);
CREATE INDEX IF NOT EXISTS idx_avisos_profissional ON public.avisos(profissional_id);

-- Habilitar RLS (Row Level Security) nas tabelas
ALTER TABLE public.reservas_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para reservas_produtos
-- Pacientes podem ver suas próprias reservas
CREATE POLICY "Pacientes podem ver suas reservas"
  ON public.reservas_produtos
  FOR SELECT
  USING (
    paciente_id = (
      SELECT id FROM public.pacientes
      WHERE codigo_acesso = current_setting('app.current_patient_code', true)
    )
  );

-- Pacientes podem criar reservas
CREATE POLICY "Pacientes podem criar reservas"
  ON public.reservas_produtos
  FOR INSERT
  WITH CHECK (
    paciente_id = (
      SELECT id FROM public.pacientes
      WHERE codigo_acesso = current_setting('app.current_patient_code', true)
    )
  );

-- Criar políticas RLS para avisos
-- Profissionais podem ver avisos
CREATE POLICY "Profissionais podem ver avisos"
  ON public.avisos
  FOR SELECT
  USING (
    profissional_id = auth.uid() OR
    profissional_id IS NULL
  );

-- Admin pode atualizar avisos como lidos
CREATE POLICY "Profissionais podem marcar avisos como lidos"
  ON public.avisos
  FOR UPDATE
  USING (
    profissional_id = auth.uid()
  )
  WITH CHECK (
    profissional_id = auth.uid()
  );

-- ============================================
-- Script executado com sucesso!
-- As tabelas estão prontas para uso.
-- ============================================
