import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Check,
  X,
  MessageCircle,
  Calendar,
  Clock,
  User,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, addDays, parseISO, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

const statusLabel: Record<string, { label: string; color: string }> = {
  confirmado: { label: "Confirmado ✓", color: "bg-green-100 text-green-700 border-green-200" },
  cancelado: { label: "Não vai ✗", color: "bg-red-100 text-red-700 border-red-200" },
};

function getDayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

const ConfirmacoesDia = () => {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<string | null>(null);

  const today = new Date();
  const rangeStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
  const rangeEnd = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999), 7).toISOString();

  const { data: agendamentos = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["confirmacoes-7dias", activeClinicId, rangeStart],
    enabled: !!activeClinicId,
    queryFn: async () => {
      let q = supabase
        .from("agendamentos")
        .select("*, pacientes(id, nome, telefone, whatsapp)")
        .gte("data_horario", rangeStart)
        .lte("data_horario", rangeEnd)
        .in("status", ["agendado", "confirmado", "pendente"])
        .order("data_horario", { ascending: true });

      q = q.eq("clinic_id", activeClinicId!);

      const { data, error } = await q;
      if (error) throw error;

      const profIds = [...new Set((data || []).map((a) => a.profissional_id).filter(Boolean))];
      const profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", profIds);
        (profs || []).forEach((p) => { profMap[p.user_id] = p.nome; });
      }

      return (data || []).map((a) => ({
        ...a,
        profissional_nome: profMap[a.profissional_id] || "Profissional não encontrado",
      }));
    },
  });

  // Mark as sent mutation
  const markSentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ confirmacao_enviada_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["confirmacoes-7dias"] }),
  });

  const enviarWhatsApp = async (ag: any) => {
    const paciente = ag.pacientes;
    const telefone = paciente?.whatsapp || paciente?.telefone;

    if (!telefone) {
      toast({
        title: "Telefone não cadastrado",
        description: "O paciente não possui WhatsApp ou telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSending(ag.id);
    try {
      const confirmUrl = `${window.location.origin}/confirmar-agendamento/${ag.id}`;
      const dataFmt = format(parseISO(ag.data_horario), "dd/MM/yyyy", { locale: ptBR });
      const horaFmt = format(parseISO(ag.data_horario), "HH:mm");
      const diaSemana = format(parseISO(ag.data_horario), "EEEE", { locale: ptBR });
      const profNome = ag.profissional_nome;
      const tipo = ag.tipo_atendimento || "sessão";

      const mensagem =
        `Olá ${paciente.nome}! 👋\n\n` +
        `Lembramos que você tem uma ${tipo} agendada:\n` +
        `📅 *${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dataFmt}* às *${horaFmt}*\n` +
        `👤 Profissional: *${profNome}*\n\n` +
        `Por favor, confirme sua presença clicando no link abaixo:\n` +
        `🔗 ${confirmUrl}\n\n` +
        `Aguardamos você! 😊`;

      const numero = telefone.replace(/\D/g, "");
      const numeroComDDI = numero.startsWith("55") ? numero : `55${numero}`;
      window.open(`https://wa.me/${numeroComDDI}?text=${encodeURIComponent(mensagem)}`, "_blank");

      await markSentMutation.mutateAsync(ag.id);
      toast({ title: "WhatsApp aberto com a mensagem pronta!" });
    } finally {
      setSending(null);
    }
  };

  // Filter by search
  const filtered = agendamentos.filter((ag) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ag.pacientes?.nome?.toLowerCase().includes(q) ||
      ag.profissional_nome?.toLowerCase().includes(q) ||
      ag.tipo_atendimento?.toLowerCase().includes(q)
    );
  });

  // Group by day
  const byDay = filtered.reduce((acc: Record<string, any[]>, ag) => {
    const day = format(parseISO(ag.data_horario), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(ag);
    return acc;
  }, {});

  const sortedDays = Object.keys(byDay).sort();

  // Summary counters
  const total = agendamentos.length;
  const confirmados = agendamentos.filter((a) => a.confirmacao_presenca === "confirmado").length;
  const cancelados = agendamentos.filter((a) => a.confirmacao_presenca === "cancelado").length;
  const pendentes = agendamentos.filter((a) => !a.confirmacao_presenca).length;

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  if (!activeClinicId) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando clínica...
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando agendamentos...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Confirmações</h1>
            <p className="text-muted-foreground text-sm">Sessões agendadas para os próximos 7 dias</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
        <div className="text-center py-16 text-destructive">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-base font-medium">Erro ao carregar agendamentos</p>
          <p className="text-sm mt-1 text-muted-foreground">
            {(error as Error)?.message
              ? `Detalhes: ${(error as Error).message}`
              : "Verifique sua conexão, permissões de acesso e tente novamente."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="confirmacoes-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Confirmações</h1>
          <p className="text-muted-foreground text-sm">Sessões agendadas para os próximos 7 dias</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="summary-cards">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Confirmados</p>
            <p className="text-2xl font-bold text-green-600">{confirmados}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Não vão</p>
            <p className="text-2xl font-bold text-red-600">{cancelados}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">{pendentes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative" data-testid="search-bar">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar paciente, profissional ou tipo de atendimento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List grouped by day */}
      {sortedDays.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-state">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">Nenhuma sessão nos próximos 7 dias</p>
          <p className="text-sm mt-1">Os agendamentos aparecerão aqui assim que forem criados.</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="sessions-list">
          {sortedDays.map((day) => {
            const sessions = byDay[day];
            const isExpanded = expandedDays[day] !== false; // expanded by default
            const dayLabel = getDayLabel(day);
            const todayDay = isToday(parseISO(day));

            return (
              <div key={day} className="rounded-xl border bg-card shadow-sm overflow-hidden" data-testid={`day-group-${day}`}>
                {/* Day header */}
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30 ${todayDay ? "bg-primary/5 border-b border-primary/10" : "bg-muted/10 border-b"}`}
                  onClick={() => toggleDay(day)}
                  data-testid={`day-toggle-${day}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${todayDay ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {format(parseISO(day), "dd")}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm capitalize ${todayDay ? "text-primary" : ""}`}>{dayLabel}</p>
                      <p className="text-xs text-muted-foreground">{sessions.length} sessão(ões)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mini status summary for the day */}
                    {sessions.filter((s) => s.confirmacao_presenca === "confirmado").length > 0 && (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1">
                        <Check className="h-3 w-3" />
                        {sessions.filter((s) => s.confirmacao_presenca === "confirmado").length}
                      </Badge>
                    )}
                    {sessions.filter((s) => s.confirmacao_presenca === "cancelado").length > 0 && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                        <X className="h-3 w-3" />
                        {sessions.filter((s) => s.confirmacao_presenca === "cancelado").length}
                      </Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Sessions for the day */}
                {isExpanded && (
                  <div className="divide-y" data-testid={`day-sessions-${day}`}>
                    {sessions.map((ag) => {
                      const telefone = ag.pacientes?.whatsapp || ag.pacientes?.telefone;
                      const confirmacao = ag.confirmacao_presenca;
                      const enviado = !!ag.confirmacao_enviada_at;

                      return (
                        <div
                          key={ag.id}
                          className={`p-4 flex items-center gap-4 transition-colors ${
                            confirmacao === "confirmado" ? "bg-green-50/40" :
                            confirmacao === "cancelado" ? "bg-red-50/40" : ""
                          }`}
                          data-testid={`session-row-${ag.id}`}
                        >
                          {/* Time */}
                          <div className="shrink-0 text-center">
                            <div className="h-12 w-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                              <Clock className="h-3 w-3 text-primary mb-0.5" />
                              <span className="text-sm font-bold text-primary">
                                {format(parseISO(ag.data_horario), "HH:mm")}
                              </span>
                            </div>
                          </div>

                          {/* Patient & Professional */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm truncate">{ag.pacientes?.nome || "—"}</p>
                              {confirmacao ? (
                                <Badge className={`text-xs gap-1 ${statusLabel[confirmacao]?.color || ""}`}>
                                  {confirmacao === "confirmado" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                  {statusLabel[confirmacao]?.label}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                                  <Calendar className="h-3 w-3" /> Aguardando resposta
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              <User className="h-3 w-3" />
                              <span>{ag.profissional_nome}</span>
                              {ag.tipo_atendimento && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span className="capitalize">{ag.tipo_atendimento}</span>
                                </>
                              )}
                              {!telefone && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span className="text-red-500">Sem telefone</span>
                                </>
                              )}
                            </div>
                            {enviado && !confirmacao && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">
                                Link enviado em {format(parseISO(ag.confirmacao_enviada_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>

                          {/* WhatsApp button */}
                          <div className="shrink-0">
                            <Button
                              size="sm"
                              variant={enviado ? "outline" : "default"}
                              className={`gap-2 whitespace-nowrap ${!enviado ? "bg-green-600 hover:bg-green-700 text-white border-0" : "border-green-300 text-green-700 hover:bg-green-50"}`}
                              onClick={() => enviarWhatsApp(ag)}
                              disabled={!telefone || sending === ag.id}
                              title={!telefone ? "Paciente sem telefone cadastrado" : "Enviar confirmação via WhatsApp"}
                              data-testid={`whatsapp-btn-${ag.id}`}
                            >
                              <MessageCircle className="h-4 w-4" />
                              {sending === ag.id ? "Abrindo..." : enviado ? "Reenviar" : "WhatsApp"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 pb-4 flex-wrap" data-testid="legend">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          Confirmou presença
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          Não vai comparecer
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          Aguardando resposta
        </div>
      </div>
    </div>
  );
};

export default ConfirmacoesDia;
