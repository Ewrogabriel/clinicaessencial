
CREATE TABLE public.landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secao text NOT NULL,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(secao)
);

ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public landing page)
CREATE POLICY "landing_content_public_select" ON public.landing_content
  FOR SELECT USING (true);

-- Only admin/master can modify
CREATE POLICY "landing_content_admin_all" ON public.landing_content
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role));

-- Insert default content for each section
INSERT INTO public.landing_content (secao, conteudo) VALUES
  ('hero', '{"badge":"Potencializado por Inteligência Artificial","titulo":"Gestão inteligente para clínicas de saúde","subtitulo":"Sistema completo para fisioterapia, psicologia, nutrição, pilates, estética e muito mais. Agenda, prontuários, financeiro e IA — tudo em um só lugar.","cta_primario":"Agendar demonstração","cta_secundario":"Ver planos","destaques":["Sem fidelidade","Setup gratuito","Suporte humanizado"]}'::jsonb),
  ('planos', '{"titulo":"Planos que cabem no seu bolso","subtitulo":"Escolha o plano ideal para o tamanho da sua clínica","planos":[{"name":"Starter","price":"97","description":"Ideal para clínicas iniciando a digitalização","features":["Até 100 pacientes","2 profissionais","Agenda com recorrência","Prontuário digital","Financeiro básico","Portal do paciente","Suporte por email"]},{"name":"Professional","price":"197","description":"Para clínicas em crescimento que precisam de mais","highlighted":true,"features":["Até 500 pacientes","10 profissionais","Tudo do Starter +","Inteligência Artificial","Relatórios avançados","Comissões automáticas","Multi-clínica (2 unidades)","Marketing com IA","Suporte prioritário"]},{"name":"Enterprise","price":"397","description":"Para redes de clínicas e operações avançadas","features":["Pacientes ilimitados","Profissionais ilimitados","Tudo do Professional +","Multi-clínica ilimitada","Notas fiscais (NFS-e)","API personalizada","Onboarding dedicado","Gerente de sucesso","SLA 99.9%"]}]}'::jsonb),
  ('depoimentos', '{"titulo":"O que dizem nossos clientes","depoimentos":[{"name":"Dra. Maria Silva","role":"Fisioterapeuta","rating":5,"text":"O sistema transformou a gestão da minha clínica. Reduzi 70% do tempo administrativo e aumentei a retenção de pacientes."},{"name":"Dr. Carlos Santos","role":"Psicólogo","rating":5,"text":"A IA para geração de documentos e insights me ajuda muito no dia a dia. Recomendo para qualquer profissional de saúde."},{"name":"Ana Costa","role":"Gestora de Clínica","rating":5,"text":"Gerenciar 3 unidades nunca foi tão fácil. Os relatórios consolidados são excelentes para tomada de decisão."}]}'::jsonb),
  ('contato', '{"whatsapp":"5500000000000","email":"contato@essencialclinicas.com.br","instagram":"essencialclinicas","titulo":"Pronto para transformar sua clínica?","subtitulo":"Preencha o formulário ou entre em contato diretamente. Nossa equipe vai te ajudar a escolher o plano ideal."}'::jsonb);
