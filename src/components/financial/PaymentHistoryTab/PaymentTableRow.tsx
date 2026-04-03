import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dateFormats } from "@/modules/shared/utils/dateFormatters";
import { formatBRL } from "@/modules/shared/utils/currencyFormatters";
import { getMovimentacaoTipo, labelStatus } from "@/modules/finance/utils/paymentHelpers";
import { ReconciliationBadge } from "./ReconciliationBadge";
import type { PaymentEntry } from "./types";

interface PaymentTableRowProps {
  payment: PaymentEntry;
  onSelect: () => void;
}

export function PaymentTableRow({ payment: p, onSelect }: PaymentTableRowProps) {
  const dateStr = p.data_pagamento || p.data_vencimento || p.created_at;
  const { tipo, cor } = getMovimentacaoTipo(p.valor, p.status);
  const statusInfo = labelStatus[p.status] ?? { label: p.status, variant: "secondary" as const };

  return (
    <div
      key={`${p.source_table}-${p.id}`}
      className="grid grid-cols-1 md:grid-cols-[140px_1fr_80px_120px_110px_160px_32px] gap-2 px-4 py-3 items-center hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      {/* Data */}
      <div className="text-sm">
        <span className="md:hidden text-xs text-muted-foreground font-medium mr-1">Data:</span>
        {dateStr ? dateFormats.full(dateStr) : "—"}
      </div>

      {/* Descrição */}
      <div className="space-y-0.5">
        <p className="text-sm font-medium truncate">{p.descricao}</p>
        <Badge variant={statusInfo.variant} className="text-[10px] h-4 px-1.5">
          {statusInfo.label}
        </Badge>
      </div>

      {/* Tipo */}
      <div className={`text-sm font-medium ${cor} hidden md:block`}>{tipo}</div>

      {/* Forma de Pagamento */}
      <div className="text-sm text-muted-foreground hidden md:block truncate">
        {p.forma_pagamento || "—"}
      </div>

      {/* Valor */}
      <div className={`text-sm font-semibold text-right ${cor}`}>
        <span className="md:hidden text-xs text-muted-foreground font-normal mr-1">Valor: </span>
        {tipo === "Débito" ? "-" : "+"}
        {formatBRL(Math.abs(p.valor))}
      </div>

      {/* Conciliação */}
      <div className="hidden md:flex">
        <ReconciliationBadge
          bankStatus={p.bank_status}
          dataConciliacao={p.bank_data_conciliacao}
        />
      </div>

      {/* Expand icon */}
      <div className="hidden md:flex items-center justify-center text-muted-foreground">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  );
}
