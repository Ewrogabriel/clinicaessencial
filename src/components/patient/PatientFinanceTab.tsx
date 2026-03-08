import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, QrCode, Receipt } from "lucide-react";

interface PatientFinanceTabProps {
  pendencias: any[];
  pagamentosMensalidade: any[];
  pagamentosSessoes: any[];
  formasPagamento: any[];
  configPixMap: Record<string, any>;
  matriculaPayments?: any[];
}

export const PatientFinanceTab = ({
  pendencias, pagamentosMensalidade, pagamentosSessoes,
  formasPagamento, configPixMap, matriculaPayments = []
}: PatientFinanceTabProps) => {
  return (
    <div className="space-y-4">
      {/* Matrícula Payments */}
      {matriculaPayments.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Mensalidades da Matrícula
            </CardTitle>
            <CardDescription>Acompanhe o status das suas mensalidades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {matriculaPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {format(new Date(p.mes_referencia + "T12:00:00"), "MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      R$ {Number(p.valor).toFixed(2)}
                      {p.data_pagamento && ` • Pago em ${format(new Date(p.data_pagamento), "dd/MM/yyyy")}`}
                    </p>
                  </div>
                  <Badge variant={
                    p.status === "pago" ? "default" :
                    p.status === "aberto" ? "destructive" : "outline"
                  }>
                    {p.status === "pago" ? "Pago" : p.status === "aberto" ? "Em Aberto" : p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pendências gerais */}
      {pendencias.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Pendências Financeiras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendencias.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{p.descricao || "Pagamento"}</p>
                    {p.data_vencimento && (
                      <p className="text-xs text-muted-foreground">
                        Vence em {format(new Date(p.data_vencimento), "dd/MM/yyyy")}
                      </p>
                    )}
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

      {/* Mensalidades + Sessões abertas com formas de pagamento */}
      {(pagamentosMensalidade.length > 0 || pagamentosSessoes.length > 0) && formasPagamento.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Formas de Pagamento
            </CardTitle>
            <CardDescription>Escolha como deseja realizar o pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pagamentosMensalidade.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Mensalidades em Aberto</h4>
                  <Badge variant="destructive">{pagamentosMensalidade.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pagamentosMensalidade.map((pag: any) => (
                    <div key={pag.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(pag.mes_referencia), "MMMM 'de' yyyy", { locale: ptBR })}</p>
                        <p className="text-sm text-muted-foreground">R$ {Number(pag.valor).toFixed(2)}</p>
                      </div>
                      <Badge variant="outline">Pendente</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pagamentosSessoes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Sessões em Aberto</h4>
                  <Badge variant="destructive">{pagamentosSessoes.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pagamentosSessoes.slice(0, 3).map((pag: any) => (
                    <div key={pag.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Sessão</p>
                        <p className="text-sm text-muted-foreground">R$ {Number(pag.valor).toFixed(2)}</p>
                      </div>
                      <Badge variant="outline">Pendente</Badge>
                    </div>
                  ))}
                  {pagamentosSessoes.length > 3 && (
                    <p className="text-xs text-muted-foreground">+ {pagamentosSessoes.length - 3} sessões pendentes</p>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-sm">Escolha uma forma de pagamento:</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {formasPagamento.map((forma: any) => {
                  const pixConfig = configPixMap[forma.id];
                  return (
                    <button key={forma.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-colors text-left">
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
                      <Button size="sm" className="w-full mt-3">
                        Pagar com {forma.nome}
                      </Button>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pendencias.length === 0 && pagamentosMensalidade.length === 0 && pagamentosSessoes.length === 0 && matriculaPayments.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Badge variant="outline" className="border-green-300 text-green-700 mb-2">Em dia</Badge>
            <p className="text-sm">Nenhuma pendência financeira.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
