import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Activity, AlertCircle, Phone, TrendingUp, Clock, PartyPopper, Building2, MessageCircle, QrCode } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Lightbulb, CheckCircle2, XCircle, RefreshCw, MessageSquare, Hourglass } from "lucide-react";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";

const PatientDashboard = () => {
  const { profile, patientId, loading } = useAuth();
  const { data: clinicSettings } = useClinicSettings();
  const queryClient = useQueryClient();
  const [rescheduleData, setRescheduleData] = useState<any>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<any>(null);
  const [observacao, setObservacao] = useState("");
  const [isReservaDialogOpen, setIsReservaDialogOpen] = useState(false);

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
        .from("formas_pagamento")
        .select("*")
        .eq("ativo", true)
        .order("ordem") as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pagamentosMensalidade = [] } = useQuery({
    queryKey: ["pagamentos-mensalidade-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("pagamentos_mensalidade")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "aberto")
        .order("mes_referencia", { ascending: true }) as any);
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
        .from("pagamentos_sessoes")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "aberto")
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: configPixMap = {} } = useQuery({
    queryKey: ["config-pix-map"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("config_pix")
        .select("forma_pagamento_id, chave_pix, tipo_chave, nome_beneficiario") as any);
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

  const reservarProduto = useMutation({
    mutationFn: async () => {
      if (!patientId || !selectedProduto) throw new Error("Dados inválidos");
      
      // Create reservation
      const { data: reserva, error: reservaError } = await (supabase
        .from("reservas_produtos")
        .insert([{
          paciente_id: patientId,
          produto_id: selectedProduto.id,
          quantidade: 1,
          observacao: observacao || null,
          status: "pendente"
        }])
        .select()
        .single() as any);
      
      if (reservaError) throw reservaError;

      // Create alert for admin
      const { error: avisoError } = await (supabase
        .from("avisos")
        .insert([{
          tipo: "reserva_produto",
          titulo: `Nova reserva de ${selectedProduto.nome}`,
          mensagem: `${profile?.nome || "Paciente"} reservou ${selectedProduto.nome}${observacao ? ` - Observação: ${observacao}` : ""}`,
          reserva_id: reserva?.id,
          lido: false
        }]) as any);
      
      if (avisoError) console.error("Erro ao criar aviso:", avisoError);
      
      return reserva;
    },
    onSuccess: () => {
      toast({ title: "Reserva realizada!", description: "Você receberá um contato para finalizar a compra." });
      setIsReservaDialogOpen(false);
      setSelectedProduto(null);
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["produtos-disponiveis"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao reservar", description: (error as any).message, variant: "destructive" });
    }
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
              Feriados – Clínica Fechada
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
            <p className="text-xs text-muted-foreground mt-3">⚠️ Não haverá atendimentos nestas datas. Aulas não serão repostas.</p>
          </CardContent>
        </Card>
      )}

      {/* Next sessions & Notices */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas Sessões</CardTitle>
          </CardHeader>
          <CardContent>
            {agenda.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Nenhum agendamento futuro encontrado.
              </div>
            ) : (
              <div className="space-y-4">
                {agenda.map((item: any) => (
                  <div key={item.id} className="flex flex-col p-4 rounded-xl border bg-card shadow-sm group transition-all hover:border-primary/50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-base">
                          {format(new Date(item.data_horario), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        <p className="text-sm text-primary font-medium flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(item.data_horario), "HH:mm")}
                        </p>
                      </div>
                      <Badge variant={item.status === 'confirmado' ? 'default' : 'secondary'} className="capitalize">
                        {item.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 mb-4">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {item.profiles?.nome?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{item.profiles?.nome}</p>
                        <p className="text-[10px] text-muted-foreground truncate capitalize">{item.tipo_atendimento}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Falar com o profissional"
                        onClick={() => openWhatsAppProfissional(item.profissional_telefone || "")}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      {item.status === "agendado" && (
                        <Button
                          size="sm"
                          className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => updateSessionStatus.mutate({ id: item.id, status: "confirmado" })}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Confirmar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={solicitacoes.some((s: any) => s.agendamento_id === item.id)}
                        onClick={() => {
                          setRescheduleData(item);
                          setIsRescheduleOpen(true);
                        }}
                      >
                        {solicitacoes.some((s: any) => s.agendamento_id === item.id) ? (
                          <><Hourglass className="h-4 w-4" /> Pendente</>
                        ) : (
                          <><RefreshCw className="h-4 w-4" /> Reagendar</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 gap-2"
                        onClick={() => updateSessionStatus.mutate({ id: item.id, status: "cancelado" })}
                      >
                        <XCircle className="h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancelled appointments - option to reschedule */}
        {pastAgenda.filter((item: any) => item.status === "cancelado").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Sessões Canceladas
              </CardTitle>
              <CardDescription>Você pode solicitar o reagendamento dessas sessões.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pastAgenda.filter((item: any) => item.status === "cancelado").slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(item.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.profiles?.nome} • {item.tipo_atendimento}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setRescheduleData(item);
                        setIsRescheduleOpen(true);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" /> Reagendar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Sessões</CardTitle>
            </CardHeader>
            <CardContent>
              {pastAgenda.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sessão anterior encontrada.</p>
              ) : (
                <div className="space-y-3">
                  {pastAgenda.map((item: any) => (
                    <div key={item.id} className="flex flex-col p-3 rounded-lg border bg-background text-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{format(new Date(item.data_horario), "dd/MM/yyyy")}</span>
                        <Badge variant={
                          item.status === 'realizado' ? 'default' :
                            item.status === 'cancelado' || item.status === 'falta' ? 'destructive' : 'secondary'
                        } className="text-[10px] scale-90 origin-right">
                          {item.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {item.profiles?.nome} • {item.tipo_atendimento}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Mural de Avisos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {avisos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum aviso no momento.</p>
              ) : (
                avisos.map((aviso: any) => (
                  <div key={aviso.id} className="bg-background p-3 rounded-md border shadow-sm">
                    <h4 className="font-semibold text-primary">{aviso.titulo}</h4>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{aviso.mensagem}</p>
                    <span className="text-[10px] text-muted-foreground mt-2 block">
                      {format(new Date(aviso.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Frequency Stats Card */}
        {frequencyStats && frequencyStats.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Estatísticas de Frequência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{frequencyStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de sessões</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-primary">{frequencyStats.realizados}</p>
                  <p className="text-xs text-muted-foreground">Realizadas</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-destructive">{frequencyStats.cancelados}</p>
                  <p className="text-xs text-muted-foreground">Canceladas</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-destructive">{frequencyStats.faltas}</p>
                  <p className="text-xs text-muted-foreground">Faltas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Sobre a Clínica
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
                      {[clinicSettings.endereco, clinicSettings.numero ? `nº ${clinicSettings.numero}` : "", clinicSettings.bairro, clinicSettings.cidade, clinicSettings.estado].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {clinicSettings.telefone && <p className="text-muted-foreground">Tel: {clinicSettings.telefone}</p>}
                  {clinicSettings.instagram && <p className="text-muted-foreground">Instagram: {clinicSettings.instagram}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground animate-pulse">Carregando informações da clínica...</p>
            )}
            <div className="flex gap-2 mt-4">
              {clinicSettings?.whatsapp && (
                <Button variant="outline" size="sm" onClick={openWhatsAppClinic} className="gap-2">
                  <MessageCircle className="h-4 w-4" /> WhatsApp Clínica
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formas de Pagamento - Mensalidade e Sessões Abertas */}
      {(pagamentosMensalidade.length > 0 || pagamentosSessoes.length > 0) && formasPagamento.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              Formas de Pagamento
            </CardTitle>
            <CardDescription>Escolha como deseja realizar o pagamento de sua mensalidade ou sessões abertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mensalidades em Aberto */}
            {pagamentosMensalidade.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Mensalidades em Aberto</h4>
                  <Badge variant="destructive">{pagamentosMensalidade.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pagamentosMensalidade.map((pag: any) => (
                    <div key={pag.id} className="p-3 rounded-lg border bg-white flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(pag.mes_referencia), "MMMM 'de' yyyy", { locale: ptBR })}</p>
                        <p className="text-sm text-muted-foreground">R$ {Number(pag.valor).toFixed(2)}</p>
                      </div>
                      <Badge variant="outline" className="ml-2">Pendente</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessões em Aberto */}
            {pagamentosSessoes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Sessões em Aberto</h4>
                  <Badge variant="destructive">{pagamentosSessoes.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pagamentosSessoes.slice(0, 3).map((pag: any) => (
                    <div key={pag.id} className="p-3 rounded-lg border bg-white flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Sessão</p>
                        <p className="text-sm text-muted-foreground">R$ {Number(pag.valor).toFixed(2)}</p>
                      </div>
                      <Badge variant="outline" className="ml-2">Pendente</Badge>
                    </div>
                  ))}
                  {pagamentosSessoes.length > 3 && (
                    <p className="text-xs text-muted-foreground">+ {pagamentosSessoes.length - 3} sessões pendentes</p>
                  )}
                </div>
              </div>
            )}

            {/* Formas de Pagamento Disponíveis */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-sm">Escolha uma forma de pagamento:</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {formasPagamento.map((forma: any) => {
                  const pixConfig = configPixMap[forma.id];
                  return (
                    <button
                      key={forma.id}
                      className="p-4 rounded-lg border border-orange-200 bg-white hover:bg-orange-50 hover:border-orange-400 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-semibold text-sm">{forma.nome}</h5>
                        {forma.tipo === "pix" && <QrCode className="h-4 w-4 text-orange-600" />}
                      </div>
                      {forma.descricao && <p className="text-xs text-muted-foreground mb-2">{forma.descricao}</p>}
                      
                      {/* PIX Details */}
                      {forma.tipo === "pix" && pixConfig && (
                        <div className="bg-blue-50 rounded p-2 text-xs space-y-1">
                          <p className="text-blue-900"><strong>Chave PIX:</strong> {pixConfig.chave_pix}</p>
                          <p className="text-blue-900"><strong>Beneficiário:</strong> {pixConfig.nome_beneficiario}</p>
                        </div>
                      )}
                      
                      <Button size="sm" className="w-full mt-3 bg-orange-600 hover:bg-orange-700">
                        Pagar com {forma.nome}
                      </Button>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produtos Disponíveis */}
      {produtosDisponiveis.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Produtos em Estoque
            </CardTitle>
            <CardDescription>Confira nossos produtos disponíveis para compra ou reserva</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {produtosDisponiveis.map((produto: any) => (
                <div key={produto.id} className="p-4 rounded-lg border border-blue-200 bg-white hover:border-blue-400 transition-colors">
                  <div className="mb-3">
                    <h4 className="font-semibold text-sm mb-1 line-clamp-2">{produto.nome}</h4>
                    {produto.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{produto.descricao}</p>}
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-blue-600">
                      R$ {Number(produto.preco).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {produto.estoque} em estoque
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setSelectedProduto(produto);
                      setIsReservaDialogOpen(true);
                    }}
                  >
                    Reservar Agora
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reserva Produto Dialog */}
      {isReservaDialogOpen && selectedProduto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reservar {selectedProduto.nome}</CardTitle>
              <CardDescription>Preencha os dados para reservar este produto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Preço</p>
                <p className="text-2xl font-bold text-blue-600">R$ {Number(selectedProduto.preco).toFixed(2)}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Observação (opcional)</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="Adicione uma observação sobre sua reserva..."
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReservaDialogOpen(false);
                    setSelectedProduto(null);
                    setObservacao("");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={reservarProduto.isPending}
                  onClick={() => reservarProduto.mutate()}
                >
                  {reservarProduto.isPending ? "Reservando..." : "Confirmar Reserva"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                A clínica entrará em contato para finalizar a compra.
              </p>
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
