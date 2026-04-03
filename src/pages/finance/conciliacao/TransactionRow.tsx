import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ChevronUp, Calendar, Lightbulb, Pencil, Trash2,
  Link, Scissors, RotateCcw, X, User, Check,
} from "lucide-react";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { AnomalyBadge } from "@/components/financial/AnomalyBadge";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { PossibleMatch } from "@/modules/finance/services/matchingService";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";

interface TransactionRowProps {
  tx: BankTransactionRow;
  isExpanded: boolean;
  suggestions: PossibleMatch[];
  suggestionsLoading: boolean;
  anomalies: Anomaly[];
  linkedPatientId: string;
  onPatientChange: (v: string) => void;
  onToggleExpand: (id: string) => void;
  onOpenDetail: (tx: BankTransactionRow) => void;
  onEdit: (tx: BankTransactionRow) => void;
  onDelete: (tx: BankTransactionRow) => void;
  onReconcile: (tx: BankTransactionRow) => void;
  onSplit: (tx: BankTransactionRow) => void;
  onRefund: (tx: BankTransactionRow) => void;
  onUndo: (tx: BankTransactionRow) => void;
  onReject: (tx: BankTransactionRow) => void;
  onAcceptSuggestion: (txId: string, paymentId: string) => void;
}

const confidenceColor = (c: number) => {
  if (c >= 0.8) return "text-green-600 font-semibold";
  if (c >= 0.6) return "text-yellow-600 font-semibold";
  return "text-muted-foreground";
};

const getStatusBadge = (status?: string | null) => {
  if (status === "conciliado") return <Badge className="bg-green-100 text-green-800 border-green-200">Conciliada</Badge>;
  if (status === "rejeitado") return <Badge variant="destructive">Rejeitada</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
};

export function TransactionRow({
  tx, isExpanded, suggestions, suggestionsLoading, anomalies,
  linkedPatientId, onPatientChange,
  onToggleExpand, onOpenDetail, onEdit, onDelete, onReconcile, onSplit, onRefund, onUndo, onReject, onAcceptSuggestion,
}: TransactionRowProps) {
  const isConciliated = tx.status === "conciliado";
  const isRejected = tx.status === "rejeitado";
  const hasSuggestions = suggestions.length > 0;
  const reconcileLabel = isConciliated ? "Re-conciliar" : isRejected ? "Aceitar" : "Conciliar";

  return (
    <div className="border-b last:border-b-0">
      <div
        className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("[role='button']")) return;
          onOpenDetail(tx);
        }}
        title="Clique para ver detalhes"
      >
        <button className="mr-2 p-1 rounded hover:bg-muted text-muted-foreground" onClick={(e) => { e.stopPropagation(); onToggleExpand(tx.id); }}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{tx.descricao}</p>
            {hasSuggestions && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                <Lightbulb className="h-3 w-3" />
                {suggestions.length} {suggestions.length === 1 ? "sugestão" : "sugestões"}
              </span>
            )}
            {anomalies.length > 0 && <AnomalyBadge anomalies={anomalies} />}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{new Date(tx.data_transacao).toLocaleDateString("pt-BR")}</p>
            {tx.documento && <><span className="text-xs text-muted-foreground">•</span><p className="text-xs text-muted-foreground">{tx.documento}</p></>}
            {tx.categoria && <><span className="text-xs text-muted-foreground">•</span><p className="text-xs text-muted-foreground capitalize">{tx.categoria}</p></>}
          </div>
        </div>

        <div className="flex items-center gap-4 mx-4">
          <div className="text-right">
            <p className={`font-semibold text-sm ${tx.tipo === "credito" ? "text-green-600" : "text-red-600"}`}>
              {tx.tipo === "credito" ? "+" : "-"}{formatBRL(Math.abs(tx.valor))}
            </p>
            {getStatusBadge(tx.status)}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => onEdit(tx)} className="h-8 gap-1.5 px-2.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(tx)} className="h-8 gap-1.5 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <Button size="sm" variant={isConciliated ? "outline" : "default"} onClick={() => onReconcile(tx)}
            className={`h-8 gap-1.5 px-3 text-xs font-semibold shadow-sm${isConciliated ? " border-green-200 text-green-700 hover:bg-green-50" : isRejected ? " bg-orange-600 hover:bg-orange-700" : ""}`}
          >
            <Link className="h-3.5 w-3.5" /> {reconcileLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSplit(tx)} className="h-8 gap-1.5 px-2.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50">
            <Scissors className="h-3.5 w-3.5" /> Split
          </Button>
          {tx.tipo === "credito" && (
            <Button size="sm" variant="outline" onClick={() => onRefund(tx)} className="h-8 gap-1.5 px-2.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50">
              <RotateCcw className="h-3.5 w-3.5" /> Reembolso
            </Button>
          )}
          {isConciliated && (
            <Button size="sm" variant="outline" onClick={() => onUndo(tx)} className="h-8 gap-1.5 px-2.5 text-xs border-gray-200 text-gray-600 hover:bg-gray-50">
              <RotateCcw className="h-3.5 w-3.5" /> Desfazer
            </Button>
          )}
          {!isRejected && (
            <Button size="sm" variant="outline" onClick={() => onReject(tx)} className="h-8 gap-1.5 px-2.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
              <X className="h-3.5 w-3.5" /> Rejeitar
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-12 pb-4 bg-muted/30 border-t space-y-3">
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Vincular Paciente</span>
            </div>
            <PatientCombobox value={linkedPatientId} onValueChange={onPatientChange} placeholder="Buscar paciente..." className="max-w-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Sugestões de Correspondência</span>
            </div>
            {suggestionsLoading ? (
              <p className="text-xs text-muted-foreground">Buscando sugestões...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma sugestão encontrada para esta transação.</p>
            ) : (
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.paymentId} className="flex items-center justify-between bg-white border rounded p-2 text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-xs">{s.descricao}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatBRL(s.valor)}</span>
                        {s.data_pagamento && <span className="text-xs text-muted-foreground">• {new Date(s.data_pagamento).toLocaleDateString("pt-BR")}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className={`text-xs ${confidenceColor(s.confianca)}`}>{Math.round(s.confianca * 100)}%</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onAcceptSuggestion(tx.id, s.paymentId)}>
                        <Check className="h-3 w-3" /> Aceitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {tx.observacoes && (
            <div><span className="text-xs font-medium text-muted-foreground">Observações: </span><span className="text-xs text-muted-foreground">{tx.observacoes}</span></div>
          )}
          {tx.data_conciliacao && (
            <div><span className="text-xs font-medium text-muted-foreground">Conciliada em: </span><span className="text-xs text-muted-foreground">{new Date(tx.data_conciliacao).toLocaleDateString("pt-BR")}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
