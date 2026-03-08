import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Bell, UserPlus, FileCheck, Send, Users, FileText, Download, Save, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const APP_URL = window.location.origin;

// Sub-component for each patient row in manual dispatches
const PatientDispatchRow = ({
  p,
  triggers,
  sendWhatsApp,
  nextAppointment,
}: {
  p: any;
  triggers: any[];
  sendWhatsApp: (phone: string, msg: string) => void;
  nextAppointment?: { data_horario: string; profissional_nome: string; id: string } | null;
}) => {
  const [selectedMsgId, setSelectedMsgId] = useState<number>(triggers[0]?.id ?? 1);
  const selectedMsg = triggers.find((t) => t.id === selectedMsgId);
  const firstName = p.nome?.split(" ")[0] || "paciente";

  const buildMessage = () => {
    if (!selectedMsg) return "";

    // For "Lembrete de Consulta" (id=1), auto-include appointment info
    if (selectedMsg.id === 1 && nextAppointment) {
      const dt = new Date(nextAppointment.data_horario);
      const dataFormatada = format(dt, "dd/MM/yyyy (EEEE)", { locale: ptBR });
      const horaFormatada = format(dt, "HH:mm");
      const profNome = nextAppointment.profissional_nome || "seu profissional";
      const confirmLink = `${APP_URL}/patient-dashboard`;

      return (
        `Olá, ${firstName}! Confirmamos sua sessão no dia *${dataFormatada}* às *${horaFormatada}* ` +
        `com *${profNome}* no Essencial FisioPilates. ` +
        `Podemos contar com sua presença?\n\n` +
        `✅ Confirmar ou ❌ Desmarcar pelo link:\n${confirmLink}`
      );
    }

    // Other messages: simple personalization
    return `Olá, ${firstName}! ${selectedMsg.message.replace(/^Olá[!,]?\s*/i, "")}`;
  };

  return (
    <div className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div>
        <p className="text-sm font-medium">{p.nome}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{p.telefone}</p>
          {nextAppointment && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(nextAppointment.data_horario), "dd/MM HH:mm")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 text-sm border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={selectedMsgId}
          onChange={(e) => setSelectedMsgId(Number(e.target.value))}
        >
          {triggers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          className="text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
          onClick={() => sendWhatsApp(p.telefone || "", buildMessage())}
        >
          <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
        </Button>
      </div>
      {selectedMsgId === 1 && !nextAppointment && (
        <p className="text-xs text-amber-600">⚠ Sem consulta agendada — a mensagem será enviada sem data/horário.</p>
      )}
    </div>
  );
};

const Automacoes = () => {
  const _unused = useAuth(); // keep auth context

  const [searchPatient, setSearchPatient] = useState("");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["automation-patients"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("pacientes") as any)
        .select("id, nome, telefone, status")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch next upcoming appointment per patient
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["automation-upcoming-appointments"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase.from("agendamentos") as any)
        .select("id, paciente_id, data_horario, profissional_id, profiles:profissional_id(nome)")
        .gte("data_horario", now)
        .in("status", ["agendado", "confirmado"])
        .order("data_horario", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Map: paciente_id -> next appointment
  const nextAppointmentMap: Record<string, { data_horario: string; profissional_nome: string; id: string }> = {};
  for (const ag of upcomingAppointments) {
    if (!nextAppointmentMap[ag.paciente_id]) {
      nextAppointmentMap[ag.paciente_id] = {
        data_horario: ag.data_horario,
        profissional_nome: ag.profiles?.nome || "Profissional",
        id: ag.id,
      };
    }
  }

  const sendWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Número de telefone inválido.");
      return;
    }
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const [triggers, setTriggers] = useState([
    {
      id: 1,
      title: "Lembrete de Consulta",
      description: "Mensagem com dia, horário e link de confirmação.",
      icon: MessageSquare,
      color: "bg-green-100 text-green-700",
      delay: "24",
      message: "Olá! Confirmamos sua sessão no Essencial FisioPilates. Podemos contar com sua presença?",
    },
    {
      id: 2,
      title: "Recuperação de Paciente",
      description: "Para pacientes sumidos há mais de 30 dias.",
      icon: UserPlus,
      color: "bg-blue-100 text-blue-700",
      delay: "30",
      message: "Olá! Sentimos sua falta aqui no Essencial FisioPilates. Como você está? Vamos agendar sua próxima sessão?",
    },
    {
      id: 3,
      title: "Aviso de Pendência",
      description: "Cobrança amigável de pagamentos atrasados.",
      icon: Bell,
      color: "bg-amber-100 text-amber-700",
      delay: "3",
      message: "Olá! Consta uma pendência em aberto no seu cadastro. Poderia nos enviar o comprovante ou regularizar?",
    },
  ]);

  const docs = [
    { id: 1, title: "Recibo de Pagamento - PDF", desc: "Recibo padrão para reembolso de guias e impostos." },
    { id: 2, title: "Termo de Alta Clínica", desc: "Documento oficial de conclusão e encerramento clínico." },
    { id: 3, title: "Recomendações de Exercícios Home", desc: "Papeleta com instruções para fazer em casa." },
  ];

  const handleOpenRule = (trigger: any) => {
    setSelectedRule({ ...trigger });
    setRuleDialogOpen(true);
  };

  const saveRule = () => {
    setTriggers(triggers.map((t) => (t.id === selectedRule.id ? selectedRule : t)));
    setRuleDialogOpen(false);
    toast.success("Regra de automação atualizada com sucesso!");
  };

  const handleOpenDoc = (doc: any) => {
    setSelectedDoc(doc);
    setDocDialogOpen(true);
  };

  const simulateDownload = () => {
    setDocDialogOpen(false);
    toast.success(`Baixando documento: ${selectedDoc?.title}`);
    setTimeout(() => {
      toast.info("Download concluído (Simulação).");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Send className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Centro de Automações</h1>
          <p className="text-muted-foreground">Dispare comunicações inteligentes e acesse templates automáticos.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {triggers.map((trigger) => (
          <Card key={trigger.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${trigger.color}`}>
                <trigger.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{trigger.title}</CardTitle>
              <CardDescription>{trigger.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-muted rounded-md text-xs mb-4 italic line-clamp-3 h-16">
                "{trigger.message}"
              </div>
              <Button className="w-full" variant="outline" onClick={() => handleOpenRule(trigger)}>
                Configurar Regra
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Disparos Manuais Rápidos
          </CardTitle>
          <CardDescription>
            O lembrete de consulta inclui automaticamente data, horário, profissional e link de confirmação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Buscar paciente por nome..."
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
              className="max-w-sm"
            />
            {patients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum paciente ativo para disparar.</p>
            ) : (
              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {patients
                  .filter((p: any) => !searchPatient || p.nome?.toLowerCase().includes(searchPatient.toLowerCase()))
                  .map((p: any) => (
                    <PatientDispatchRow
                      key={p.id}
                      p={p}
                      triggers={triggers}
                      sendWhatsApp={sendWhatsApp}
                      nextAppointment={nextAppointmentMap[p.id] || null}
                    />
                  ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Templates de Documentos
            </CardTitle>
            <CardDescription>Acesso rápido aos documentos mais utilizados na clínica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {docs.map((doc) => (
              <Button
                key={doc.id}
                variant="outline"
                className="w-full justify-between group"
                onClick={() => handleOpenDoc(doc)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">{doc.title}</span>
                </div>
                <Download className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dialog for Editing Rules */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configurar: {selectedRule?.title}</DialogTitle>
            <DialogDescription>
              Ajuste as condições de disparo e a mensagem que o paciente receberá.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delay">Tempo de Gatilho (Dias/Horas)</Label>
              <Input
                id="delay"
                value={selectedRule?.delay || ""}
                onChange={(e) => setSelectedRule({ ...selectedRule, delay: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Mensagem Padrão</Label>
              <Textarea
                id="message"
                className="min-h-[100px]"
                value={selectedRule?.message || ""}
                onChange={(e) => setSelectedRule({ ...selectedRule, message: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveRule}>
              <Save className="mr-2 h-4 w-4" /> Salvar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Documents */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title}</DialogTitle>
            <DialogDescription>{selectedDoc?.desc}</DialogDescription>
          </DialogHeader>
          <div className="py-6 flex justify-center">
            <div className="p-8 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/10 flex flex-col items-center text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                O documento será gerado com os dados preenchidos automaticamente pelo sistema.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={simulateDownload} className="gap-2">
              <Download className="h-4 w-4" /> Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Automacoes;
