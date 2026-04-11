import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, DollarSign, ExternalLink, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export const CommissionAudit = () => {
  const navigate = useNavigate();

  const { data: anomalies = [], isLoading } = useQuery({
    queryKey: ["commission-audit"],
    queryFn: async () => {
      // Find sessions that are 'realizado' but payments are not 'pago'
      // We check for both individual payments and monthly payments (simplified check)
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          id,
          data_horario,
          status,
          tipo_atendimento,
          valor_sessao,
          paciente_id,
          profissional_id,
          pacientes(nome),
          profiles:profissional_id(nome),
          pagamentos(status),
          enrollment_id
        `)
        .eq("status", "realizado")
        .order("data_horario", { ascending: false });

      if (error) throw error;

      // Filter localy for performance and logic clarity
      return (data || []).filter(a => {
        // If avulsa (no enrollment), must have a paid record in 'pagamentos'
        if (!a.enrollment_id) {
          const hasPaid = (a.pagamentos as any[])?.some(p => p.status === "pago");
          return !hasPaid;
        }
        
        // If enrollment, we'd need to check monthly payments, 
        // but for now let's flag all that don't have a linked paid row as 'potentially pending'
        // or just focus on the most obvious discrepancies.
        const hasPaid = (a.pagamentos as any[])?.some(p => p.status === "pago");
        return !hasPaid;
      });
    }
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse">Analisando agendamentos...</div>;

  return (
    <Card className="border-amber-200 bg-amber-50/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">Auditoria de Recebimento</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Agendamentos marcados como <strong>Realizados</strong>, mas que não possuem confirmação de pagamento vinculada. 
          Sem o pagamento, a comissão do profissional permanece bloqueada.
        </p>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            🎉 Tudo em dia! Todos os agendamentos realizados possuem pagamentos vinculados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">
                      {format(new Date(a.data_horario), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium text-xs">
                      {a.pacientes?.nome || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.profiles?.nome || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {a.enrollment_id ? "Matrícula" : "Avulsa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      R$ {Number(a.valor_sessao || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7" 
                          onClick={() => navigate(`/financeiro?search=${a.pacientes?.nome}`)}
                          title="Ver no Financeiro"
                        >
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7" 
                          onClick={() => navigate(`/pacientes/${a.paciente_id}/detalhes?tab=atendimentos`)}
                          title="Ver Paciente"
                        >
                          <User className="h-4 w-4 text-blue-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
