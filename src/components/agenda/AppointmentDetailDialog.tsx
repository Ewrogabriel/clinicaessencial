import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare, Ban, RotateCcw, CheckCircle2, Send, Calendar, Clock,
  User, Activity, FileText, Phone, ClipboardList, Stethoscope, StickyNote, Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TeleconsultaButton } from "./TeleconsultaButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agendamento } from "./AgendaViews";

const APP_URL = window.location.origin;

const statusColors: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  agendado: { label: "Agendado", variant: "outline" },
  confirmado: { label: "Confirmado", variant: "default" },
  realizado: { label: "Realizado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  falta: { label: "Falta", variant: "destructive" },
};

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onCancel: (id: string) => void;
  onCheckin: (id: string, type: "paciente" | "profissional") => void;
  onReschedule: (ag: Agendamento) => void;
  isPatient?: boolean;
}

type ActionMode = null | "cancelar" | "lembrete" | "aviso_remarcacao" | "aviso_cancelamento" | "nota_interna";

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  agendamento,
  onCancel,
  onCheckin,
  onReschedule,
  isPatient,
}: AppointmentDetailDialogProps) {
  const navigate = useNavigate();
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [observacao, setObservacao] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  if (!agendamento) return null;

  const ag = agendamento;
  const dt = new Date(ag.data_horario);
  const pacienteNome = ag.pacientes?.nome ?? "Paciente";
  const firstName = pacienteNome.split(" ")[0];
  const profNome = ag.profiles?.nome ?? "Profissional";
  const statusCfg = statusColors[ag.status] || statusColors.agendado;
  const isCanceled = ag.status === "cancelado" || ag.status === "falta";
  const canAct = !isCanceled && ag.status !== "realizado";
  const phone = (ag as any).pacientes?.telefone || "";

  const dataFormatada = format(dt, "dd/MM/yyyy (EEEE)", { locale: ptBR });
  const horaFormatada = format(dt, "HH:mm");

  const sendWhatsApp = (message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const openWhatsAppDirect = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Paciente sem telefone cadastrado.");
      return;
    }
    window.open(`https://wa.me/55${cleanPhone}`, "_blank");
  };

  const handleSendReminder = () => {
    const obsText = observacao.trim() ? `\n\n📝 Obs: ${observacao.trim()}` : "";
    const msg =
      `Olá, ${firstName}! Confirmamos sua sessão no dia *${dataFormatada}* às *${horaFormatada}* ` +
      `com *${profNome}* no Essencial FisioPilates. ` +
      `Podemos contar com sua presença?\n\n` +
      `✅ Confirmar ou ❌ Desmarcar pelo link:\n${APP_URL}/patient-dashboard${obsText}`;
    sendWhatsApp(msg);
    resetAction();
  };

  const handleSendRescheduleNotice = () => {
    const obsText = observacao.trim() ? `\n\n📝 Motivo: ${observacao.trim()}` : "";
    const msg =
      `Olá, ${firstName}! Informamos que sua sessão do dia *${dataFormatada}* às *${horaFormatada}* ` +
      `com *${profNome}* foi *remarcada*.${obsText}\n\n` +
      `Por favor, entre em contato conosco para confirmar um novo horário. Obrigado!`;
    sendWhatsApp(msg);
    resetAction();
  };

  const handleSendCancellationNotice = () => {
    const obsText = observacao.trim() ? `\n\n📝 Motivo: ${observacao.trim()}` : "";
    const msg =
      `Olá, ${firstName}! Informamos que sua sessão do dia *${dataFormatada}* às *${horaFormatada}* ` +
      `com *${profNome}* foi *cancelada*.${obsText}\n\n` +
      `Se desejar reagendar, entre em contato conosco. Obrigado!`;
    sendWhatsApp(msg);
    resetAction();
  };

  const handleConfirmCancel = () => {
    onCancel(ag.id);
    if (observacao.trim()) {
      handleSendCancellationNotice();
    }
    resetAction();
    onOpenChange(false);
  };

  const handleSaveInternalNote = async () => {
    if (!observacao.trim()) {
      toast.error("Digite uma observação.");
      return;
    }
    setSavingNote(true);
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
      const newObs = ag.observacoes
        ? `${ag.observacoes}\n[${timestamp}] ${observacao.trim()}`
        : `[${timestamp}] ${observacao.trim()}`;

      const { error } = await (supabase
        .from("agendamentos")
        .update({ observacoes: newObs })
        .eq("id", ag.id) as any);
      if (error) throw error;

      // Update local state
      ag.observacoes = newObs;
      toast.success("Nota interna salva com sucesso.");
      resetAction();
    } catch (e: any) {
      toast.error("Erro ao salvar nota: " + e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const resetAction = () => {
    setActionMode(null);
    setObservacao("");
  };

  const handleClose = (v: boolean) => {
    if (!v) resetAction();
    onOpenChange(v);
  };

  const goToPatient = () => {
    onOpenChange(false);
    navigate(`/pacientes/${ag.paciente_id}`);
  };

  const goToEvolution = () => {
    onOpenChange(false);
    navigate(`/pacientes/${ag.paciente_id}?tab=atendimentos`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Detalhes do Agendamento
          </DialogTitle>
        </DialogHeader>

        {/* Info Section */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Paciente</p>
                <p className="font-medium">{pacienteNome}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Profissional</p>
                <p className="font-medium">{profNome}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-medium">{format(dt, "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="font-medium">{horaFormatada} ({ag.duracao_minutos}min)</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            <span className="text-xs text-muted-foreground capitalize">{ag.tipo_atendimento} • {ag.tipo_sessao}</span>
            {ag.checkin_paciente && <span title="Check-in paciente"><CheckCircle2 className="h-4 w-4 text-green-500" /></span>}
            {ag.checkin_profissional && <span title="Check-in profissional"><CheckCircle2 className="h-4 w-4 text-primary" /></span>}
          </div>

          {ag.observacoes && (
            <div className="text-xs bg-muted p-2 rounded-md max-h-[120px] overflow-y-auto">
              <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Observações / Notas Internas</p>
              <p className="whitespace-pre-wrap">{ag.observacoes}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Teleconsulta */}
        {canAct && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Video className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium flex-1">Teleconsulta</span>
            <TeleconsultaButton
              agendamentoId={ag.id}
              pacienteNome={pacienteNome}
              profissionalNome={profNome}
              dataHorario={ag.data_horario}
              compact
            />
          </div>
        )}

        <Separator />
        {!isPatient && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate(`/pacientes/${ag.paciente_id}/detalhes`); }}>
              <User className="h-4 w-4 mr-1" /> Ver Perfil
            </Button>
            <Button variant="outline" size="sm" onClick={goToPatient}>
              <ClipboardList className="h-4 w-4 mr-1" /> Prontuário
            </Button>
            <Button variant="outline" size="sm" onClick={goToEvolution}>
              <Stethoscope className="h-4 w-4 mr-1" /> Evoluções
            </Button>
            <Button variant="outline" size="sm" onClick={openWhatsAppDirect}>
              <Phone className="h-4 w-4 mr-1" /> Falar com Paciente
            </Button>
          </div>
        )}

        {!isPatient && <Separator />}

        {/* Action Mode Content */}
        {actionMode && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {actionMode === "cancelar" && "Motivo do cancelamento"}
              {actionMode === "lembrete" && "Observação adicional no lembrete (opcional)"}
              {actionMode === "aviso_remarcacao" && "Motivo da remarcação (opcional)"}
              {actionMode === "aviso_cancelamento" && "Motivo do cancelamento (opcional)"}
              {actionMode === "nota_interna" && "Nova nota interna"}
            </Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Digite aqui..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetAction}>Voltar</Button>
              {actionMode === "cancelar" && (
                <Button variant="destructive" size="sm" onClick={handleConfirmCancel}>
                  Confirmar Cancelamento
                </Button>
              )}
              {actionMode === "lembrete" && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSendReminder}>
                  <MessageSquare className="h-4 w-4 mr-1" /> Enviar Lembrete
                </Button>
              )}
              {actionMode === "aviso_remarcacao" && (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSendRescheduleNotice}>
                  <Send className="h-4 w-4 mr-1" /> Enviar Aviso
                </Button>
              )}
              {actionMode === "aviso_cancelamento" && (
                <Button size="sm" variant="destructive" onClick={handleSendCancellationNotice}>
                  <Send className="h-4 w-4 mr-1" /> Enviar Aviso
                </Button>
              )}
              {actionMode === "nota_interna" && (
                <Button size="sm" onClick={handleSaveInternalNote} disabled={savingNote}>
                  <StickyNote className="h-4 w-4 mr-1" /> {savingNote ? "Salvando..." : "Salvar Nota"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!actionMode && (
          <div className="grid grid-cols-2 gap-2">
            {!isPatient && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/20"
                onClick={() => setActionMode("nota_interna")}
              >
                <StickyNote className="h-4 w-4 mr-1" /> Nota Interna
              </Button>
            )}
            {canAct && !isPatient && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => setActionMode("lembrete")}
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> Lembrete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCheckin(ag.id, isPatient ? "paciente" : "profissional")}
                  disabled={isPatient ? !!ag.checkin_paciente : !!ag.checkin_profissional}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Check-in
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => {
                    onReschedule(ag);
                    onOpenChange(false);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Remarcar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                  onClick={() => setActionMode("cancelar")}
                >
                  <Ban className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => setActionMode("aviso_remarcacao")}
                >
                  <Send className="h-4 w-4 mr-1" /> Aviso Remarcação
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                  onClick={() => setActionMode("aviso_cancelamento")}
                >
                  <Send className="h-4 w-4 mr-1" /> Aviso Cancelamento
                </Button>
              </>
            )}
            {isCanceled && !isPatient && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={() => setActionMode("aviso_cancelamento")}
              >
                <Send className="h-4 w-4 mr-1" /> Aviso Cancelamento
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
