import { useState } from "react";
import { Download, FileText, Table, FileJson } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportingService } from "@/modules/finance/services/reportingService";
import { toast } from "sonner";
interface ExportModalProps {
  open: boolean;
  clinicId: string;
  onClose: () => void;
}

export function ExportModal({ open, clinicId, onClose }: ExportModalProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("todos");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "csv" | "json") => {
    if (!clinicId) return;
    try {
      setIsExporting(true);
      const report = await reportingService.generateReport(clinicId, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: status !== "todos" ? status : undefined,
      });

      const dateLabel = `${dateFrom || "inicio"}_${dateTo || "fim"}`;

      if (format === "csv") {
        const csv = reportingService.exportCSV(report);
        reportingService.downloadFile(
          csv,
          `conciliacao_${dateLabel}.csv`,
          "text/csv;charset=utf-8;"
        );
      } else {
        const json = reportingService.exportJSON(report);
        reportingService.downloadFile(
          json,
          `conciliacao_${dateLabel}.json`,
          "application/json"
        );
      }

      toast({
        title: "✓ Exportação concluída",
        description: `${report.rows.length} transações exportadas`,
      });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Relatório</DialogTitle>
          <DialogDescription>
            Selecione o período e formato de exportação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="conciliado">Conciliados</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="rejeitado">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 space-y-2">
            <Label className="text-sm font-medium">Formato de exportação</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport("csv")}
                disabled={isExporting}
                className="gap-2"
              >
                <Table className="h-4 w-4" />
                CSV / Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("json")}
                disabled={isExporting}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
