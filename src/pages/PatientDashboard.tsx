import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Activity, AlertCircle, Clock, MessageCircle, ShoppingBag } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { toast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { NpsSurvey } from "@/components/patient/NpsSurvey";
import { usePatientAgenda } from "@/hooks/usePatientAgenda";
import { usePatientFinance } from "@/hooks/usePatientFinance";
import { usePatientProdutos } from "@/hooks/usePatientProdutos";
import { Skeleton } from "@/components/ui/skeleton";
import { FichaRequestButton } from "@/components/patient/FichaRequestButton";

// Lazy load tab components
const PatientAgendaTab = lazy(() => import("@/components/patient/PatientAgendaTab").then(m => ({ default: m.PatientAgendaTab })));
const PatientFinanceTab = lazy(() => import("@/components/patient/PatientFinanceTab").then(m => ({ default: m.PatientFinanceTab })));
const PatientProdutosTab = lazy(() => import("@/components/patient/PatientProdutosTab").then(m => ({ default: m.PatientProdutosTab })));
const PatientInfoTab = lazy(() => import("@/components/patient/PatientInfoTab").then(m => ({ default: m.PatientInfoTab })));
const GamificationDashboard = lazy(() => import("@/components/gamification/GamificationDashboard").then(m => ({ default: m.GamificationDashboard })));

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

  // ── Core Queries (always loaded for KPI cards) ──
  const { data: paciente } = useQuery({
    queryKey: ["patient-self", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase.from("pacientes").select("*").eq("id", patientId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: nextAgenda } = useQuery({
    queryKey: ["patient-next-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase
        .from("agendamentos")
        .select("data_horario")
        .eq("paciente_id", patientId)
        .gte("data_horario", new Date().toISOString())
        .in("status", ["pendente", "agendado", "confirmado"])
        .order("data_horario", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });


  const { data: planoAtivo } = useQuery({
    queryKey: ["patient-plano", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "ativo")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: frequencyStats } = useQuery({
    queryKey: ["patient-frequency", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase.from("agendamentos").select("status").eq("paciente_id", patientId);
      if (error) throw error;
      const total = data?.length || 0;
      const realizados = data?.filter((a) => a.status === "realizado").length || 0;
      const cancelados = data?.filter((a) => a.status === "cancelado").length || 0;
      const faltas = data?.filter((a) => a.status === "falta").length || 0;
      return { total, realizados, cancelados, faltas, taxa: total > 0 ? Math.round((realizados / total) * 100) : 0 };
    },
    enabled: !!patientId,
  });

  const { data: pendenciasCount = [] } = useQuery({
    queryKey: ["patient-pendencias-count", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id")
        .eq("paciente_id", patientId)
        .eq("status", "pendente");
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  // ── Tab-conditional data hooks ──
  const agendaHook = usePatientAgenda(patientId, activeTab === "agenda");
  const financeHook = usePatientFinance(patientId, activeTab === "financeiro");
  const produtosHook = usePatientProdutos(patientId, activeTab === "produtos" || activeTab === "");

  // Info tab queries (only when active)
  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avisos").select("*").eq("ativo", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: activeTab === "info",
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["feriados-patient"],
    queryFn: async () => {
      const hoje = new Date();
      const dataFutura = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from("feriados")
        .select("*")
        .gte("data", hoje.toISOString().split("T")[0])
        .lte("data", dataFutura.toISOString().split("T")[0])
        .order("data")
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: activeTab === "info",
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
      
      const { data: reserva, error: reservaError } = await supabase
        .from("reservas_produtos")
        .insert([{ 
          paciente_id: patientId, 
          produto_id: selectedProduto.id, 
          quantidade: 1, 
          observacao: observacao || null, 
          status: "pendente" 
        }])
        .select()
        .single();
      
      if (reservaError) throw reservaError;

      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = (adminRoles || []).map((r) => r.user_id);
      if (adminIds.length > 0) {
        const notifications = adminIds.map((adminId: string) => ({
          user_id: adminId,
          tipo: "reserva_produto",
          titulo: "Nova reserva de produto",
          resumo: `${profile?.nome || "Paciente"} reservou ${selectedProduto.nome}`,
          conteudo: `Reserva de ${selectedProduto.nome} - R$ ${Number(selectedProduto.preco).toFixed(2)}${observacao ? ` | Obs: ${observacao}` : ""}`,
          link: "/solicitacoes-alteracao",
        }));
        await supabase.from("notificacoes").insert(notifications);
      }

      return reserva;
    },
    onSuccess: () => {
      toast({ title: "Reserva realizada!" });
      setIsReservaDialogOpen(false);
      setSelectedProduto(null);
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["produtos-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-reservas"] });
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

  // Trending products: prioritize products the patient has reserved before
  const getTrendingProducts = () => {
    const reservedProductIds = produtosHook.minhasReservas.map((r: any) => r.produto_id);
    const reservedCount: Record<string, number> = {};
    reservedProductIds.forEach((id: string) => {
      reservedCount[id] = (reservedCount[id] || 0) + 1;
    });

    const sorted = [...produtosHook.produtosDisponiveis].sort((a: any, b: any) => {
      return (reservedCount[b.id] || 0) - (reservedCount[a.id] || 0);
    });

    return sorted.slice(0, 4);
  };

  const trendingProducts = getTrendingProducts();

  const openWhatsAppClinic = () => {
    const whatsapp = clinicSettings?.whatsapp?.replace(/\D/g, "") || "";
    if (whatsapp) window.open(`https://wa.me/${whatsapp}`, "_blank");
  };

  const openWhatsAppProfissional = (telefone: string) => {
    const phone = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}`, "_blank");
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!patientId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Conta não vinculada</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>Sua conta ainda não está vinculada a um cadastro de paciente.</p>
            <p className="mt-2">Entre em contato com a clínica para configurar seu acesso.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {saudacao}, {(paciente?.nome || profile?.nome || "Paciente").split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            {format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {patientId && <FichaRequestButton pacienteId={patientId} />}
          <Button variant="outline" size="sm" onClick={openWhatsAppClinic} className="gap-2">
            <MessageCircle className="h-4 w-4" /> Suporte
          </Button>
        </div>
      </div>

      {/* Plan warnings - compact */}
      {planoVencimento && diasParaVencer !== null && diasParaVencer <= 15 && diasParaVencer >= 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Clock className="h-4 w-4 shrink-0" />
          <span><strong>Plano vence em {diasParaVencer} dia(s)</strong> — {format(planoVencimento, "dd/MM/yyyy")}</span>
        </div>
      )}
      {planoVencimento && diasParaVencer !== null && diasParaVencer < 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span><strong>Plano vencido</strong> em {format(planoVencimento, "dd/MM/yyyy")} — regularize junto à clínica.</span>
        </div>
      )}

      {/* KPI Cards - 3 columns, cleaner */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sessões</p>
              <p className="text-lg font-bold">
                {planoAtivo ? `${sessoesRestantes}/${planoAtivo.total_sessoes}` : "—"}
              </p>
            </div>
          </div>
          {planoAtivo && <Progress value={sessoesPercent} className="mt-2 h-1.5" />}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Próxima</p>
              <p className="text-sm font-bold">
                {nextAgenda ? format(new Date(nextAgenda.data_horario), "dd/MM HH:mm") : "—"}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Frequência</p>
              <p className="text-lg font-bold">{frequencyStats?.taxa ?? 0}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Financeiro</p>
              {pendenciasCount.length > 0 ? (
                <Badge variant="destructive" className="text-xs">{pendenciasCount.length} pendência(s)</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700">Em dia</Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Trending Products Card */}
      {trendingProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Produtos para Você
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {trendingProducts.map((produto: any) => {
                const isReserved = produtosHook.minhasReservas.some((r: any) => r.produto_id === produto.id);
                return (
                  <div
                    key={produto.id}
                    className="group relative flex flex-col rounded-xl border bg-card p-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => { setSelectedProduto(produto); setIsReservaDialogOpen(true); }}
                  >
                    {produto.foto_url ? (
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                        <img src={produto.foto_url} alt={produto.nome} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-square rounded-lg bg-muted/50 mb-2 flex items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <h4 className="font-medium text-sm line-clamp-1">{produto.nome}</h4>
                    <p className="text-primary font-bold text-sm mt-auto">R$ {Number(produto.preco).toFixed(2)}</p>
                    {isReserved && (
                      <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">⭐ Favorito</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NPS Survey */}
      {patientId && <NpsSurvey pacienteId={patientId} />}

      {/* Dicas do Dia */}
      <DailyTipsCard tipo="paciente" />

      <ConvenioCard />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="conquistas">🎮</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>}>
            <PatientAgendaTab
              agenda={agendaHook.futureAgenda}
              pastAgenda={agendaHook.pastAgenda}
              solicitacoes={agendaHook.solicitacoes}
              updateSessionStatus={updateSessionStatus}
              openWhatsAppProfissional={openWhatsAppProfissional}
              onReschedule={(item) => { setRescheduleData(item); setIsRescheduleOpen(true); }}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>}>
            <PatientFinanceTab
              pendencias={financeHook.pendencias}
              pagamentosMensalidade={financeHook.pagamentosMensalidade}
              pagamentosSessoes={financeHook.pagamentosSessoes}
              formasPagamento={financeHook.formasPagamento}
              configPixMap={financeHook.configPixMap}
              matriculaPayments={financeHook.pagamentosMensalidade}
              pacienteNome={paciente?.nome || profile?.nome || ""}
              pacienteCpf={paciente?.cpf || ""}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PatientProdutosTab
              produtosDisponiveis={produtosHook.produtosDisponiveis}
              onReservar={(produto) => { setSelectedProduto(produto); setIsReservaDialogOpen(true); }}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="conquistas" className="mt-4">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            {patientId && <GamificationDashboard pacienteId={patientId} />}
          </Suspense>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PatientInfoTab
              avisos={avisos}
              feriados={feriados}
              frequencyStats={frequencyStats}
              clinicSettings={clinicSettings}
              openWhatsAppClinic={openWhatsAppClinic}
            />
          </Suspense>
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
