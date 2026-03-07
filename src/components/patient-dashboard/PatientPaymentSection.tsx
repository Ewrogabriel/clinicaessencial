import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, QrCode } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientPaymentSectionProps {
  pagamentosMensalidade: any[];
  pagamentosSessoes: any[];
  formasPagamento: any[];
  configPixMap: Record<string, any>;
}

export function PatientPaymentSection({
  pagamentosMensalidade,
  pagamentosSessoes,
  formasPagamento,
  configPixMap,
}: PatientPaymentSectionProps) {
  if ((pagamentosMensalidade.length === 0 && pagamentosSessoes.length === 0) || formasPagamento.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-orange-600" />
          Formas de Pagamento
        </CardTitle>
        <CardDescription>Escolha como deseja realizar o pagamento de sua mensalidade ou sessões abertas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mensalidades em Aberto */}
        {pagamentosMensalidade.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Mensalidades em Aberto</h4>
              <Badge variant="destructive">{pagamentosMensalidade.length}</Badge>
            </div>
            <div className="space-y-2">
              {pagamentosMensalidade.map((pag: any) => (
                <div key={pag.id} className="p-3 rounded-lg border bg-white flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(pag.mes_referencia), "MMMM 'de' yyyy", { locale: ptBR })}</p>
                    <p className="text-sm text-muted-foreground">R$ {Number(pag.valor).toFixed(2)}</p>
                  </div>
                  <Badge variant="outline" className="ml-2">Pendente</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessões em Aberto */}
        {pagamentosSessoes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Sessões em Aberto</h4>
              <Badge variant="destructive">{pagamentosSessoes.length}</Badge>
            </div>
            <div className="space-y-2">
              {pagamentosSessoes.slice(0, 3).map((pag: any) => (
                <div key={pag.id} className="p-3 rounded-lg border bg-white flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sessão</p>
                    <p className="text-sm text-muted-foreground">R$ {Number(pag.valor).toFixed(2)}</p>
                  </div>
                  <Badge variant="outline" className="ml-2">Pendente</Badge>
                </div>
              ))}
              {pagamentosSessoes.length > 3 && (
                <p className="text-xs text-muted-foreground">+ {pagamentosSessoes.length - 3} sessões pendentes</p>
              )}
            </div>
          </div>
        )}

        {/* Formas de Pagamento Disponíveis */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-semibold text-sm">Escolha uma forma de pagamento:</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {formasPagamento.map((forma: any) => {
              const pixConfig = configPixMap[forma.id];
              return (
                <button
                  key={forma.id}
                  className="p-4 rounded-lg border border-orange-200 bg-white hover:bg-orange-50 hover:border-orange-400 transition-colors text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-semibold text-sm">{forma.nome}</h5>
                    {forma.tipo === "pix" && <QrCode className="h-4 w-4 text-orange-600" />}
                  </div>
                  {forma.descricao && <p className="text-xs text-muted-foreground mb-2">{forma.descricao}</p>}
                  
                  {/* PIX Details */}
                  {forma.tipo === "pix" && pixConfig && (
                    <div className="bg-blue-50 rounded p-2 text-xs space-y-1">
                      <p className="text-blue-900"><strong>Chave PIX:</strong> {pixConfig.chave_pix}</p>
                      <p className="text-blue-900"><strong>Beneficiário:</strong> {pixConfig.nome_beneficiario}</p>
                    </div>
                  )}
                  
                  <Button size="sm" className="w-full mt-3 bg-orange-600 hover:bg-orange-700">
                    Pagar com {forma.nome}
                  </Button>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
