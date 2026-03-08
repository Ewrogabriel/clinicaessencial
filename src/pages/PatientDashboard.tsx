import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Activity, AlertCircle, Clock, TrendingUp, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { toast } from "@/hooks/use-toast";
import { Lightbulb, RefreshCw } from "lucide-react";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { PatientAgendaTab } from "@/components/patient/PatientAgendaTab";
import { PatientFinanceTab } from "@/components/patient/PatientFinanceTab";
import { PatientProdutosTab } from "@/components/patient/PatientProdutosTab";
import { PatientInfoTab } from "@/components/patient/PatientInfoTab";

const PatientDashboard = () => {
  const { profile, patientId, loading } = useAuth();
  const { data: clinicSettings } = useClinicSettings();
  const queryClient = useQueryClient();
  const [rescheduleData, setRescheduleData] = useState<any>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<any>(null);
  const [observacao, setObservacao] = useState("");
  const [isReservaDialogOpen, setIsReservaDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("agenda");

  // ── Queries ──
  const { data: paciente } = useQuery({
    queryKey: ["patient-self", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase.from("pacientes").select("*").eq("id", patientId).single() as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: agenda = [] } = useQuery({
    queryKey: ["patient-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase.from("agendamentos").select("*")
        .eq("paciente_id", patientId).gte("data_horario", new Date().toISOString())
        .in("status", ["agendado", "confirmado"]).order("data_horario", { ascending: true }).limit(5) as any);
      if (error) throw error;
      const profIds = [...new Set((data || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, { nome: string; telefone: string }> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome, telefone").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = { nome: p.nome, telefone: p.telefone }; });
      }
      return (data || []).map((a: any) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id]?.nome || "Profissional" },
        profissional_telefone: profMap[a.profissional_id]?.telefone || ""
      }));
    },
    enabled: !!patientId,
  });

  const { data: planoAtivo } = useQuery({
    queryKey: ["patient-plano", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase.from("planos").select("*")
        .eq("paciente_id", patientId).eq("status", "ativo").maybeSingle() as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: frequencyStats } = useQuery({
    queryKey: ["patient-frequency", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase.from("agendamentos").select("status").eq("paciente_id", patientId) as any);
      if (error) throw error;
      const total = data?.length || 0;
      const realizados = data?.filter((a: any) => a.status === "realizado").length || 0;
      const cancelados = data?.filter((a: any) => a.status === "cancelado").length || 0;
      const faltas = data?.filter((a: any) => a.status === "falta").length || 0;
      return { total, realizados, cancelados, faltas, taxa: total > 0 ? Math.round((realizados / total) * 100) : 0 };
    },
    enabled: !!patientId,
  });

  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avisos").select("*").eq("ativo", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["feriados-patient"],
    queryFn: async () => {
      const hoje = new Date();
      const dataFutura = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { data, error } = await (supabase.from("feriados").select("*")
        .gte("data", hoje.toISOString().split("T")[0]).lte("data", dataFutura.toISOString().split("T")[0])
        .order("data").limit(10) as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendencias = [] } = useQuery({
    queryKey: ["patient-pendencias", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase.from("pagamentos").select("*")
        .eq("paciente_id", patientId).eq("status", "pendente").order("data_vencimento", { ascending: true }) as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["patient-solicitacoes", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase.from("solicitacoes_remarcacao")
        .select("agendamento_id, status").eq("paciente_id", patientId).eq("status", "pendente");
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: produtosDisponiveis = [] } = useQuery({
    queryKey: ["produtos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("produtos").select("*")
        .gt("estoque", 0).eq("ativo", true).order("nome") as any);
      if (error) throw error;
      return data ?? [];
    },
    enabled: activeTab === "produtos",
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas-pagamento-ativas"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("formas_pagamento" as any) as any)
        .select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
    enabled: activeTab === "financeiro",
  });

  const { data: pagamentosMensalidade = [] } = useQuery({
    queryKey: ["pagamentos-mensalidade-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase.from("pagamentos_mensalidade" as any) as any)
        .select("*").eq("paciente_id", patientId).eq("status", "aberto").order("mes_referencia", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId && activeTab === "financeiro",
  });

  const { data: pagamentosSessoes = [] } = useQuery({
    queryKey: ["pagamentos-sessoes-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase.from("pagamentos_sessoes" as any) as any)
        .select("*").eq("paciente_id", patientId).eq("status", "aberto").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId && activeTab === "financeiro",
  });

  const { data: configPixMap = {} } = useQuery({
    queryKey: ["config-pix-map"],
    queryFn: async () => {
      const { data } = await (supabase.from("config_pix" as any) as any)
        .select("forma_pagamento_id, chave_pix, tipo_chave, nome_beneficiario");
      const map: any = {};
      (data || []).forEach((p: any) => { map[p.forma_pagamento_id] = p; });
      return map;
    },
    enabled: activeTab === "financeiro",
  });

  const { data: pastAgenda = [] } = useQuery({
    queryKey: ["patient-agenda-past", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase.from("agendamentos").select("*")
        .eq("paciente_id", patientId).lt("data_horario", new Date().toISOString())
        .order("data_horario", { ascending: false }).limit(10) as any);
      if (error) throw error;
      const profIds = [...new Set((data || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, { nome: string; telefone: string }> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome, telefone").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = { nome: p.nome, telefone: p.telefone }; });
      }
      return (data || []).map((a: any) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id]?.nome || "Profissional" },
        profissional_telefone: profMap[a.profissional_id]?.telefone || ""
      }));
    },
    enabled: !!patientId,
  });

  // ── Mutations ──
  const updateSessionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("agendamentos") as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-agenda"] });
      toast({ title: "Sessão atualizada!" });
    },
  });

  const reservarProduto = useMutation({
    mutationFn: async () => {
      if (!patientId || !selectedProduto) throw new Error("Dados inválidos");
      const { data: reserva, error: reservaError } = await (supabase
        .from("reservas_produtos" as any) as any)
        .insert([{ paciente_id: patientId, produto_id: selectedProduto.id, quantidade: 1, observacao: observacao || null, status: "pendente" }])
        .select().single();
      if (reservaError) throw reservaError;
      await (supabase.from("avisos" as any) as any).insert([{
        tipo: "reserva_produto",
        titulo: `Nova reserva de ${selectedProduto.nome}`,
        mensagem: `${profile?.nome || "Paciente"} reservou ${selectedProduto.nome}${observacao ? ` - ${observacao}` : ""}`,
        reserva_id: reserva?.id, lido: false
      }]);
      return reserva;
    },
    onSuccess: () => {
      toast({ title: "Reserva realizada!" });
      setIsReservaDialogOpen(false);
      setSelectedProduto(null);
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["produtos-disponiveis"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao reservar", description: (error as any).message, variant: "destructive" });
    }
  });

  // ── Derived ──
  const hoje = new Date();
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const sessoesRestantes = planoAtivo ? (planoAtivo.total_sessoes - planoAtivo.sessoes_utilizadas) : 0;
  const sessoesPercent = planoAtivo ? Math.round((planoAtivo.sessoes_utilizadas / planoAtivo.total_sessoes) * 100) : 0;
  const planoVencimento = planoAtivo?.data_vencimento ? new Date(planoAtivo.data_vencimento) : null;
  const diasParaVencer = planoVencimento ? differenceInDays(planoVencimento, hoje) : null;

  // Static tips removed - using AI-powered DailyTipsCard instead

  const openWhatsAppClinic = () => {
    const whatsapp = clinicSettings?.whatsapp?.replace(/\D/g, "") || "";
    if (whatsapp) window.open(`https://wa.me/${whatsapp}`, "_blank");
  };

  const openWhatsAppProfissional = (telefone: string) => {
    const phone = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {saudacao}, {profile?.nome?.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            {format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })} • {format(hoje, "HH:mm")}
          </p>
        </div>
        <Button variant="outline" onClick={openWhatsAppClinic} className="gap-2">
          <MessageCircle className="h-4 w-4" /> Suporte
        </Button>
      </div>

      {/* Dicas do Dia - AI powered */}
      <DailyTipsCard tipo="paciente" />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessões Restantes</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planoAtivo ? `${sessoesRestantes} / ${planoAtivo.total_sessoes}` : "—"}
            </div>
            {planoAtivo && <Progress value={sessoesPercent} className="mt-2 h-2" />}
            <p className="text-xs text-muted-foreground mt-1">
              {planoAtivo ? `Plano de ${planoAtivo.tipo_atendimento}` : "Nenhum plano ativo"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próxima Consulta</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {agenda.length > 0 ? format(new Date(agenda[0].data_horario), "dd 'de' MMM, HH:mm", { locale: ptBR }) : "Nenhuma"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {agenda.length > 0 ? `Com ${agenda[0].profiles?.nome}` : "Nenhuma sessão agendada"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frequência</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{frequencyStats?.taxa ?? 0}%</div>
            <Progress value={frequencyStats?.taxa ?? 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {frequencyStats?.realizados ?? 0} realizadas • {frequencyStats?.faltas ?? 0} faltas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Financeiro</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {pendencias.length > 0 ? (
              <>
                <Badge variant="destructive" className="mb-1">{pendencias.length} pendência(s)</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {pendencias.reduce((s: number, p: any) => s + Number(p.valor), 0).toFixed(2)} em aberto
                </p>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200 mb-1">Em dia</Badge>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma pendência</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan warnings */}
      {planoVencimento && diasParaVencer !== null && diasParaVencer <= 15 && diasParaVencer >= 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Clock className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <strong>Seu plano vence em {diasParaVencer} dia(s)!</strong>
            <p className="text-xs mt-1">Vencimento: {format(planoVencimento, "dd/MM/yyyy")}. Entre em contato para renovação.</p>
          </div>
        </div>
      )}
      {planoVencimento && diasParaVencer !== null && diasParaVencer < 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <strong>Seu plano está vencido!</strong>
            <p className="text-xs mt-1">Venceu em {format(planoVencimento, "dd/MM/yyyy")}. Regularize junto à clínica.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <PatientAgendaTab
            agenda={agenda}
            pastAgenda={pastAgenda}
            solicitacoes={solicitacoes}
            updateSessionStatus={updateSessionStatus}
            openWhatsAppProfissional={openWhatsAppProfissional}
            onReschedule={(item) => { setRescheduleData(item); setIsRescheduleOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          <PatientFinanceTab
            pendencias={pendencias}
            pagamentosMensalidade={pagamentosMensalidade}
            pagamentosSessoes={pagamentosSessoes}
            formasPagamento={formasPagamento}
            configPixMap={configPixMap}
          />
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <PatientProdutosTab
            produtosDisponiveis={produtosDisponiveis}
            onReservar={(produto) => { setSelectedProduto(produto); setIsReservaDialogOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <PatientInfoTab
            avisos={avisos}
            feriados={feriados}
            frequencyStats={frequencyStats}
            clinicSettings={clinicSettings}
            openWhatsAppClinic={openWhatsAppClinic}
          />
        </TabsContent>
      </Tabs>

      {/* Reserva Dialog */}
      {isReservaDialogOpen && selectedProduto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reservar {selectedProduto.nome}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-bold text-primary">R$ {Number(selectedProduto.preco).toFixed(2)}</p>
              <div>
                <label className="text-sm font-medium mb-2 block">Observação (opcional)</label>
                <textarea className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Adicione uma observação..."
                  rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setIsReservaDialogOpen(false); setSelectedProduto(null); setObservacao(""); }} className="flex-1">
                  Cancelar
                </Button>
                <Button className="flex-1" disabled={reservarProduto.isPending} onClick={() => reservarProduto.mutate()}>
                  {reservarProduto.isPending ? "Reservando..." : "Confirmar Reserva"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <RescheduleDialog
        open={isRescheduleOpen}
        onOpenChange={setIsRescheduleOpen}
        agendamento={rescheduleData}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["patient-solicitacoes"] })}
      />
    </div>
  );
};

export default PatientDashboard;
