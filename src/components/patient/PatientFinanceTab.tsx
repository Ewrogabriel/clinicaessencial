import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, QrCode, Receipt, FileDown, CheckCircle2, Clock, XCircle } from "lucide-react";
import { generateReceiptPDF } from "@/lib/generateReceiptPDF";
import { toast } from "@/hooks/use-toast";

interface PatientFinanceTabProps {
  pendencias: any[];
  pagamentosMensalidade: any[];
  pagamentosSessoes: any[];
  formasPagamento: any[];
  configPixMap: Record<string, any>;
  matriculaPayments?: any[];
  pacienteNome?: string;
  pacienteCpf?: string;
}

const statusIcon = (status: string) => {
  if (status === "pago") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "aberto" || status === "pendente") return <Clock className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-muted-foreground" />;
};

const statusBadge = (status: string) => {
  if (status === "pago") return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
  if (status === "aberto" || status === "pendente") return <Badge variant="destructive">Pendente</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export const PatientFinanceTab = ({
  pendencias, pagamentosMensalidade, pagamentosSessoes,
  formasPagamento, configPixMap, matriculaPayments = [],
  pacienteNome = "", pacienteCpf = ""
}: PatientFinanceTabProps) => {

  const handleReceipt = async (payment: any, tipo: "mensalidade" | "sessao") => {
    try {
      const ref = tipo === "mensalidade" && payment.mes_referencia
        ? format(new Date(payment.mes_referencia + "T12:00:00"), "MMMM/yyyy", { locale: ptBR })
        : "Sessão";
      const pdf = await generateReceiptPDF({
        numero: payment.id.slice(0, 8).toUpperCase(),
        pacienteNome,
        cpf: pacienteCpf,
        descricao: tipo === "mensalidade" ? `Mensalidade ${ref}` : "Pagamento de sessão",
        valor: Number(payment.valor),
        formaPagamento: payment.forma_pagamento_id ? "PIX" : "—",
        dataPagamento: payment.data_pagamento
          ? format(new Date(payment.data_pagamento), "dd/MM/yyyy")
          : format(new Date(), "dd/MM/yyyy"),
        referencia: ref,
      });
      pdf.save(`Recibo_${ref.replace(/\s/g, "_")}.pdf`);
      toast({ title: "Recibo gerado!" });
    } catch {
      toast({ title: "Erro ao gerar recibo", variant: "destructive" });
    }
  };

  const mensalidadesPagas = pagamentosMensalidade.filter((p: any) => p.status === "pago");
  const mensalidadesAbertas = pagamentosMensalidade.filter((p: any) => p.status !== "pago");
  const sessoesPagas = pagamentosSessoes.filter((p: any) => p.status === "pago");
  const sessoesAbertas = pagamentosSessoes.filter((p: any) => p.status !== "pago");

  const hasAnyPayment = pagamentosMensalidade.length > 0 || pagamentosSessoes.length > 0 || pendencias.length > 0;

  return (
    <div className="space-y-4">
      {/* All Mensalidade Payments */}
      {pagamentosMensalidade.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Mensalidades
            </CardTitle>
            <CardDescription>Histórico completo das mensalidades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pagamentosMensalidade.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {statusIcon(p.status)}
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {format(new Date(p.mes_referencia + "T12:00:00"), "MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(p.valor).toFixed(2)}
                        {p.data_pagamento && ` • Pago em ${format(new Date(p.data_pagamento), "dd/MM/yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(p.status)}
                    {p.status === "pago" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Gerar recibo"
                        onClick={() => handleReceipt(p, "mensalidade")}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Session Payments */}
      {pagamentosSessoes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Pagamentos de Sessões
            </CardTitle>
            <CardDescription>Histórico de pagamentos por sessão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pagamentosSessoes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {statusIcon(p.status)}
                    <div>
                      <p className="text-sm font-medium">Sessão</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(p.valor).toFixed(2)}
                        {p.data_pagamento && ` • Pago em ${format(new Date(p.data_pagamento), "dd/MM/yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(p.status)}
                    {p.status === "pago" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Gerar recibo"
                        onClick={() => handleReceipt(p, "sessao")}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pendências gerais (pagamentos table) */}
      {pendencias.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Outras Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendencias.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{p.descricao || "Pagamento"}</p>
                      {p.data_vencimento && (
                        <p className="text-xs text-muted-foreground">
                          Vence em {format(new Date(p.data_vencimento), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-bold">R$ {Number(p.valor).toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 border-t text-right">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="font-bold text-destructive">
                  R$ {pendencias.reduce((s: number, p: any) => s + Number(p.valor), 0).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment methods - only show if there are open payments */}
      {(mensalidadesAbertas.length > 0 || sessoesAbertas.length > 0 || pendencias.length > 0) && formasPagamento.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Formas de Pagamento
            </CardTitle>
            <CardDescription>Escolha como deseja realizar o pagamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {formasPagamento.map((forma: any) => {
                const pixConfig = configPixMap[forma.id];
                return (
                  <div key={forma.id}
                    className="p-4 rounded-lg border bg-card text-left">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-semibold text-sm">{forma.nome}</h5>
                      {forma.tipo === "pix" && <QrCode className="h-4 w-4 text-primary" />}
                    </div>
                    {forma.descricao && <p className="text-xs text-muted-foreground mb-2">{forma.descricao}</p>}
                    {forma.tipo === "pix" && pixConfig && (
                      <div className="bg-muted rounded p-2 text-xs space-y-1">
                        <p><strong>Chave PIX:</strong> {pixConfig.chave_pix}</p>
                        <p><strong>Beneficiário:</strong> {pixConfig.nome_beneficiario}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasAnyPayment && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Badge variant="outline" className="border-green-300 text-green-700 mb-2">Em dia</Badge>
            <p className="text-sm">Nenhum registro financeiro.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
