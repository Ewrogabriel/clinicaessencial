import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MinhaAgenda = () => {
  const { patientId } = useAuth();
  const queryClient = useQueryClient();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["patient-full-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          profiles:profissional_id (nome)
        `)
        .eq("paciente_id", patientId)
        .order("data_horario", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-full-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["patient-agenda"] });
      toast.success("Sessão desmarcada com sucesso.");
      setCancelingId(null);
    },
    onError: (error) => {
      toast.error("Erro ao desmarcar sessão: " + error.message);
    },
  });

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    confirmado: { label: "Confirmado", variant: "default" },
    realizado: { label: "Realizado", variant: "secondary" },
    cancelado: { label: "Cancelado", variant: "destructive" },
    pendente: { label: "Pendente", variant: "outline" },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Minha Agenda</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus horários.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground font-medium italic">Carregando seus horários...</div>
          ) : agendamentos.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e Hora</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {format(new Date(item.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{item.profiles?.nome}</TableCell>
                    <TableCell>{item.modalidade}</TableCell>
                    <TableCell>
                      <Badge variant={statusMap[item.status]?.variant || "outline"}>
                        {statusMap[item.status]?.label || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.status === 'confirmado' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelingId(item.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Desmarcar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p>
          <strong>Política de Cancelamento:</strong> Cancelamentos devem ser realizados com antecedência. 
          Sessões desmarcadas no próprio dia do atendimento podem ser cobradas conforme o contrato do seu plano.
        </p>
      </div>

      <AlertDialog open={!!cancelingId} onOpenChange={(open) => !open && setCancelingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente desmarcar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Sua sessão será marcada como cancelada e o horário ficará disponível para outros pacientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => cancelingId && cancelMutation.mutate(cancelingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Processando..." : "Sim, desmarcar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MinhaAgenda;
