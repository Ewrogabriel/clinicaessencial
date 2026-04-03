import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Upload, Download, History, Settings, Banknote } from "lucide-react";

interface ConciliacaoHeaderProps {
  isRunningAutoReconcile: boolean;
  isAutoMatching: boolean;
  unreconciledCount: number;
  onAutoReconcile: () => void;
  onAutoMatch: () => void;
  onImport: () => void;
  onExport: () => void;
  onAuditTrail: () => void;
  onSettings: () => void;
  onNewBankAccount: () => void;
}

export function ConciliacaoHeader({
  isRunningAutoReconcile, isAutoMatching, unreconciledCount,
  onAutoReconcile, onAutoMatch, onImport, onExport, onAuditTrail, onSettings, onNewBankAccount,
}: ConciliacaoHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conciliação Bancária</h1>
        <p className="text-muted-foreground mt-1">Gerencie e concilie suas transações bancárias</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={onAutoReconcile} disabled={isRunningAutoReconcile} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunningAutoReconcile ? "animate-spin" : ""}`} />
          {isRunningAutoReconcile ? "Reconciliando..." : "Auto-reconciliar"}
        </Button>
        <Button onClick={onAutoMatch} disabled={isAutoMatching || unreconciledCount === 0} className="gap-2">
          <Zap className="h-4 w-4" />
          {isAutoMatching ? "Processando..." : "Auto-matching"}
        </Button>
        <Button variant="outline" className="gap-2" onClick={onImport}>
          <Upload className="h-4 w-4" /> Importar
        </Button>
        <Button variant="outline" className="gap-2" onClick={onExport}>
          <Download className="h-4 w-4" /> Exportar
        </Button>
        <Button variant="outline" className="gap-2" onClick={onAuditTrail}>
          <History className="h-4 w-4" /> Auditoria
        </Button>
        <Button variant="outline" className="gap-2" onClick={onSettings}>
          <Settings className="h-4 w-4" /> Configurações
        </Button>
        <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={onNewBankAccount}>
          <Banknote className="h-4 w-4" /> Nova Conta Bancária
        </Button>
      </div>
    </div>
  );
}
