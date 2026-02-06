
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'profissional');

-- Enum para tipo de atendimento
CREATE TYPE public.tipo_atendimento AS ENUM ('fisioterapia', 'pilates', 'rpg');

-- Enum para status do paciente
CREATE TYPE public.status_paciente AS ENUM ('ativo', 'inativo');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seu próprio perfil"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função para checar role (SECURITY DEFINER evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Admins podem ver todas as roles
CREATE POLICY "Admins podem ver todas as roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins podem ver todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de pacientes
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT NOT NULL,
  email TEXT,
  data_nascimento DATE,
  endereco TEXT,
  observacoes TEXT,
  tipo_atendimento tipo_atendimento NOT NULL DEFAULT 'fisioterapia',
  status status_paciente NOT NULL DEFAULT 'ativo',
  profissional_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Admins veem todos os pacientes
CREATE POLICY "Admins podem ver todos os pacientes"
  ON public.pacientes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Profissionais veem seus próprios pacientes
CREATE POLICY "Profissionais veem seus pacientes"
  ON public.pacientes FOR SELECT
  TO authenticated
  USING (profissional_id = auth.uid());

-- Admins podem inserir pacientes
CREATE POLICY "Admins podem inserir pacientes"
  ON public.pacientes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profissionais podem inserir pacientes vinculados a si
CREATE POLICY "Profissionais podem inserir seus pacientes"
  ON public.pacientes FOR INSERT
  TO authenticated
  WITH CHECK (profissional_id = auth.uid());

-- Admins podem atualizar todos os pacientes
CREATE POLICY "Admins podem atualizar pacientes"
  ON public.pacientes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Profissionais podem atualizar seus pacientes
CREATE POLICY "Profissionais podem atualizar seus pacientes"
  ON public.pacientes FOR UPDATE
  TO authenticated
  USING (profissional_id = auth.uid());

-- Admins podem deletar pacientes
CREATE POLICY "Admins podem deletar pacientes"
  ON public.pacientes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
