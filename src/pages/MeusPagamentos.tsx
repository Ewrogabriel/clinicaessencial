import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { generateReceiptPDF, getReceiptNumber } from "@/lib/generateReceiptPDF";
import { toast } from "@/hooks/use-toast";

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

  const { data: paciente } = useQuery({
    queryKey: ["paciente-self-receipt", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await supabase
        .from("pacientes")
        .select("nome, cpf")
        .eq("id", patientId)
        .single() as any;
      return data;
    },
    enabled: !!patientId,
  });

  // Fetch NF emissions for this patient (with PDF URLs)
  const { data: emissoes = [] } = useQuery({
    queryKey: ["patient-emissoes-nf", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase.from("emissoes_nf") as any)
        .select("*")
        .eq("paciente_id", patientId)
        .eq("emitida", true)
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data || [];
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

  const handleDownloadReceipt = async (pagamento: any) => {
    const numero = getReceiptNumber(pagamento.id, pagamento.created_at);
    const dataPgto = pagamento.data_pagamento
      ? format(new Date(pagamento.data_pagamento), "dd/MM/yyyy")
      : format(new Date(), "dd/MM/yyyy");

    const ref = pagamento.data_vencimento
      ? format(new Date(pagamento.data_vencimento), "MMMM/yyyy", { locale: ptBR })
      : pagamento.descricao || "Serviço";

    const pdf = await generateReceiptPDF({
      numero,
      pacienteNome: paciente?.nome || "—",
      cpf: paciente?.cpf || "",
      descricao: pagamento.descricao || "Serviço de Pilates/Fisioterapia",
      valor: Number(pagamento.valor),
      formaPagamento: pagamento.forma_pagamento || "",
      dataPagamento: dataPgto,
      referencia: ref.charAt(0).toUpperCase() + ref.slice(1),
    });
    pdf.save(`Recibo_${numero}.pdf`);
    toast({ title: "Recibo baixado com sucesso!" });
  };

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
                  <TableHead className="text-right">Recibo</TableHead>
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
                    <TableCell className="text-right">
                      {item.status === "pago" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => handleDownloadReceipt(item)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> PDF
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

      {/* Notas Fiscais emitidas */}
      {emissoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Minhas Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Emitida em</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emissoes.map((nf: any) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-medium capitalize">
                      {format(new Date(nf.mes_referencia), "MMMM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>R$ {Number(nf.valor).toFixed(2)}</TableCell>
                    <TableCell>
                      {nf.emitida_em ? format(new Date(nf.emitida_em), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {nf.nf_pdf_url ? (
                        <a href={nf.nf_pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8">
                            <Download className="h-3.5 w-3.5 mr-1" /> NF PDF
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">PDF não disponível</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeusPagamentos;
