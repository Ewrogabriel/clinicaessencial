import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, X, Calendar, RefreshCw } from "lucide-react";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";

export default function HistoricoSessoes() {
  const { patientId } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAg, setRescheduleAg] = useState<any>(null);

  const { data: sessoes = [] } = useQuery({
    queryKey: ["sessoes-historico", patientId, selectedMonth],
    queryFn: async () => {
      if (!patientId) return [];
      
      const [ano, mes] = selectedMonth.split("-");
      const dataInicio = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      const dataFim = new Date(parseInt(ano), parseInt(mes), 0);

      const { data: rawData, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .gte("data_horario", dataInicio.toISOString())
        .lte("data_horario", dataFim.toISOString())
        .order("data_horario", { ascending: false });

      if (error) throw error;
      const sessions = rawData || [];
      
      // Enrich with professional names
      const profIds = [...new Set(sessions.map((s: any) => s.profissional_id))] as string[];
      const profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = p.nome; });
      }
      const data = sessions.map((s: any) => ({ ...s, profiles: { nome: profMap[s.profissional_id] || "Profissional" } }));

      return data;
    },
    enabled: !!patientId,
  });

  const confirmadas = sessoes.filter((s: any) => s.status === "confirmado" || s.status === "realizado");
  const faltadas = sessoes.filter((s: any) => s.status === "falta");
  const proximas = sessoes.filter((s: any) => s.status === "agendado");

  const handleReschedule = (sessao: any) => {
    setRescheduleAg(sessao);
    setRescheduleOpen(true);
  };

  const renderSessaoCard = (sessao: any) => (
    <div key={sessao.id} className="p-4 border rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <p className="font-semibold">
              {format(new Date(sessao.data_horario), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Profissional: {sessao.profiles?.nome || "Não definido"}
          </p>
          {sessao.notas && (
            <p className="text-sm text-gray-600 mt-2">
              Anotações: {sessao.notas}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div>
            {sessao.status === "confirmado" || sessao.status === "realizado" ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Realizado
              </Badge>
            ) : sessao.status === "falta" ? (
              <Badge className="bg-red-100 text-red-800">
                <X className="w-3 h-3 mr-1" />
                Falta
              </Badge>
            ) : (
              <Badge variant="outline">Agendado</Badge>
            )}
          </div>
          {(sessao.status === "falta" || sessao.status === "cancelado") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReschedule(sessao)}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Remarcar
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico de Sessões</h1>
        <p className="text-gray-600">Acompanhe suas sessões realizadas e faltadas</p>
      </div>

      {/* Filtro de Mês */}
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-xs">
            <label className="text-sm font-medium">Mês</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(12)].map((_, i) => {
                  const data = new Date();
                  data.setMonth(data.getMonth() - i);
                  const value = data.toISOString().substring(0, 7);
                  return (
                    <SelectItem key={value} value={value}>
                      {format(data, "MMMM 'de' yyyy", { locale: ptBR })}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sessões Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{confirmadas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Faltas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{faltadas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Próximas Sessões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{proximas.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs defaultValue="todas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="todas">Todas ({sessoes.length})</TabsTrigger>
          <TabsTrigger value="realizadas">Realizadas ({confirmadas.length})</TabsTrigger>
          <TabsTrigger value="faltadas">Faltadas ({faltadas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="todas" className="space-y-3">
          {sessoes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Nenhuma sessão encontrada
              </CardContent>
            </Card>
          ) : (
            sessoes.map(renderSessaoCard)
          )}
        </TabsContent>

        <TabsContent value="realizadas" className="space-y-3">
          {confirmadas.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Nenhuma sessão realizada
              </CardContent>
            </Card>
          ) : (
            confirmadas.map(renderSessaoCard)
          )}
        </TabsContent>

        <TabsContent value="faltadas" className="space-y-3">
          {faltadas.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Sem faltas registradas
              </CardContent>
            </Card>
          ) : (
            faltadas.map(renderSessaoCard)
          )}
        </TabsContent>
      </Tabs>

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        agendamento={rescheduleAg}
        onSuccess={() => {
          setRescheduleAg(null);
          // Refetch will happen automatically through React Query
        }}
      />
    </div>
  );
}
