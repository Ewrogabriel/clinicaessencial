import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const MeuHistorico = () => {
  const { patientId } = useAuth();

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["patient-history", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("agendamentos")
        .select(`*, profiles:profissional_id (nome)`)
        .eq("paciente_id", patientId)
        .in("status", ["realizado", "cancelado", "falta"])
        .order("data_horario", { ascending: false }) as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    realizado: { label: "Realizado", variant: "secondary", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    cancelado: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3.5 w-3.5" /> },
    falta: { label: "Falta", variant: "destructive", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Histórico de Consultas</h1>
        <p className="text-muted-foreground">Todas as suas sessões anteriores.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground italic">Carregando histórico...</div>
          ) : agendamentos.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum histórico encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {agendamentos.map((item: any) => {
                const cfg = statusConfig[item.status] || statusConfig.realizado;
                return (
                  <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {format(new Date(item.data_horario), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.profiles?.nome} • {item.tipo_atendimento} • {item.duracao_minutos}min
                        </p>
                      </div>
                      <Badge variant={cfg.variant} className="gap-1">
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>
                    {item.observacoes && (
                      <p className="text-xs text-muted-foreground mt-2 italic bg-muted p-2 rounded">
                        {item.observacoes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MeuHistorico;
