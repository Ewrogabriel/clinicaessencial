import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentTableHeader } from "./PaymentTableHeader";
import { PaymentTableRow } from "./PaymentTableRow";
import type { PaymentEntry } from "./types";

interface PaymentTableProps {
  payments: PaymentEntry[];
  allPaymentsCount: number;
  onSelectPayment: (payment: PaymentEntry) => void;
}

export function PaymentTable({ payments, allPaymentsCount, onSelectPayment }: PaymentTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Movimentações ({payments.length}{" "}
          {payments.length === 1 ? "registro" : "registros"})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {allPaymentsCount === 0
              ? "Nenhuma movimentação financeira encontrada para este paciente."
              : "Nenhum registro encontrado com os filtros aplicados."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <PaymentTableHeader />
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {payments.map((p) => (
                <PaymentTableRow
                  key={`${p.source_table}-${p.id}`}
                  payment={p}
                  onSelect={() => onSelectPayment(p)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
