import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, DollarSign } from "lucide-react";

const MeusPagamentos = () => {
  const { patientId } = useAuth();

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["patient-payments", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const statusMap: Record<string, { label: string; variant: "default" | "destructive" }> = {
    pago: { label: "Pago", variant: "default" },
    pendente: { label: "Pendente", variant: "destructive" },
  };

  const totalPago = pagamentos
    .filter((p: any) => p.status === 'pago')
    .reduce((acc: number, p: any) => acc + Number(p.valor), 0);

  const totalPendente = pagamentos
    .filter((p: any) => p.status === 'pendente')
    .reduce((acc: number, p: any) => acc + Number(p.valor), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Meus Pagamentos</h1>
        <p className="text-muted-foreground">Histórico de mensalidades e sessões avulsas.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Total Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">R$ {totalPago.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Total Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">R$ {totalPendente.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico Transacional</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground italic">Carregando histórico...</div>
          ) : pagamentos.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              Nenhum registro financeiro encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.descricao || "Sessão de Fisioterapia"}</TableCell>
                    <TableCell>R$ {Number(item.valor).toFixed(2)}</TableCell>
                    <TableCell>
                      {item.data_vencimento ? format(new Date(item.data_vencimento), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {item.data_pagamento ? format(new Date(item.data_pagamento), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusMap[item.status]?.variant || "outline"}>
                        {statusMap[item.status]?.label || item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MeusPagamentos;
