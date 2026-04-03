import { AlertTriangle, User, Download, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateFormats } from "@/modules/shared/utils/dateFormatters";
import { formatBRL } from "@/modules/shared/utils/currencyFormatters";
import {
  getMovimentacaoTipo,
  labelOrigem,
  labelStatus,
} from "@/modules/finance/utils/paymentHelpers";
import { ReconciliationBadge } from "./ReconciliationBadge";
import { generateReceiptPDF, getReceiptNumber } from "@/lib/generateReceiptPDF";
import { toast } from "sonner";
import type { PaymentEntry } from "./types";

interface PaymentDetailModalProps {
  payment: PaymentEntry;
  pacienteNome: string;
  pacienteCpf?: string;
  onClose: () => void;
}

export function PaymentDetailModal({ payment, pacienteNome, pacienteCpf = "", onClose }: PaymentDetailModalProps) {
  const dateStr = payment.data_pagamento || payment.data_vencimento || payment.created_at;
  const { tipo, cor } = getMovimentacaoTipo(payment.valor, payment.status);
  const statusInfo = labelStatus[payment.status] ?? {
    label: payment.status,
    variant: "secondary" as const,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Detalhes do Pagamento</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* ID */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">ID</p>
              <p className="font-mono text-xs truncate">{payment.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Tipo</p>
              <p className={`font-semibold ${cor}`}>{tipo}</p>
            </div>
          </div>

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Data</p>
              <p>{dateStr ? dateFormats.full(dateStr) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Status
              </p>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
          </div>

          {/* Atraso */}
          {payment.dias_atraso !== undefined && payment.dias_atraso > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                Atrasado há {payment.dias_atraso}{" "}
                {payment.dias_atraso === 1 ? "dia" : "dias"}
              </span>
              {payment.data_vencimento && (
                <span className="text-xs text-red-500 ml-auto">
                  Venc.: {dateFormats.date(payment.data_vencimento)}
                </span>
              )}
            </div>
          )}

          {/* Origem + Forma */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Origem
              </p>
              <p>{labelOrigem[payment.origem_tipo] ?? payment.origem_tipo}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Forma de Pagamento
              </p>
              <p>{payment.forma_pagamento || "—"}</p>
            </div>
          </div>

          {/* Profissional (if session) */}
          {payment.profissional && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Profissional
              </p>
              <p className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {payment.profissional}
              </p>
            </div>
          )}

          {/* Mês referência */}
          {payment.mes_referencia && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Mês de Referência
              </p>
              <p>{payment.mes_referencia}</p>
            </div>
          )}

          {/* Descrição */}
          <div>
            <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
              Descrição
            </p>
            <p>{payment.descricao || "—"}</p>
          </div>

          {/* Valor */}
          <div className="p-3 rounded-lg bg-muted/40">
            <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Valor</p>
            <p className={`text-xl font-bold ${cor}`}>
              {tipo === "Débito" ? "-" : "+"}
              {formatBRL(Math.abs(payment.valor))}
            </p>
          </div>

          {/* Data de vencimento */}
          {payment.data_vencimento && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Data de Vencimento
              </p>
              <p>{dateFormats.date(payment.data_vencimento)}</p>
            </div>
          )}

          {/* Reconciliação bancária */}
          <div>
            <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">
              Conciliação Bancária
            </p>
            <ReconciliationBadge
              bankStatus={payment.bank_status}
              dataConciliacao={payment.bank_data_conciliacao}
            />
          </div>

          {/* Observações */}
          {payment.observacoes && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">
                Observações
              </p>
              <p className="text-muted-foreground">{payment.observacoes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2 gap-2">
          <div className="flex gap-2">
            {payment.status === "pago" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    const numero = getReceiptNumber(payment.id, payment.created_at);
                    const dateStr2 = payment.data_pagamento || payment.created_at;
                    const dataPgto = dateStr2 ? dateFormats.date(dateStr2) : "—";
                    const pdf = await generateReceiptPDF({
                      numero,
                      pacienteNome,
                      cpf: pacienteCpf,
                      descricao: payment.descricao || "Serviço",
                      valor: Math.abs(payment.valor),
                      formaPagamento: payment.forma_pagamento || "",
                      dataPagamento: dataPgto,
                      referencia: payment.descricao || "Serviço",
                    });
                    pdf.save(`Recibo_${numero}.pdf`);
                    toast.success("Recibo gerado!");
                  }}
                >
                  <Download className="h-4 w-4" />
                  Baixar Recibo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    const numero = getReceiptNumber(payment.id, payment.created_at);
                    const dateStr2 = payment.data_pagamento || payment.created_at;
                    const dataPgto = dateStr2 ? dateFormats.date(dateStr2) : "—";
                    const pdf = await generateReceiptPDF({
                      numero,
                      pacienteNome,
                      cpf: "",
                      descricao: payment.descricao || "Serviço",
                      valor: Math.abs(payment.valor),
                      formaPagamento: payment.forma_pagamento || "",
                      dataPagamento: dataPgto,
                      referencia: payment.descricao || "Serviço",
                    });
                    const blob = pdf.output("blob");
                    const url = URL.createObjectURL(blob);

                    // Try Web Share API for mobile
                    if (navigator.share && navigator.canShare) {
                      try {
                        const file = new File([blob], `Recibo_${numero}.pdf`, { type: "application/pdf" });
                        await navigator.share({ title: `Recibo ${numero}`, files: [file] });
                        toast.success("Recibo enviado!");
                        return;
                      } catch {}
                    }
                    // Fallback: open WhatsApp with text
                    const text = encodeURIComponent(`Segue o recibo nº ${numero} no valor de R$ ${Math.abs(payment.valor).toFixed(2)}.`);
                    window.open(`https://wa.me/?text=${text}`, "_blank");
                    // Also download so user can attach
                    pdf.save(`Recibo_${numero}.pdf`);
                    toast.info("Recibo baixado. Anexe manualmente no WhatsApp.");
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Send className="h-4 w-4" />
                  Enviar Recibo
                </Button>
              </>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
