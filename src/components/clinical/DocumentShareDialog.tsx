import { useState } from "react";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, MessageCircle, Smartphone, QrCode, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
  pacienteNome: string;
}

const DocumentShareDialog = ({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  pacienteNome,
}: DocumentShareDialogProps) => {
  const [copied, setCopied] = useState(false);

  const verifyUrl = `${window.location.origin}/verificar-documento/${documentId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      toast.success("Link copiado com sucesso!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Olá ${pacienteNome}! Segue o link para acessar e verificar seu documento "${documentTitle}":\n\n${verifyUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleSMS = () => {
    const msg = encodeURIComponent(
      `Seu documento "${documentTitle}" está disponível: ${verifyUrl}`
    );
    window.open(`sms:?body=${msg}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="document-share-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Document info */}
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="font-medium">{documentTitle}</p>
            <p className="text-muted-foreground text-xs mt-0.5">Paciente: {pacienteNome}</p>
          </div>

          {/* Share link */}
          <div data-testid="share-link-section">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
              Link de verificação
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={verifyUrl}
                className="text-xs"
                data-testid="share-link-input"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
                data-testid="copy-link-btn"
                title="Copiar link"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Send options */}
          <div data-testid="send-options-section">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
              Enviar para o paciente
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                onClick={handleWhatsApp}
                data-testid="share-whatsapp-btn"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                onClick={handleSMS}
                data-testid="share-sms-btn"
              >
                <Smartphone className="h-4 w-4" />
                SMS
              </Button>
            </div>
          </div>

          <Separator />

          {/* QR Code */}
          <div data-testid="qrcode-section">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block flex items-center gap-1">
              <QrCode className="h-3.5 w-3.5" /> QR Code de verificação
            </Label>
            <div className="flex flex-col items-center gap-2">
              <div
                className="bg-white p-4 rounded-xl border shadow-sm"
                data-testid="qrcode-container"
              >
                <QRCode
                  value={verifyUrl}
                  size={160}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox="0 0 256 256"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Escaneie o código para verificar a autenticidade do documento
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentShareDialog;
