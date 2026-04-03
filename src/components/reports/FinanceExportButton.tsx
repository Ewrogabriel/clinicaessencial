import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

import { UnifiedPayment } from "@/types/database.types";
import { toast } from "sonner";

interface FinanceExportButtonProps {
  pagamentos: UnifiedPayment[];
}

const formaLabel: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

const statusLabel: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  cancelado: "Cancelado",
};

export const FinanceExportButton = ({ pagamentos }: FinanceExportButtonProps) => {
  const handleExport = () => {
    if (!pagamentos.length) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const rows = pagamentos.map((p) => ({
      "Paciente": p.paciente_nome || "—",
      "Valor (R$)": Number(p.valor).toFixed(2),
      "Data Pagamento": p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString("pt-BR") : "—",
      "Vencimento": p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString("pt-BR") : "—",
      "Status": statusLabel[p.status] || p.status,
      "Forma": formaLabel[p.forma_pagamento || ""] || p.forma_pagamento || "—",
      "Descrição": p.descricao || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    XLSX.writeFile(wb, `financeiro_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Relatório exportado com sucesso!");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" /> Exportar Excel
    </Button>
  );
};
