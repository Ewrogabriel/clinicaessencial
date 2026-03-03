import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MeusPlanos = () => {
  const { user, patientId } = useAuth();

  const { data: planos = [] } = useQuery({
    queryKey: ["meus-planos", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("planos")
        .select("*, profiles(nome)")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  const planoAtivo = planos.find((p: any) => p.status === "ativo");
  const planosVencidos = planos.filter((p: any) => p.status === "vencido");
  const planosFinalizado = planos.filter((p: any) => p.status === "finalizado");

  const consultasDisponiveis = planoAtivo
    ? planoAtivo.total_sessoes - planoAtivo.sessoes_utilizadas
    : 0;

  const statusConfig: Record<string, { label: string; variant: string; icon: any }> = {
    ativo: { label: "Ativo", variant: "default", icon: CheckCircle2 },
    vencido: { label: "Vencido", variant: "destructive", icon: AlertCircle },
    finalizado: { label: "Finalizado", variant: "secondary", icon: CheckCircle2 },
    cancelado: { label: "Cancelado", variant: "outline", icon: AlertCircle },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meus Planos e Matrícula</h1>
        <p className="text-muted-foreground">Visualize seus planos de sessões e consultas disponíveis</p>
      </div>

      {planoAtivo && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plano Ativo</p>
                  <p className="text-2xl font-bold capitalize">{planoAtivo.tipo_atendimento}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-green-600">{consultasDisponiveis}</p>
                  <p className="text-sm text-muted-foreground">Consultas disponíveis</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso das sessões</span>
                  <span>{planoAtivo.sessoes_utilizadas}/{planoAtivo.total_sessoes}</span>
                </div>
                <Progress
                  value={(planoAtivo.sessoes_utilizadas / planoAtivo.total_sessoes) * 100}
                  className="h-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Profissional</p>
                  <p className="font-medium">{planoAtivo.profiles?.nome || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">
                    {planoAtivo.data_vencimento
                      ? format(new Date(planoAtivo.data_vencimento), "dd/MM/yyyy", { locale: ptBR })
                      : "Sem data"}
                  </p>
                </div>
              </div>

              {consultasDisponiveis > 0 && (
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                  <Calendar className="h-4 w-4" />
                  Agendar Consulta
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {consultasDisponiveis === 0 && !planoAtivo && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você não possui um plano ativo. Entre em contato com a clínica para contratar um novo plano.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela de todos os planos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Planos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Sessões</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum plano encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  planos.map((plano: any) => {
                    const config = statusConfig[plano.status];
                    const Icon = config?.icon;
                    return (
                      <TableRow key={plano.id}>
                        <TableCell className="capitalize font-medium">
                          {plano.tipo_atendimento}
                        </TableCell>
                        <TableCell>{plano.profiles?.nome || "N/A"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {plano.sessoes_utilizadas}/{plano.total_sessoes}
                            <div className="text-xs text-muted-foreground">
                              {plano.total_sessoes - plano.sessoes_utilizadas} restantes
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>R$ {parseFloat(plano.valor || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-sm">
                          <div>
                            {format(new Date(plano.data_inicio), "dd/MM/yy", { locale: ptBR })}
                            {plano.data_vencimento && (
                              <>
                                <br />
                                até {format(new Date(plano.data_vencimento), "dd/MM/yy", { locale: ptBR })}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={config?.variant as any}>
                            {config?.label || plano.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Informações sobre renovação */}
      {planoAtivo && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seu plano vence em {planoAtivo.data_vencimento
              ? format(new Date(planoAtivo.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : "breve"}. Entre em contato com a clínica para renovar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default MeusPlanos;
