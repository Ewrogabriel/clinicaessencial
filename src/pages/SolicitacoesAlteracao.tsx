import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Eye, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FIELD_LABELS: Record<string, string> = {
  telefone: "Telefone",
  email: "Email",
  data_nascimento: "Data de Nascimento",
  tipo_atendimento: "Tipo de Atendimento",
  rua: "Rua",
  numero: "Número",
  complemento: "Complemento",
  cep: "CEP",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado",
};

const SolicitacoesAlteracao = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["solicitacoes-alteracao"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("solicitacoes_alteracao_dados") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Buscar nomes dos pacientes
      const pacienteIds = [...new Set((data || []).map((s: any) => s.paciente_id))] as string[];
      if (pacienteIds.length === 0) return data || [];

      const { data: pacientes } = await supabase
        .from("pacientes")
        .select("id, nome, cpf")
        .in("id", pacienteIds);

      const pacMap: Record<string, any> = {};
      (pacientes || []).forEach((p: any) => { pacMap[p.id] = p; });

      return (data || []).map((s: any) => ({
        ...s,
        paciente_nome: pacMap[s.paciente_id]?.nome || "—",
        paciente_cpf: pacMap[s.paciente_id]?.cpf || "",
      }));
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: async (solicitacao: any) => {
      // 1. Aplicar alterações na tabela pacientes
      const dadosNovos = solicitacao.dados_novos || {};
      const { error: updateError } = await supabase
        .from("pacientes")
        .update(dadosNovos)
        .eq("id", solicitacao.paciente_id);
      if (updateError) throw updateError;

      // 2. Atualizar status da solicitação
      const { error } = await (supabase
        .from("solicitacoes_alteracao_dados") as any)
        .update({
          status: "aprovado",
          aprovador_id: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", solicitacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação aprovada!", description: "Os dados do paciente foram atualizados." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-alteracao"] });
      setDetailOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async ({ solicitacao, motivo }: { solicitacao: any; motivo: string }) => {
      const { error } = await (supabase
        .from("solicitacoes_alteracao_dados") as any)
        .update({
          status: "rejeitado",
          aprovador_id: user?.id,
          motivo_rejeicao: motivo,
          approved_at: new Date().toISOString(),
        })
        .eq("id", solicitacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação rejeitada." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-alteracao"] });
      setRejectOpen(false);
      setDetailOpen(false);
      setMotivoRejeicao("");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
      pendente: { label: "Pendente", variant: "secondary" },
      aprovado: { label: "Aprovado", variant: "default" },
      rejeitado: { label: "Rejeitado", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getChangedFields = (atual: any, novo: any) => {
    const changes: { field: string; from: string; to: string }[] = [];
    if (!atual || !novo) return changes;
    for (const key of Object.keys(novo)) {
      if (JSON.stringify(atual[key]) !== JSON.stringify(novo[key])) {
        changes.push({
          field: FIELD_LABELS[key] || key,
          from: atual[key] || "—",
          to: novo[key] || "—",
        });
      }
    }
    return changes;
  };

  const pendentes = solicitacoes.filter((s: any) => s.status === "pendente");
  const historico = solicitacoes.filter((s: any) => s.status !== "pendente");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Solicitações de Alteração</h1>
        <p className="text-muted-foreground">Gerencie solicitações de alteração de dados dos pacientes.</p>
      </div>

      {/* Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Pendentes ({pendentes.length})
          </CardTitle>
          <CardDescription>Solicitações aguardando aprovação</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : pendentes.length === 0 ? (
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
                {pendentes.map((s: any) => {
                  const changes = getChangedFields(s.dados_atuais, s.dados_novos);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                      <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{s.motivo || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{changes.length} campo(s)</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setSelected(s); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                          <Button size="sm" variant="default" onClick={() => aprovarMutation.mutate(s)}
                            disabled={aprovarMutation.isPending}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setSelected(s); setRejectOpen(true); }}>
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

      {/* Histórico */}
      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico</CardTitle>
          </CardHeader>
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
                {historico.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.paciente_nome}</TableCell>
                    <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{s.motivo_rejeicao || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setSelected(s); setDetailOpen(true); }}>
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{selected.paciente_nome}</p>
                  <p className="text-sm text-muted-foreground">{selected.paciente_cpf}</p>
                </div>
                {statusBadge(selected.status)}
              </div>

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

              {selected.status === "pendente" && (
                <DialogFooter className="gap-2">
                  <Button variant="destructive" onClick={() => { setRejectOpen(true); }}>
                    <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                  <Button onClick={() => aprovarMutation.mutate(selected)} disabled={aprovarMutation.isPending}>
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
              <Textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Explique o motivo da rejeição..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selected) {
                    rejeitarMutation.mutate({ solicitacao: selected, motivo: motivoRejeicao });
                  }
                }}
                disabled={rejeitarMutation.isPending}
              >
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
