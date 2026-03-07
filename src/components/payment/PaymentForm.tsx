import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Copy, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PaymentFormProps {
  tipo: "mensalidade" | "sessao";
  items: any[];
  formasPagamento: any[];
  configPix: Record<string, any>;
  onPaymentComplete?: () => void;
}

export const PaymentForm = ({
  tipo,
  items,
  formasPagamento,
  configPix,
  onPaymentComplete
}: PaymentFormProps) => {
  const [selectedForma, setSelectedForma] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const totalValor = items
    .filter(item => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + Number(item.valor), 0);

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handlePaymentSubmit = () => {
    if (!selectedForma) {
      toast({ title: "Erro", description: "Selecione uma forma de pagamento", variant: "destructive" });
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um item", variant: "destructive" });
      return;
    }

    const forma = formasPagamento.find(f => f.id === selectedForma);
    
    // Handle different payment methods
    if (forma.tipo === "pix") {
      const pixData = configPix[selectedForma];
      if (!pixData) {
        toast({ title: "Erro", description: "Dados PIX não configurados", variant: "destructive" });
        return;
      }
      // Copy PIX key to clipboard
      navigator.clipboard.writeText(pixData.chave_pix);
      toast({ title: "PIX copiado para clipboard!" });
    }

    // Log payment intent (in real app, this would integrate with payment gateway)
    console.log("[v0] Payment Intent:", {
      tipo,
      forma: forma.nome,
      items: selectedItems,
      total: totalValor
    });

    toast({ title: "Instrções de pagamento enviadas!", description: "Verifique seu email para mais detalhes." });
    onPaymentComplete?.();
  };

  return (
    <div className="space-y-6">
      {/* Alert - Dados Temporários */}
      <div className="flex gap-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Instrução Importante</p>
          <p>Este formulário é para solicitação de pagamento. Após confirmar, você receberá as instruções de pagamento via email ou WhatsApp.</p>
        </div>
      </div>

      {/* Seleção de Itens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione o que deseja pagar</CardTitle>
          <CardDescription>
            {tipo === "mensalidade" ? "Selecione as mensalidades em aberto" : "Selecione as sessões pendentes"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select All */}
          <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted">
            <input
              type="checkbox"
              checked={selectedItems.length === items.length && items.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">Selecionar Todos</p>
            </div>
            <p className="text-sm font-bold">R$ {items.reduce((sum, item) => sum + Number(item.valor), 0).toFixed(2)}</p>
          </label>

          {/* Individual Items */}
          {items.map((item: any) => (
            <label key={item.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted">
              <input
                type="checkbox"
                checked={selectedItems.includes(item.id)}
                onChange={() => handleSelectItem(item.id)}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {tipo === "mensalidade" ? new Date(item.mes_referencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : "Sessão"}
                </p>
                {item.observacoes && <p className="text-xs text-muted-foreground">{item.observacoes}</p>}
              </div>
              <p className="text-sm font-bold">R$ {Number(item.valor).toFixed(2)}</p>
            </label>
          ))}

          {/* Total */}
          {selectedItems.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Total a Pagar</p>
              <p className="text-2xl font-bold">R$ {totalValor.toFixed(2)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formas de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione a forma de pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {formasPagamento.map((forma: any) => {
              const pixData = configPix[forma.id];
              return (
                <button
                  key={forma.id}
                  onClick={() => setSelectedForma(forma.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedForma === forma.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedForma === forma.id ? "bg-primary border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {selectedForma === forma.id && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <h5 className="font-semibold text-sm">{forma.nome}</h5>
                  </div>

                  {forma.descricao && <p className="text-xs text-muted-foreground mb-2">{forma.descricao}</p>}

                  {/* PIX Details */}
                  {forma.tipo === "pix" && pixData && selectedForma === forma.id && (
                    <div className="mt-3 space-y-2 p-2 rounded bg-blue-50 border border-blue-200">
                      <div className="flex items-start gap-2">
                        <QrCode className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-blue-900">Chave PIX:</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-white p-1 rounded flex-1 text-blue-900">{pixData.chave_pix}</code>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(pixData.chave_pix);
                                toast({ title: "Copiado!" });
                              }}
                              className="p-1 hover:bg-blue-200 rounded"
                            >
                              <Copy className="h-3 w-3 text-blue-600" />
                            </button>
                          </div>
                          <p className="text-xs text-blue-800 mt-1">Beneficiário: {pixData.nome_beneficiario}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {forma.tipo === "pix" && !pixData && (
                    <Badge variant="outline" className="text-xs">PIX não configurado</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handlePaymentSubmit}
          disabled={selectedItems.length === 0 || !selectedForma}
          className="flex-1 bg-primary"
        >
          Confirmar Pagamento
        </Button>
      </div>
    </div>
  );
};

export default PaymentForm;
