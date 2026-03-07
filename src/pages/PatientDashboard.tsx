import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, Activity, AlertCircle, TrendingUp, Clock, PartyPopper, Building2, MessageCircle, CalendarDays, History, CreditCard, ShoppingBag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Lightbulb, RefreshCw } from "lucide-react";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { LazySection } from "@/hooks/useLazySection";
import { PatientSessionsSection, PatientHistorySection, PatientPaymentSection, PatientProductsSection } from "@/components/patient-dashboard";

const PatientDashboard = () => {
  const { profile, patientId, loading } = useAuth();
  const { data: clinicSettings } = useClinicSettings();
  const queryClient = useQueryClient();
  const [rescheduleData, setRescheduleData] = useState<any>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("agenda");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { data: paciente } = useQuery({
    queryKey: ["patient-self", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase
        .from("pacientes")
        .select("*")
        .eq("id", patientId)
        .single() as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: agenda = [] } = useQuery({
    queryKey: ["patient-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .gte("data_horario", new Date().toISOString())
        .in("status", ["agendado", "confirmado"])
        .order("data_horario", { ascending: true })
        .limit(5) as any);
      if (error) throw error;
      // Manual profile lookup (no FK join)
      const profIds = [...new Set((data || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, { nome: string; telefone: string }> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome, telefone").in("user_id", profIds);
        (profs || []).forEach((p: any) => {
          profMap[p.user_id] = { nome: p.nome, telefone: p.telefone };
        });
      }
      return (data || []).map((a: any) => {
        const profInfo = profMap[a.profissional_id] || { nome: "Profissional", telefone: "" };
        return {
          ...a,
          profiles: { nome: profInfo.nome },
          profissional_telefone: profInfo.telefone
        };
      });
    },
    enabled: !!patientId,
  });

  const { data: planoAtivo } = useQuery({
    queryKey: ["patient-plano", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase
        .from("planos")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "ativo")
        .maybeSingle() as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: frequencyStats } = useQuery({
    queryKey: ["patient-frequency", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("status")
        .eq("paciente_id", patientId) as any);
      if (error) throw error;
      const total = data?.length || 0;
      const realizados = data?.filter((a: any) => a.status === "realizado").length || 0;
      const cancelados = data?.filter((a: any) => a.status === "cancelado").length || 0;
      const faltas = data?.filter((a: any) => a.status === "falta").length || 0;
      const taxa = total > 0 ? Math.round((realizados / total) * 100) : 0;
      return { total, realizados, cancelados, faltas, taxa };
    },
    enabled: !!patientId,
  });

  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["feriados-patient"],
    queryFn: async () => {
      const hoje = new Date();
      const dataFutura = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const { data, error } = await (supabase
        .from("feriados")
        .select("*")
        .gte("data", hoje.toISOString().split("T")[0])
        .lte("data", dataFutura.toISOString().split("T")[0])
        .order("data")
        .limit(10) as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendencias = [] } = useQuery({
    queryKey: ["patient-pendencias", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("pagamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "pendente")
        .order("data_vencimento", { ascending: true }) as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["patient-solicitacoes", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("solicitacoes_remarcacao")
        .select("agendamento_id, status")
        .eq("paciente_id", patientId)
        .eq("status", "pendente");
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: produtosDisponiveis = [] } = useQuery({
    queryKey: ["produtos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos")
        .select("*")
        .gt("estoque", 0)
        .eq("ativo", true)
        .order("nome") as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas-pagamento-ativas"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("formas_pagamento" as any) as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pagamentosMensalidade = [] } = useQuery({
    queryKey: ["pagamentos-mensalidade-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("pagamentos_mensalidade" as any) as any)
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "aberto")
        .order("mes_referencia", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: pagamentosSessoes = [] } = useQuery({
    queryKey: ["pagamentos-sessoes-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("pagamentos_sessoes" as any) as any)
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "aberto")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: configPixMap = {} } = useQuery({
    queryKey: ["config-pix-map"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("config_pix" as any) as any)
        .select("forma_pagamento_id, chave_pix, tipo_chave, nome_beneficiario");
      const map: any = {};
      (data || []).forEach((p: any) => {
        map[p.forma_pagamento_id] = p;
      });
      return map;
    },
  });

  // Daily tips - simulated based on day
  const dicasPaciente = [
    { id: 1, titulo: "Hidratação e Bem-estar", conteudo: "Beba pelo menos 2 litros de água por dia. A hidratação adequada melhora a flexibilidade muscular e previne cãibras durante os exercícios de pilates." },
    { id: 2, titulo: "Respiração Correta em Pilates", conteudo: "Inspire pelo nariz e expire pela boca. A respiração coordenada durante os movimentos ativa o transverso do abdômen, potencializando os resultados." },
    { id: 3, titulo: "Postura no Dia a Dia", conteudo: "Mantenha a coluna reta ao sentar. Uma boa postura reduz dores nas costas e melhora a qualidade de vida." },
    { id: 4, titulo: "Alimentação Pré-aula", conteudo: "Evite refeições pesadas 2 horas antes da aula. Uma pequena banana ou barra de cereal é ideal para fornecer energia sem desconforto." },
  ];
  const dailyTip = dicasPaciente[new Date().getDate() % dicasPaciente.length];

  const { data: pastAgenda = [] } = useQuery({

    queryKey: ["patient-agenda-past", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .lt("data_horario", new Date().toISOString())
        .order("data_horario", { ascending: false })
        .limit(10) as any);
      if (error) throw error;

      const profIds = [...new Set((data || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, { nome: string; telefone: string }> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome, telefone").in("user_id", profIds);
        (profs || []).forEach((p: any) => {
          profMap[p.user_id] = { nome: p.nome, telefone: p.telefone };
        });
      }
      return (data || []).map((a: any) => {
        const profInfo = profMap[a.profissional_id] || { nome: "Profissional", telefone: "" };
        return {
          ...a,
          profiles: { nome: profInfo.nome },
          profissional_telefone: profInfo.telefone
        };
      });
    },
    enabled: !!patientId,
  });

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

  const hoje = new Date();
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const horaAtual = format(hoje, "HH:mm");
  const dataAtual = format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const sessoesRestantes = planoAtivo ? (planoAtivo.total_sessoes - planoAtivo.sessoes_utilizadas) : 0;
  const sessoesPercent = planoAtivo ? Math.round((planoAtivo.sessoes_utilizadas / planoAtivo.total_sessoes) * 100) : 0;

  const planoVencimento = planoAtivo?.data_vencimento ? new Date(planoAtivo.data_vencimento) : null;
  const diasParaVencer = planoVencimento ? differenceInDays(planoVencimento, hoje) : null;

  const openWhatsAppClinic = () => {
    const whatsapp = clinicSettings?.whatsapp?.replace(/\D/g, "") || "";
    if (whatsapp) window.open(`https://wa.me/${whatsapp}`, "_blank");
  };

  const openWhatsAppProfissional = (telefone: string) => {
    const phone = telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${fullPhone}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
            {saudacao}, {profile?.nome?.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground">{dataAtual} • {horaAtual}</p>
        </div>
        <Button variant="outline" onClick={openWhatsAppClinic} className="gap-2">
          <MessageCircle className="h-4 w-4" /> Suporte
        </Button>
      </div>

      {/* Highlights: Daily Tip */}
      {dailyTip && (
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Lightbulb className="h-24 w-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Lightbulb className="h-5 w-5" />
              Dica do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-bold text-xl mb-1">{dailyTip.titulo}</h3>
            <p className="text-indigo-100 italic text-sm">"{dailyTip.conteudo}"</p>
          </CardContent>
        </Card>
      )}

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
            {planoAtivo && (
              <Progress value={sessoesPercent} className="mt-2 h-2" />
            )}
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
              {agenda.length > 0
                ? format(new Date(agenda[0].data_horario), "dd 'de' MMM, HH:mm", { locale: ptBR })
                : "Nenhuma"}
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
                <Badge variant="destructive" className="mb-1">
                  {pendencias.length} pendência(s)
                </Badge>
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

      {/* Plan expiry warning */}
      {planoVencimento && diasParaVencer !== null && diasParaVencer <= 15 && diasParaVencer >= 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Clock className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <strong>Seu plano vence em {diasParaVencer} dia(s)!</strong>
            <p className="text-xs mt-1">
              Vencimento: {format(planoVencimento, "dd/MM/yyyy")}. Entre em contato com a clínica para renovação.
            </p>
          </div>
        </div>
      )}

      {planoVencimento && diasParaVencer !== null && diasParaVencer < 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <strong>Seu plano está vencido!</strong>
            <p className="text-xs mt-1">
              Venceu em {format(planoVencimento, "dd/MM/yyyy")}. Regularize junto à clínica.
            </p>
          </div>
        </div>
      )}

      {/* Feriados Alert */}
      {feriados.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              Feriados - Clínica Fechada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feriados.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between p-2 rounded-md bg-background border text-sm">
                  <span className="font-medium">{f.descricao}</span>
                  <Badge variant="outline">{format(new Date(f.data + "T12:00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR })}</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Nao havera atendimentos nestas datas. Aulas nao serao repostas.</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Content Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="agenda" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historico</span>
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-6">
          <LazySection
            fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>}
          >
            <PatientSessionsSection
              agenda={agenda}
              pastAgenda={pastAgenda}
              solicitacoes={solicitacoes}
              onConfirm={(id) => updateSessionStatus.mutate({ id, status: "confirmado" })}
              onCancel={(id) => updateSessionStatus.mutate({ id, status: "cancelado" })}
              onReschedule={(item) => {
                setRescheduleData(item);
                setIsRescheduleOpen(true);
              }}
              onWhatsApp={openWhatsAppProfissional}
            />
          </LazySection>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <LazySection
            fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>}
          >
            <PatientHistorySection
              pastAgenda={pastAgenda}
              avisos={avisos}
              frequencyStats={frequencyStats}
            />
          </LazySection>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-6">
          <LazySection
            fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>}
          >
            <PatientPaymentSection
              pagamentosMensalidade={pagamentosMensalidade}
              pagamentosSessoes={pagamentosSessoes}
              formasPagamento={formasPagamento}
              configPixMap={configPixMap}
            />
          </LazySection>
        </TabsContent>

        <TabsContent value="produtos" className="mt-6">
          <LazySection
            fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>}
          >
            <PatientProductsSection
              produtosDisponiveis={produtosDisponiveis}
              patientId={patientId}
              profileName={profile?.nome}
            />
          </LazySection>
        </TabsContent>
      </Tabs>

      {/* Sobre a Clinica - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Sobre a Clinica
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clinicSettings ? (
            <div className="flex items-start gap-4">
              {clinicSettings.logo_url && (
                <img src={clinicSettings.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-cover border shrink-0" />
              )}
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-base">{clinicSettings.nome}</p>
                {clinicSettings.cnpj && <p className="text-muted-foreground">CNPJ: {clinicSettings.cnpj}</p>}
                {clinicSettings.endereco && (
                  <p className="text-muted-foreground">
                    {[clinicSettings.endereco, clinicSettings.numero ? `no ${clinicSettings.numero}` : "", clinicSettings.bairro, clinicSettings.cidade, clinicSettings.estado].filter(Boolean).join(", ")}
                  </p>
                )}
                {clinicSettings.telefone && <p className="text-muted-foreground">Tel: {clinicSettings.telefone}</p>}
                {clinicSettings.instagram && <p className="text-muted-foreground">Instagram: {clinicSettings.instagram}</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground animate-pulse">Carregando informacoes da clinica...</p>
          )}
          <div className="flex gap-2 mt-4">
            {clinicSettings?.whatsapp && (
              <Button variant="outline" size="sm" onClick={openWhatsAppClinic} className="gap-2">
                <MessageCircle className="h-4 w-4" /> WhatsApp Clinica
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
