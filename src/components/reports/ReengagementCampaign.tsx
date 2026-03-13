import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { UserX, MessageCircle, Send, Filter } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/modules/shared/hooks/use-toast";

const TEMPLATES = [
  {
    label: "Retorno Gentil",
    message: "Olá {nome}! 👋 Sentimos sua falta na clínica. Que tal agendar uma sessão para retomar seu tratamento? Estamos à disposição! 💙",
  },
  {
    label: "Promoção Retorno",
    message: "Oi {nome}! Temos uma condição especial para pacientes que desejam retornar. Entre em contato e saiba mais! 🌟",
  },
  {
    label: "Check-in Saúde",
    message: "Olá {nome}, tudo bem? Faz tempo que não nos vemos. Como está se sentindo? Se precisar, estamos aqui para ajudar no seu bem-estar! 🤗",
  },
];

export const ReengagementCampaign = () => {
  const { activeClinicId } = useClinic();
  const [diasInativo, setDiasInativo] = useState("30");
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customMessage, setCustomMessage] = useState("");
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);

  // Fetch patients with their last appointment
  const { data: inactivePatients = [], isLoading } = useQuery({
    queryKey: ["inactive-patients", activeClinicId, diasInativo],
    queryFn: async () => {
      // Get active patients
      const pQuery = supabase.from("pacientes").select("id, nome, telefone, email").eq("status", "ativo");
      const { data: patients } = await pQuery;
      if (!patients?.length) return [];

      // Filter by clinic if needed
      let patientIds = patients.map(p => p.id);
      if (activeClinicId) {
        const { data: cp } = await (supabase.from("clinic_pacientes") as any)
          .select("paciente_id").eq("clinic_id", activeClinicId);
        const clinicIds = new Set((cp || []).map((c: any) => c.paciente_id));
        patientIds = patientIds.filter(id => clinicIds.has(id));
      }

      if (!patientIds.length) return [];

      // Get last appointment per patient
      const results = [];
      for (const pid of patientIds) {
        const { data: lastAppt } = await supabase.from("agendamentos")
          .select("data_horario")
          .eq("paciente_id", pid)
          .order("data_horario", { ascending: false })
          .limit(1);

        const lastDate = lastAppt?.[0]?.data_horario;
        const dias = lastDate ? differenceInDays(new Date(), new Date(lastDate)) : 999;

        if (dias >= Number(diasInativo)) {
          const patient = patients.find(p => p.id === pid);
          if (patient) {
            results.push({
              ...patient,
              ultimaSessao: lastDate ? format(new Date(lastDate), "dd/MM/yyyy", { locale: ptBR }) : "Nunca",
              diasInativo: dias,
            });
          }
        }
      }

      return results.sort((a, b) => b.diasInativo - a.diasInativo);
    },
  });

  const togglePatient = (id: string) => {
    setSelectedPatients(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedPatients.length === inactivePatients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(inactivePatients.map((p: any) => p.id));
    }
  };

  const getMessage = (nome: string) => {
    const template = customMessage || TEMPLATES[selectedTemplate].message;
    return template.replace(/{nome}/g, nome.split(" ")[0]);
  };

  const sendWhatsApp = (telefone: string, nome: string) => {
    const phone = telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(getMessage(nome));
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}?text=${msg}`, "_blank");
  };

  const sendBulk = () => {
    const patients = inactivePatients.filter((p: any) => selectedPatients.includes(p.id));
    patients.forEach((p: any) => {
      if (p.telefone) sendWhatsApp(p.telefone, p.nome);
    });
    toast({ title: `${patients.length} mensagem(ns) preparada(s) para envio!` });
  };

  return (
    <div className="space-y-6">
      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserX className="h-4 w-4" /> Campanha de Reengajamento
          </CardTitle>
          <CardDescription>Identifique e reengaje pacientes inativos via WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inativos há mais de</Label>
              <Select value={diasInativo} onValueChange={setDiasInativo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template de Mensagem</Label>
              <Select value={String(selectedTemplate)} onValueChange={(v) => { setSelectedTemplate(Number(v)); setCustomMessage(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t, i) => (
                    <SelectItem key={i} value={String(i)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensagem (personalize ou use o template)</Label>
            <Textarea
              value={customMessage || TEMPLATES[selectedTemplate].message}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              placeholder="Use {nome} para o nome do paciente"
            />
            <p className="text-xs text-muted-foreground">Use <code>{"{nome}"}</code> para inserir o primeiro nome do paciente automaticamente.</p>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Pacientes Inativos
              <Badge variant="secondary" className="ml-2">{inactivePatients.length}</Badge>
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedPatients.length === inactivePatients.length ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
            {selectedPatients.length > 0 && (
              <Button size="sm" onClick={sendBulk} className="gap-1">
                <Send className="h-3 w-3" /> Enviar ({selectedPatients.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Buscando pacientes inativos...</div>
          ) : inactivePatients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <UserX className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>Nenhum paciente inativo encontrado com este critério.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Última Sessão</TableHead>
                    <TableHead>Dias Inativo</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactivePatients.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedPatients.includes(p.id)}
                          onChange={() => togglePatient(p.id)}
                          className="rounded border-muted-foreground/30"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{p.ultimaSessao}</TableCell>
                      <TableCell>
                        <Badge variant={p.diasInativo > 60 ? "destructive" : "secondary"}>
                          {p.diasInativo} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.telefone && (
                          <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(p.telefone, p.nome)} className="gap-1">
                            <MessageCircle className="h-4 w-4" /> WhatsApp
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
