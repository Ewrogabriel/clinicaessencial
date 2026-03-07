import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientHistorySectionProps {
  pastAgenda: any[];
  avisos: any[];
  frequencyStats: {
    total: number;
    realizados: number;
    cancelados: number;
    faltas: number;
    taxa: number;
  } | null;
}

export function PatientHistorySection({
  pastAgenda,
  avisos,
  frequencyStats,
}: PatientHistorySectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        {/* Histórico de Sessões */}
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
                      {item.profiles?.nome} - {item.tipo_atendimento}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mural de Avisos */}
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

      {/* Estatísticas de Frequência */}
      {frequencyStats && frequencyStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estatísticas de Frequência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
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
    </div>
  );
}
