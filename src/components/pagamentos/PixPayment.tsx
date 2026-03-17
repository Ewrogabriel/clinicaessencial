import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Copy, CheckCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface PixPaymentProps {
  valor: number;
  chavePix: string;
  nomeBeneficiario: string;
  onPay?: () => void;
}

export const PixPayment = ({ valor, chavePix, nomeBeneficiario, onPay }: PixPaymentProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(chavePix);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const openWhatsapp = () => {
    const mensagem = `Gostaria de pagar o agendamento com PIX. Valor: R$ ${valor.toFixed(2)}`;
    const link = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(link, "_blank");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Pagamento com PIX</CardTitle>
        <CardDescription>Escolha a forma de pagamento que preferir</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chave" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chave">Chave PIX</TabsTrigger>
            <TabsTrigger value="qrcode">QR Code</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          {/* Chave PIX */}
          <TabsContent value="chave" className="space-y-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <div className="text-2xl font-bold text-green-600">
                R$ {valor.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Beneficiário</Label>
              <div className="p-3 bg-gray-100 rounded-lg">{nomeBeneficiario}</div>
            </div>

            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <div className="flex gap-2">
                <Input value={chavePix} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={onPay}>
              Confirmar Pagamento
            </Button>
          </TabsContent>

          {/* QR Code */}
          <TabsContent value="qrcode" className="space-y-4 text-center">
            <div className="flex justify-center p-8 bg-gray-100 rounded-lg">
              <QrCode className="w-32 h-32 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">
              Escaneie o QR Code com seu telefone para pagar
            </p>
            <p className="text-2xl font-bold text-green-600">
              R$ {valor.toFixed(2)}
            </p>
            <Button className="w-full" onClick={onPay}>
              Confirmar Pagamento
            </Button>
          </TabsContent>

          {/* WhatsApp */}
          <TabsContent value="whatsapp" className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
              <p className="font-semibold text-blue-900">Pagar via WhatsApp</p>
              <p className="text-sm text-blue-700">
                Clique no botão abaixo para enviar uma mensagem ao profissional
              </p>
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={openWhatsapp}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Enviar pelo WhatsApp
            </Button>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-mono text-gray-600">
                Valor: R$ {valor.toFixed(2)}
              </p>
              <p className="text-sm font-mono text-gray-600">
                Chave PIX: {chavePix}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
