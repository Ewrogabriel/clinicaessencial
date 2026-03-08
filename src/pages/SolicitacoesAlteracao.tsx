import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Eye, RefreshCw, ArrowRight, CalendarClock, CalendarPlus, FileEdit } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FIELD_LABELS: Record<string, string> = {
  telefone: "Telefone", email: "Email", data_nascimento: "Data de Nascimento",
  tipo_atendimento: "Tipo de Atendimento", rua: "Rua", numero: "Número",
  complemento: "Complemento", cep: "CEP", bairro: "Bairro", cidade: "Cidade", estado: "Estado",
};

const SolicitacoesAlteracao = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("todas");
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<"dados" | "reagendar" | "remarcar">("dados");
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  // ── Solicitações de Alteração de Dados ──
  const { data: solicitacoesDados = [], isLoading: loadingDados } = useQuery({
    queryKey: ["solicitacoes-alteracao"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("solicitacoes_alteracao_dados") as any)
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const pacienteIds = [...new Set((data || []).map((s: any) => s.paciente_id))] as string[];
      if (pacienteIds.length === 0) return data || [];
      const { data: pacientes } = await supabase.from("pacientes").select("id, nome, cpf").in("id", pacienteIds);
      const pacMap: Record<string, any> = {};
      (pacientes || []).forEach((p: any) => { pacMap[p.id] = p; });
      return (data || []).map((s: any) => ({
        ...s, paciente_nome: pacMap[s.paciente_id]?.nome || "—", paciente_cpf: pacMap[s.paciente_id]?.cpf || "",
      }));
    },
  });

  // ── Solicitações de Reagendamento / Remarcação ──
  const { data: solicitacoesRemarcacao = [], isLoading: loadingRemarc } = useQuery({
    queryKey: ["solicitacoes-remarcacao-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("solicitacoes_remarcacao")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch patient names
      const pacienteIds = [...new Set(data.map((s: any) => s.paciente_id))] as string[];
      const { data: pacientes } = await supabase.from("pacientes").select("id, nome").in("id", pacienteIds);
      const pacMap: Record<string, string> = {};
      (pacientes || []).forEach((p: any) => { pacMap[p.id] = p.nome; });

      // Fetch agendamento details to determine type (reagendar vs remarcar)
      const agendIds = [...new Set(data.map((s: any) => s.agendamento_id))] as string[];
      const { data: agendamentos } = await (supabase.from("agendamentos") as any)
        .select("id, status, data_horario, tipo_atendimento, profissional_id").in("id", agendIds);
      const agendMap: Record<string, any> = {};
      (agendamentos || []).forEach((a: any) => { agendMap[a.id] = a; });

      // Fetch professional names
      const profIds = [...new Set((agendamentos || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = p.nome; });
      }

      return data.map((s: any) => {
        const agend = agendMap[s.agendamento_id];
        const isCancelado = agend?.status === "cancelado" || agend?.status === "falta";
        return {
          ...s,
          paciente_nome: pacMap[s.paciente_id] || "—",
          agendamento: agend,
          profissional_nome: profMap[agend?.profissional_id] || "—",
          tipo_solicitacao: isCancelado ? "remarcar" : "reagendar",
        };
      });
    },
  });

  // ── Mutations ──
  const aprovarDadosMutation = useMutation({
    mutationFn: async (solicitacao: any) => {
      const dadosNovos = solicitacao.dados_novos || {};
      const { error: updateError } = await supabase.from("pacientes").update(dadosNovos).eq("id", solicitacao.paciente_id);
      if (updateError) throw updateError;
      const { error } = await (supabase.from("solicitacoes_alteracao_dados") as any)
        .update({ status: "aprovado", aprovador_id: user?.id, approved_at: new Date().toISOString() })
        .eq("id", solicitacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação aprovada!", description: "Os dados do paciente foram atualizados." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-alteracao"] });
      setDetailOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" }),
  });

  const rejeitarDadosMutation = useMutation({
    mutationFn: async ({ solicitacao, motivo }: { solicitacao: any; motivo: string }) => {
      const { error } = await (supabase.from("solicitacoes_alteracao_dados") as any)
        .update({ status: "rejeitado", aprovador_id: user?.id, motivo_rejeicao: motivo, approved_at: new Date().toISOString() })
        .eq("id", solicitacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação rejeitada." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-alteracao"] });
      setRejectOpen(false); setDetailOpen(false); setMotivoRejeicao("");
    },
    onError: (err: any) => toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" }),
  });

  const aprovarRemarcacaoMutation = useMutation({
    mutationFn: async (solicitacao: any) => {
      // Update agendamento with new date and set status to agendado
      const { error: agendError } = await (supabase.from("agendamentos") as any)
        .update({ data_horario: solicitacao.nova_data_horario, status: "agendado" })
        .eq("id", solicitacao.agendamento_id);
      if (agendError) throw agendError;

      const { error } = await supabase.from("solicitacoes_remarcacao")
        .update({ status: "aprovado", respondido_por: user?.id, respondido_at: new Date().toISOString() } as any)
        .eq("id", solicitacao.id);
      if (error) throw error;

      // Notify patient via notificacoes
      const tipoLabel = solicitacao.tipo_solicitacao === "remarcar" ? "Remarcação" : "Reagendamento";
      await (supabase.from("notificacoes").insert({
        user_id: solicitacao.paciente_id,
        tipo: "solicitacao_aprovada",
        titulo: `${tipoLabel} aprovado`,
        resumo: `Sua sessão foi ${solicitacao.tipo_solicitacao === "remarcar" ? "remarcada" : "reagendada"} para ${format(new Date(solicitacao.nova_data_horario), "dd/MM 'às' HH:mm")}`,
      }) as any);
    },
    onSuccess: () => {
      toast({ title: "Solicitação aprovada!", description: "A sessão foi atualizada." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-remarcacao-admin"] });
      setDetailOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" }),
  });

  const rejeitarRemarcacaoMutation = useMutation({
    mutationFn: async ({ solicitacao, motivo }: { solicitacao: any; motivo: string }) => {
      const { error } = await supabase.from("solicitacoes_remarcacao")
        .update({ status: "rejeitado", respondido_por: user?.id, respondido_at: new Date().toISOString() } as any)
        .eq("id", solicitacao.id);
      if (error) throw error;

      const tipoLabel = solicitacao.tipo_solicitacao === "remarcar" ? "Remarcação" : "Reagendamento";
      await (supabase.from("notificacoes").insert({
        user_id: solicitacao.paciente_id,
        tipo: "solicitacao_rejeitada",
        titulo: `${tipoLabel} recusado`,
        resumo: motivo || `Sua solicitação de ${tipoLabel.toLowerCase()} foi recusada.`,
      }) as any);
    },
    onSuccess: () => {
      toast({ title: "Solicitação rejeitada." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-remarcacao-admin"] });
      setRejectOpen(false); setDetailOpen(false); setMotivoRejeicao("");
    },
    onError: (err: any) => toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" }),
  });

  // ── Helpers ──
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
      pendente: { label: "Pendente", variant: "secondary" },
      aprovado: { label: "Aprovado", variant: "default" },
      rejeitado: { label: "Rejeitado", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const tipoBadge = (tipo: string) => {
    if (tipo === "remarcar") return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Remarcar</Badge>;
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Reagendar</Badge>;
  };

  const getChangedFields = (atual: any, novo: any) => {
    const changes: { field: string; from: string; to: string }[] = [];
    if (!atual || !novo) return changes;
    for (const key of Object.keys(novo)) {
      if (JSON.stringify(atual[key]) !== JSON.stringify(novo[key])) {
        changes.push({ field: FIELD_LABELS[key] || key, from: atual[key] || "—", to: novo[key] || "—" });
      }
    }
    return changes;
  };

  // ── Filters ──
  const pendentesDados = solicitacoesDados.filter((s: any) => s.status === "pendente");
  const historicoDados = solicitacoesDados.filter((s: any) => s.status !== "pendente");
  const reagendamentos = solicitacoesRemarcacao.filter((s: any) => s.tipo_solicitacao === "reagendar");
  const remarcacoes = solicitacoesRemarcacao.filter((s: any) => s.tipo_solicitacao === "remarcar");
  const pendentesReagendar = reagendamentos.filter((s: any) => s.status === "pendente");
  const pendentesRemarcar = remarcacoes.filter((s: any) => s.status === "pendente");
  const totalPendentes = pendentesDados.length + pendentesReagendar.length + pendentesRemarcar.length;

  const isLoading = loadingDados || loadingRemarc;

  // ── Render Remarcação/Reagendamento table ──
  const renderRemarcTable = (items: any[], tipo: "reagendar" | "remarcar") => {
    const pendentes = items.filter((s: any) => s.status === "pendente");
    const historico = items.filter((s: any) => s.status !== "pendente");
    const tipoLabel = tipo === "remarcar" ? "Remarcação" : "Reagendamento";

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {tipo === "remarcar" ? <CalendarPlus className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
              Pendentes ({pendentes.length})
            </CardTitle>
            <CardDescription>
              {tipo === "reagendar"
                ? "Sessões agendadas que o paciente quer alterar a data"
                : "Sessões canceladas que o paciente quer marcar novamente"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pendentes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma solicitação pendente de {tipoLabel.toLowerCase()}.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Data Original</TableHead>
                    <TableHead>Nova Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                      <TableCell>{s.profissional_nome}</TableCell>
                      <TableCell>
                        {s.agendamento?.data_horario
                          ? format(new Date(s.agendamento.data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="font-medium text-primary">
                        {format(new Date(s.nova_data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{s.motivo || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setSelected(s); setSelectedType(tipo); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                          <Button size="sm" onClick={() => aprovarRemarcacaoMutation.mutate(s)} disabled={aprovarRemarcacaoMutation.isPending}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setSelected(s); setSelectedType(tipo); setRejectOpen(true); }}>
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {historico.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Histórico de {tipoLabel}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Nova Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                      <TableCell>{format(new Date(s.nova_data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Solicitações</h1>
        <p className="text-muted-foreground">
          Gerencie solicitações de alteração de dados, reagendamentos e remarcações.
          {totalPendentes > 0 && (
            <Badge variant="destructive" className="ml-2">{totalPendentes} pendente(s)</Badge>
          )}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todas" className="gap-1">
            Todas {totalPendentes > 0 && <Badge variant="secondary" className="ml-1 scale-75">{totalPendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dados" className="gap-1">
            <FileEdit className="h-3.5 w-3.5" /> Dados {pendentesDados.length > 0 && <Badge variant="secondary" className="ml-1 scale-75">{pendentesDados.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reagendar" className="gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> Reagendar {pendentesReagendar.length > 0 && <Badge variant="secondary" className="ml-1 scale-75">{pendentesReagendar.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="remarcar" className="gap-1">
            <CalendarPlus className="h-3.5 w-3.5" /> Remarcar {pendentesRemarcar.length > 0 && <Badge variant="secondary" className="ml-1 scale-75">{pendentesRemarcar.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Tab Todas */}
        <TabsContent value="todas" className="mt-4 space-y-6">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : totalPendentes === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma solicitação pendente.</div>
          ) : (
            <>
              {/* All pending items in one combined table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" /> Todas Pendentes ({totalPendentes})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendentesDados.map((s: any) => {
                        const changes = getChangedFields(s.dados_atuais, s.dados_novos);
                        return (
                          <TableRow key={`dados-${s.id}`}>
                            <TableCell><Badge variant="outline">Dados</Badge></TableCell>
                            <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                            <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                            <TableCell><Badge variant="outline">{changes.length} campo(s)</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => { setSelected(s); setSelectedType("dados"); setDetailOpen(true); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="sm" onClick={() => aprovarDadosMutation.mutate(s)} disabled={aprovarDadosMutation.isPending}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => { setSelected(s); setSelectedType("dados"); setRejectOpen(true); }}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {[...pendentesReagendar, ...pendentesRemarcar].map((s: any) => (
                        <TableRow key={`remarc-${s.id}`}>
                          <TableCell>{tipoBadge(s.tipo_solicitacao)}</TableCell>
                          <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                          <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell className="text-sm">
                            Nova data: {format(new Date(s.nova_data_horario), "dd/MM HH:mm")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => { setSelected(s); setSelectedType(s.tipo_solicitacao); setDetailOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" onClick={() => aprovarRemarcacaoMutation.mutate(s)} disabled={aprovarRemarcacaoMutation.isPending}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { setSelected(s); setSelectedType(s.tipo_solicitacao); setRejectOpen(true); }}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab Dados */}
        <TabsContent value="dados" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileEdit className="h-5 w-5" /> Pendentes ({pendentesDados.length})
              </CardTitle>
              <CardDescription>Solicitações de alteração de dados pessoais</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDados ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
              ) : pendentesDados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma solicitação pendente.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Alterações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentesDados.map((s: any) => {
                      const changes = getChangedFields(s.dados_atuais, s.dados_novos);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                          <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{s.motivo || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{changes.length} campo(s)</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => { setSelected(s); setSelectedType("dados"); setDetailOpen(true); }}>
                                <Eye className="h-4 w-4 mr-1" /> Ver
                              </Button>
                              <Button size="sm" onClick={() => aprovarDadosMutation.mutate(s)} disabled={aprovarDadosMutation.isPending}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { setSelected(s); setSelectedType("dados"); setRejectOpen(true); }}>
                                <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {historicoDados.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Histórico</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo Rejeição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoDados.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                        <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.motivo_rejeicao || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setSelected(s); setSelectedType("dados"); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Reagendar */}
        <TabsContent value="reagendar" className="mt-4">
          {renderRemarcTable(reagendamentos, "reagendar")}
        </TabsContent>

        {/* Tab Remarcar */}
        <TabsContent value="remarcar" className="mt-4">
          {renderRemarcTable(remarcacoes, "remarcar")}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedType === "dados" ? "Detalhes da Alteração de Dados" :
               selectedType === "reagendar" ? "Detalhes do Reagendamento" : "Detalhes da Remarcação"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{selected.paciente_nome}</p>
                  {selectedType === "dados" && <p className="text-sm text-muted-foreground">{selected.paciente_cpf}</p>}
                </div>
                {statusBadge(selected.status)}
              </div>

              {selectedType === "dados" ? (
                <>
                  {selected.motivo && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Motivo do paciente</Label>
                      <p className="text-sm">{selected.motivo}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Alterações solicitadas</Label>
                    {getChangedFields(selected.dados_atuais, selected.dados_novos).map((c, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                        <span className="font-medium min-w-[100px]">{c.field}:</span>
                        <span className="text-muted-foreground line-through">{c.from}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-primary">{c.to}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data Original</Label>
                      <p className="text-sm font-medium">
                        {selected.agendamento?.data_horario
                          ? format(new Date(selected.agendamento.data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nova Data Solicitada</Label>
                      <p className="text-sm font-semibold text-primary">
                        {format(new Date(selected.nova_data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Profissional</Label>
                    <p className="text-sm">{selected.profissional_nome}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <div className="mt-1">{tipoBadge(selected.tipo_solicitacao)}</div>
                  </div>
                  {selected.motivo && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Motivo</Label>
                      <p className="text-sm">{selected.motivo}</p>
                    </div>
                  )}
                </>
              )}

              {selected.status === "pendente" && (
                <DialogFooter className="gap-2">
                  <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                    <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                  <Button onClick={() => {
                    if (selectedType === "dados") aprovarDadosMutation.mutate(selected);
                    else aprovarRemarcacaoMutation.mutate(selected);
                  }} disabled={aprovarDadosMutation.isPending || aprovarRemarcacaoMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                </DialogFooter>
              )}

              {selected.motivo_rejeicao && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Label className="text-xs text-destructive">Motivo da rejeição</Label>
                  <p className="text-sm">{selected.motivo_rejeicao}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo da rejeição</Label>
              <Textarea value={motivoRejeicao} onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Explique o motivo da rejeição..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => {
                if (!selected) return;
                if (selectedType === "dados") {
                  rejeitarDadosMutation.mutate({ solicitacao: selected, motivo: motivoRejeicao });
                } else {
                  rejeitarRemarcacaoMutation.mutate({ solicitacao: selected, motivo: motivoRejeicao });
                }
              }} disabled={rejeitarDadosMutation.isPending || rejeitarRemarcacaoMutation.isPending}>
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SolicitacoesAlteracao;
