import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Send, Mail, MailOpen, Plus, Reply } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Mensagem {
  id: string;
  remetente_id: string;
  destinatario_id: string;
  assunto: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
}

const MensagensInternas = () => {
  const { user, isAdmin, isPatient } = useAuth();
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Mensagem | null>(null);
  const [destinatario, setDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [conteudo, setConteudo] = useState("");

  // Fetch all profiles + pacientes with user_id for recipient list
  const { data: recipients = [] } = useQuery({
    queryKey: ["msg-recipients", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get profiles (professionals, admins, etc.)
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, nome, email");
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string[]> = {};
      (allRoles || []).forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      const profileRecipients = (allProfiles || [])
        .filter((p: any) => p.user_id !== user.id)
        .map((p: any) => ({
          user_id: p.user_id,
          nome: p.nome,
          label: roleMap[p.user_id]?.includes("admin") ? "Admin" :
                 roleMap[p.user_id]?.includes("gestor") ? "Gestor" :
                 roleMap[p.user_id]?.includes("profissional") ? "Profissional" :
                 roleMap[p.user_id]?.includes("paciente") ? "Paciente" : "Usuário",
        }));

      return profileRecipients;
    },
    enabled: !!user,
  });

  // Fetch received messages
  const { data: recebidas = [] } = useQuery({
    queryKey: ["mensagens-recebidas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase
        .from("mensagens_internas")
        .select("*")
        .eq("destinatario_id", user.id)
        .order("created_at", { ascending: false }) as any);
      return (data || []) as Mensagem[];
    },
    enabled: !!user,
  });

  // Fetch sent messages
  const { data: enviadas = [] } = useQuery({
    queryKey: ["mensagens-enviadas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase
        .from("mensagens_internas")
        .select("*")
        .eq("remetente_id", user.id)
        .order("created_at", { ascending: false }) as any);
      return (data || []) as Mensagem[];
    },
    enabled: !!user,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('mensagens-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens_internas',
          filter: `destinatario_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["mensagens-recebidas"] });
          toast.info("Nova mensagem recebida!");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase.from("mensagens_internas").insert({
        remetente_id: user.id,
        destinatario_id: destinatario,
        assunto,
        conteudo,
      }) as any);
      if (error) throw error;

      // Create notification for recipient
      const senderName = recipients.find((p: any) => p.user_id === user.id)?.nome || "Alguém";
      await (supabase.from("notificacoes").insert({
        user_id: destinatario,
        tipo: "mensagem",
        titulo: `Nova mensagem de ${senderName}`,
        resumo: assunto,
        conteudo,
        link: "/mensagens",
      }) as any);
    },
    onSuccess: () => {
      toast.success("Mensagem enviada!");
      setComposeOpen(false);
      setAssunto("");
      setConteudo("");
      setDestinatario("");
      queryClient.invalidateQueries({ queryKey: ["mensagens-enviadas"] });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const markRead = async (msg: Mensagem) => {
    if (!msg.lida && msg.destinatario_id === user?.id) {
      await (supabase.from("mensagens_internas").update({ lida: true }).eq("id", msg.id) as any);
      queryClient.invalidateQueries({ queryKey: ["mensagens-recebidas"] });
    }
    setSelectedMsg(msg);
  };

  const handleReply = (msg: Mensagem) => {
    setDestinatario(msg.remetente_id);
    setAssunto(`Re: ${msg.assunto}`);
    setConteudo("");
    setSelectedMsg(null);
    setComposeOpen(true);
  };

  const getRecipientName = (userId: string) => {
    const p = recipients.find((r: any) => r.user_id === userId);
    return p?.nome || "Desconhecido";
  };

  const unreadCount = recebidas.filter((m) => !m.lida).length;

  const renderList = (msgs: Mensagem[], showSender: boolean) => (
    <div className="divide-y">
      {msgs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem</p>
      ) : msgs.map((m) => (
        <button
          key={m.id}
          onClick={() => markRead(m)}
          className={`w-full text-left p-4 hover:bg-muted/30 transition-colors ${!m.lida && showSender ? "bg-primary/5" : ""}`}
        >
          <div className="flex items-center gap-2">
            {showSender ? (
              !m.lida ? <Mail className="h-4 w-4 text-primary shrink-0" /> : <MailOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Send className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${!m.lida && showSender ? "font-semibold" : ""}`}>{m.assunto}</p>
              <p className="text-xs text-muted-foreground truncate">
                {showSender ? `De: ${getRecipientName(m.remetente_id)}` : `Para: ${getRecipientName(m.destinatario_id)}`}
                {" • "}
                {format(new Date(m.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Mensagens</h1>
          <p className="text-muted-foreground">
            {isPatient ? "Converse com sua equipe de atendimento." : "Comunicação interna entre equipe e pacientes."}
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Mensagem
        </Button>
      </div>

      <Card>
        <Tabs defaultValue="recebidas">
          <CardHeader className="pb-2">
            <TabsList>
              <TabsTrigger value="recebidas" className="gap-1">
                Recebidas
                {unreadCount > 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="enviadas">Enviadas</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="p-0">
            <TabsContent value="recebidas" className="m-0">
              {renderList(recebidas, true)}
            </TabsContent>
            <TabsContent value="enviadas" className="m-0">
              {renderList(enviadas, false)}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select value={destinatario} onValueChange={setDestinatario}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {recipients.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">Nenhum destinatário encontrado</div>
                  ) : recipients.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.nome} ({p.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto da mensagem..." />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Digite sua mensagem..." rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancelar</Button>
            <Button onClick={() => sendMutation.mutate()} disabled={!destinatario || !assunto || !conteudo || sendMutation.isPending}>
              {sendMutation.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message detail Dialog */}
      <Dialog open={!!selectedMsg} onOpenChange={(o) => !o && setSelectedMsg(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedMsg?.assunto}</DialogTitle>
          </DialogHeader>
          {selectedMsg && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>De:</strong> {getRecipientName(selectedMsg.remetente_id)}</p>
                <p><strong>Para:</strong> {getRecipientName(selectedMsg.destinatario_id)}</p>
                <p><strong>Data:</strong> {format(new Date(selectedMsg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap">
                {selectedMsg.conteudo}
              </div>
              {selectedMsg.destinatario_id === user?.id && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => handleReply(selectedMsg)}>
                    <Reply className="h-4 w-4 mr-1" /> Responder
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MensagensInternas;
