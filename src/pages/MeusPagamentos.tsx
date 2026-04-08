import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { generateReceiptPDF, getReceiptNumber } from "@/lib/generateReceiptPDF";
import { toast } from "sonner";

interface UnifiedPatientPayment {
  id: string;
  valor: number;
  status: string;
  descricao: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  created_at: string;
  source_table: string;
}

const MeusPagamentos = () => {
  const { patientId } = useAuth();

  // Unified query: fetch from all 3 payment tables
  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["patient-payments-unified", patientId],
    queryFn: async (): Promise<UnifiedPatientPayment[]> => {
      if (!patientId) return [];
      const results: UnifiedPatientPayment[] = [];

      // 1. pagamentos (manual/plano)
      const { data: pgtos } = await supabase
        .from("pagamentos")
        .select("id, valor, status, descricao, data_vencimento, data_pagamento, forma_pagamento, created_at")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });

      (pgtos || []).forEach((p) => {
        results.push({
          id: p.id,
          valor: Number(p.valor),
          status: p.status,
          descricao: p.descricao || "Pagamento",
          data_vencimento: p.data_vencimento,
          data_pagamento: p.data_pagamento,
          forma_pagamento: p.forma_pagamento,
          created_at: p.created_at,
          source_table: "pagamentos",
        });
      });

      // 2. pagamentos_mensalidade
      const { data: mensalidades } = await supabase
        .from("pagamentos_mensalidade")
        .select("id, valor, status, mes_referencia, data_vencimento, data_pagamento, observacoes, created_at")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });

      (mensalidades || []).forEach((m) => {
        const mesLabel = m.mes_referencia
          ? format(new Date(m.mes_referencia + "T12:00:00"), "MMMM/yyyy", { locale: ptBR })
          : "";
        results.push({
          id: m.id,
          valor: Number(m.valor),
          status: m.status ?? "pendente",
          descricao: `Mensalidade${mesLabel ? " - " + mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1) : ""}`,
          data_vencimento: m.data_vencimento ?? m.mes_referencia,
          data_pagamento: m.data_pagamento,
          forma_pagamento: null,
          created_at: m.created_at ?? "",
          source_table: "pagamentos_mensalidade",
        });
      });

      // 3. pagamentos_sessoes (sessões avulsas)
      const { data: sessoes } = await supabase
        .from("pagamentos_sessoes")
        .select("id, valor, status, data_pagamento, observacoes, created_at")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });

      (sessoes || []).forEach((s) => {
        results.push({
          id: s.id,
          valor: Number(s.valor),
          status: s.status ?? "pendente",
          descricao: s.observacoes || "Sessão avulsa",
          data_vencimento: s.data_pagamento,
          data_pagamento: s.status === "pago" ? s.data_pagamento : null,
          forma_pagamento: null,
          created_at: s.created_at ?? "",
          source_table: "pagamentos_sessoes",
        });
      });

      // Compute overdue status locally
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      results.forEach((r) => {
        if (r.status === "pendente" && r.data_vencimento) {
          const venc = new Date(r.data_vencimento);
          venc.setHours(0, 0, 0, 0);
          if (venc < today) r.status = "vencido";
        }
      });

      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  // Fetch NF emissions for this patient
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

  const statusMap: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    pago: { label: "Pago", variant: "default" },
    pendente: { label: "Pendente", variant: "destructive" },
    cancelado: { label: "Cancelado", variant: "outline" },
    reembolsado: { label: "Reembolsado", variant: "secondary" },
    vencido: { label: "Vencido", variant: "destructive" },
    aberto: { label: "Aberto", variant: "destructive" },
  };

  const totalPago = pagamentos
    .filter((p) => p.status === "pago")
    .reduce((acc, p) => acc + p.valor, 0);

  const totalPendente = pagamentos
    .filter((p) => p.status === "pendente" || p.status === "vencido" || p.status === "aberto")
    .reduce((acc, p) => acc + p.valor, 0);

  const handleDownloadReceipt = async (pagamento: UnifiedPatientPayment) => {
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
      valor: pagamento.valor,
      formaPagamento: pagamento.forma_pagamento || "",
      dataPagamento: dataPgto,
      referencia: ref.charAt(0).toUpperCase() + ref.slice(1),
    });
    pdf.save(`Recibo_${numero}.pdf`);
    toast.success("Recibo baixado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Meus Pagamentos</h1>
        <p className="text-muted-foreground">Histórico de mensalidades, planos e sessões avulsas.</p>
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
                {pagamentos.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.descricao}</TableCell>
                    <TableCell>R$ {item.valor.toFixed(2)}</TableCell>
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
