
-- Tabela de notificações/alertas
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'remarcacao', 'feriado', 'bloqueio', 'mensagem', 'lembrete'
  titulo TEXT NOT NULL,
  resumo TEXT NOT NULL,
  conteudo TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT, -- rota para navegar ao clicar
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_self_select" ON public.notificacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_self_update" ON public.notificacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_admin_insert" ON public.notificacoes FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'profissional') OR has_role(auth.uid(), 'paciente')
);
CREATE POLICY "notif_admin_select" ON public.notificacoes FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Tabela de mensagens internas
CREATE TABLE public.mensagens_internas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remetente_id UUID NOT NULL,
  destinatario_id UUID NOT NULL,
  assunto TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg_remetente_insert" ON public.mensagens_internas FOR INSERT WITH CHECK (auth.uid() = remetente_id);
CREATE POLICY "msg_remetente_select" ON public.mensagens_internas FOR SELECT USING (auth.uid() = remetente_id);
CREATE POLICY "msg_destinatario_select" ON public.mensagens_internas FOR SELECT USING (auth.uid() = destinatario_id);
CREATE POLICY "msg_destinatario_update" ON public.mensagens_internas FOR UPDATE USING (auth.uid() = destinatario_id);
CREATE POLICY "msg_admin_select" ON public.mensagens_internas FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_internas;
