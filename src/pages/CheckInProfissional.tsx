import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

const CheckInProfissional = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: agendamentosDia = [] } = useQuery({
    queryKey: ["agendamentos-dia", user?.id, selectedDate],
    queryFn: async () => {
      if (!user) return [];
      const inicio = `${selectedDate}T00:00:00`;
      const fim = `${selectedDate}T23:59:59`;

      const { data, error } = await supabase
        .from("agendamentos")
        .select("*, pacientes(nome, telefone, email)")
        .eq("profissional_id", user.id)
        .gte("data_horario", inicio)
        .lte("data_horario", fim)
        .in("status", ["agendado", "confirmado"])
        .order("data_horario", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, presenca }: { id: string; presenca: "presente" | "faltou" }) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: presenca === "presente" ? "realizado" : "faltou" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos-dia"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: String(error), variant: "destructive" });
    },
  });

  const proximoAgendamento = agendamentosDia[0];
  const horaProxima = proximoAgendamento
    ? format(new Date(proximoAgendamento.data_horario), "HH:mm", { locale: ptBR })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check-in Profissional</h1>
          <p className="text-muted-foreground">Gerencie as presenças dos pacientes do dia</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border rounded-md"
        />
      </div>

      {/* Card de próximo agendamento */}
      {proximoAgendamento && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Próximo Agendamento</p>
                  <p className="text-2xl font-bold">
                    {horaProxima} - {proximoAgendamento.pacientes?.nome}
                  </p>
                </div>
              </div>
              <Badge variant="default">{agendamentosDia.length} agendamentos</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de agendamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentosDia.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum agendamento para este dia
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentosDia.map((agendamento: any) => (
                    <TableRow key={agendamento.id}>
                      <TableCell className="font-medium">
                        {format(new Date(agendamento.data_horario), "HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{agendamento.pacientes?.nome || "N/A"}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-0.5">
                          {agendamento.pacientes?.telefone && (
                            <p>{agendamento.pacientes.telefone}</p>
                          )}
                          {agendamento.pacientes?.email && (
                            <p className="text-muted-foreground">{agendamento.pacientes.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{agendamento.tipo_atendimento || "Consulta"}</TableCell>
                      <TableCell>{agendamento.duracao_minutos || 60} min</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            updateStatus.mutate({ id: agendamento.id, presenca: "presente" })
                          }
                          className="gap-1"
                          disabled={updateStatus.isPending}
                        >
                          <Check className="h-3 w-3" />
                          Presente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatus.mutate({ id: agendamento.id, presenca: "faltou" })
                          }
                          className="gap-1"
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-3 w-3" />
                          Faltou
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckInProfissional;
