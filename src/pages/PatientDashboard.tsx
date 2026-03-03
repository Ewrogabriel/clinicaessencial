import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Activity, AlertCircle, Phone, TrendingUp, Clock, PartyPopper, Building2, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { useClinicSettings } from "@/hooks/useClinicSettings";

const PatientDashboard = () => {
  const { profile, patientId } = useAuth();
  const { data: clinicSettings } = useClinicSettings();

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
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = p.nome; });
      }
      return (data || []).map((a: any) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id] || "Profissional" },
      }));
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
      const { data, error } = await (supabase
        .from("feriados")
        .select("*")
        .gte("data", new Date().toISOString().split("T")[0])
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

  const hoje = new Date();
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

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
          <p className="text-muted-foreground">Bem-vindo ao seu portal de saúde.</p>
        </div>
        <Button variant="outline" onClick={openWhatsAppClinic} className="gap-2">
          <MessageCircle className="h-4 w-4" /> Falar com a Clínica
        </Button>
      </div>

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
              <div className="space-y-3">
                {agenda.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-medium text-sm">
                        {format(new Date(item.data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.profiles?.nome} • {item.tipo_atendimento}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">{item.status}</Badge>
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

      {/* Clinic Info */}
      {clinicSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Sobre a Clínica
            </CardTitle>
          </CardHeader>
          <CardContent>
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
            <div className="flex gap-2 mt-4">
              {clinicSettings.whatsapp && (
                <Button variant="outline" size="sm" onClick={openWhatsAppClinic} className="gap-2">
                  <MessageCircle className="h-4 w-4" /> WhatsApp Clínica
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PatientDashboard;
