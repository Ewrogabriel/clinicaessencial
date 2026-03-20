import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare, Ban, RotateCcw, CheckCircle2, Send, Calendar, Clock,
  User, Activity, FileText, Phone, ClipboardList, Stethoscope, StickyNote, Video,
  XCircle, Plus, AlertCircle,
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
    navigate(`/pacientes/${ag.paciente_id}/detalhes`);
  };

  const goToProntuario = () => {
    onOpenChange(false);
    navigate(`/pacientes/${ag.paciente_id}/detalhes?tab=prontuario`);
  };

  const goToEvolution = () => {
    onOpenChange(false);
    navigate(`/pacientes/${ag.paciente_id}/detalhes?tab=evolucoes`);
  };

  const goToNewEvolution = () => {
    onOpenChange(false);
    navigate(`/pacientes/${ag.paciente_id}/detalhes?tab=evolucoes&new=1`);
  };

  const handleMarkStatus = async (newStatus: string, label: string) => {
    try {
      const { error } = await (supabase
        .from("agendamentos")
        .update({ status: newStatus as any })
        .eq("id", ag.id) as any);
      if (error) throw error;
      toast.success(`Sessão marcada como ${label}!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao atualizar status: " + e.message);
    }
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

        {/* Navigation + Session Status Actions */}
        {!isPatient && (
          <div className="space-y-3">
            {/* Navigation buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={goToPatient}>
                <User className="h-4 w-4 mr-1" /> Ver Perfil
              </Button>
              <Button variant="outline" size="sm" onClick={goToProntuario}>
                <ClipboardList className="h-4 w-4 mr-1" /> Prontuário
              </Button>
              <Button variant="outline" size="sm" onClick={goToEvolution}>
                <Stethoscope className="h-4 w-4 mr-1" /> Evoluções
              </Button>
              <Button size="sm" className="bg-primary/90 hover:bg-primary" onClick={goToNewEvolution}>
                <Plus className="h-4 w-4 mr-1" /> Nova Evolução
              </Button>
              <Button variant="outline" size="sm" onClick={openWhatsAppDirect}>
                <Phone className="h-4 w-4 mr-1" /> Falar com Paciente
              </Button>
            </div>

            {/* Session status actions — clear text labels */}
            {canAct && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base shadow-md"
                  onClick={() => handleMarkStatus("realizado", "Realizado")}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Realizado
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 font-bold h-12 text-base shadow-sm"
                  onClick={() => handleMarkStatus("falta", "Faltou")}
                >
                  <AlertCircle className="h-5 w-5 mr-2" /> Faltou
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 h-12"
                  onClick={() => { onReschedule(ag); onOpenChange(false); }}
                >
                  <RotateCcw className="h-5 w-5 mr-2" /> Remarcar
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-destructive border-destructive/20 hover:bg-destructive/10 h-12"
                  onClick={() => setActionMode("cancelar")}
                >
                  <XCircle className="h-5 w-5 mr-2" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        )}

        {!isPatient && <Separator />}

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
          <div className="flex flex-col gap-2">
            {!isPatient && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-primary"
                onClick={() => setActionMode("nota_interna")}
              >
                <StickyNote className="h-4 w-4 mr-2" /> Adicionar Nota Interna
              </Button>
            )}
            {canAct && !isPatient && (
              <div className="grid grid-cols-2 gap-2 mt-1">
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
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => setActionMode("aviso_remarcacao")}
                >
                  <Send className="h-4 w-4 mr-1" /> Aviso Remarcar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
