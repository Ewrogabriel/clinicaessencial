
-- Tabela de modalidades de atendimento (dinâmica)
CREATE TABLE public.modalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver modalidades"
  ON public.modalidades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem inserir modalidades"
  ON public.modalidades FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar modalidades"
  ON public.modalidades FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar modalidades"
  ON public.modalidades FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Profissionais: permitir que admins vejam todos os profiles
-- (já existe policy para user ver seu próprio perfil)
-- Adicionar policy para admins editarem todos os profiles
CREATE POLICY "Admins podem atualizar todos os perfis"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Trigger updated_at para modalidades
CREATE TRIGGER update_modalidades_updated_at
  BEFORE UPDATE ON public.modalidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir as modalidades padrão
INSERT INTO public.modalidades (nome, descricao, created_by)
SELECT 'Fisioterapia', 'Sessões de fisioterapia', (SELECT user_id FROM public.profiles LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.modalidades WHERE nome = 'Fisioterapia');

INSERT INTO public.modalidades (nome, descricao, created_by)
SELECT 'Pilates', 'Sessões de pilates', (SELECT user_id FROM public.profiles LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.modalidades WHERE nome = 'Pilates');

INSERT INTO public.modalidades (nome, descricao, created_by)
SELECT 'RPG', 'Reeducação Postural Global', (SELECT user_id FROM public.profiles LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.modalidades WHERE nome = 'RPG');
