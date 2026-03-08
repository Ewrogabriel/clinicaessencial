import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, XCircle, RefreshCw, MessageSquare, Hourglass } from "lucide-react";

interface PatientAgendaTabProps {
  agenda: any[];
  pastAgenda: any[];
  solicitacoes: any[];
  updateSessionStatus: any;
  openWhatsAppProfissional: (tel: string) => void;
  onReschedule: (item: any) => void;
}

export const PatientAgendaTab = ({
  agenda, pastAgenda, solicitacoes, updateSessionStatus,
  openWhatsAppProfissional, onReschedule
}: PatientAgendaTabProps) => {
  const cancelados = pastAgenda.filter((item: any) => item.status === "cancelado");

  return (
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
                    <Button size="icon" variant="ghost"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => openWhatsAppProfissional(item.profissional_telefone || "")}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    {item.status === "agendado" && (
                      <Button size="sm" className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        onClick={() => updateSessionStatus.mutate({ id: item.id, status: "confirmado" })}>
                        <CheckCircle2 className="h-4 w-4" /> Confirmar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1 gap-2"
                      disabled={solicitacoes.some((s: any) => s.agendamento_id === item.id)}
                      onClick={() => onReschedule(item)}>
                      {solicitacoes.some((s: any) => s.agendamento_id === item.id) ? (
                        <><Hourglass className="h-4 w-4" /> Pendente</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> {item.status === "cancelado" || item.status === "falta" ? "Remarcar" : "Reagendar"}</>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 gap-2"
                      onClick={() => updateSessionStatus.mutate({ id: item.id, status: "cancelado" })}>
                      <XCircle className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {cancelados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Sessões Canceladas
            </CardTitle>
            <CardDescription>Você pode solicitar a remarcação dessas sessões.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cancelados.slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(item.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.profiles?.nome} • {item.tipo_atendimento}
                    </p>
                  </div>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => onReschedule(item)}>
                     <RefreshCw className="h-4 w-4" /> Remarcar
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
      </div>
    </div>
  );
};
