import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Check,
  X,
  Upload,
  Zap,
  Filter,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { useBankTransactions } from "@/modules/finance/hooks/useBankTransactions";
import { useMatching } from "@/modules/finance/hooks/useMatching";
import { toast } from "@/modules/shared/hooks/use-toast";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { Label } from "@/components/ui/label";
import { ImportStatementDialog } from "@/components/financial/ImportStatementDialog";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";

export default function ConciliacaoBancaria() {
  const {
    transactions,
    summary,
    reject,
    isReconciling,
    isRejecting,
  } = useBankTransactions();

  const { autoMatch, manualMatch, isAutoMatching } = useMatching();

  // Estados
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    search: "",
    dataInicio: "",
    dataFim: "",
  });

  const [selectedTransaction, setSelectedTransaction] =
    useState<BankTransactionRow | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [matchNotes, setMatchNotes] = useState("");

  const unreconciledTransactions = useMemo(
    () =>
      transactions.filter(
        (tx: BankTransactionRow) =>
          tx.status !== "conciliado" && tx.status !== "rejeitado"
      ),
    [transactions]
  );

  // Filtrar transações
  const filtered = useMemo(() => {
    return transactions.filter((tx: BankTransactionRow) => {
      if (filters.tipo !== "todos" && tx.tipo !== filters.tipo) return false;
      if (filters.status !== "todos") {
        if (filters.status === "pendente") {
          if (tx.status && tx.status !== "pendente") return false;
        } else {
          if (tx.status !== filters.status) return false;
        }
      }
      if (
        filters.search &&
        !tx.descricao.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (
        filters.dataInicio &&
        new Date(tx.data_transacao) < new Date(filters.dataInicio)
      )
        return false;
      if (
        filters.dataFim &&
        new Date(tx.data_transacao) > new Date(filters.dataFim)
      )
        return false;
      return true;
    });
  }, [transactions, filters]);

  // Handlers
  const handleAutoMatch = async () => {
    try {
      const matches = await autoMatch();
      toast({
        title: "✓ Auto-matching Concluído",
        description: `${matches.length} transações correspondidas automaticamente`,
      });
    } catch {
      toast({
        title: "Erro ao fazer auto-matching",
        variant: "destructive",
      });
    }
  };

  const handleOpenMatchDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setMatchNotes("");
    setShowMatchDialog(true);
  };

  const handleManualMatch = async (transactionId: string) => {
    try {
      await manualMatch({
        transactionId,
        paymentId: transactionId,
        notas: matchNotes,
      });
      toast({ title: "✓ Transação vinculada com sucesso" });
      setShowMatchDialog(false);
      setMatchNotes("");
    } catch {
      toast({ title: "Erro ao vincular transação", variant: "destructive" });
    }
  };

  const handleOpenRejectDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setRejectMotivo("");
    setShowRejectDialog(true);
  };

  const handleReject = async () => {
    try {
      await reject({
        id: selectedTransaction.id,
        reason: rejectMotivo || "Rejeitado manualmente",
      });
      toast({ title: "✓ Transação rejeitada" });
      setShowRejectDialog(false);
    } catch {
      toast({ title: "Erro ao rejeitar transação", variant: "destructive" });
    }
  };

  // Status badge
  const getStatusBadge = (status?: string | null) => {
    if (status === "conciliado")
      return <Badge className="bg-green-100 text-green-800">Conciliada</Badge>;
    if (status === "rejeitado")
      return <Badge variant="destructive">Rejeitada</Badge>;
    return <Badge variant="outline">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Conciliação Bancária
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e concilie suas transações bancárias
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAutoMatch}
            disabled={isAutoMatching || unreconciledTransactions.length === 0}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {isAutoMatching ? "Processando..." : "Auto-matching"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="h-4 w-4" />
            Importar
          </Button>
        </div>
      </div>

      {/* Resumo KPIs */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold mt-2">{summary.total}</p>
              <p className="text-xs text-muted-foreground mt-1">transações</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-green-700">Conciliadas</p>
              <p className="text-3xl font-bold text-green-700 mt-2">
                {summary.conciliados}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {summary.total > 0
                  ? ((summary.conciliados / summary.total) * 100).toFixed(0)
                  : 0}
                %
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-transparent">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-yellow-700">A Conciliar</p>
              <p className="text-3xl font-bold text-yellow-700 mt-2">
                {summary.pendentes}
              </p>
              <p className="text-xs text-yellow-600 mt-1">pendentes</p>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-gradient-to-br from-green-50 to-transparent">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-green-700">Entradas</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatBRL(summary.totalCreditos)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Saídas</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {formatBRL(summary.totalDebitos)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Filtros</h3>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <Input
              placeholder="Pesquisar..."
              value={filters.search}
              onChange={(e) =>
                setFilters((p) => ({ ...p, search: e.target.value }))
              }
            />
            <Select
              value={filters.tipo}
              onValueChange={(v) => setFilters((p) => ({ ...p, tipo: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="conciliado">Conciliadas</SelectItem>
                <SelectItem value="rejeitado">Rejeitadas</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.dataInicio}
              onChange={(e) =>
                setFilters((p) => ({ ...p, dataInicio: e.target.value }))
              }
            />
            <Input
              type="date"
              value={filters.dataFim}
              onChange={(e) =>
                setFilters((p) => ({ ...p, dataFim: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Transações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Transações ({filtered.length})</CardTitle>
          {filtered.some((tx: BankTransactionRow) => !tx.status || tx.status === "pendente") && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
              {
                filtered.filter(
                  (tx: BankTransactionRow) => !tx.status || tx.status === "pendente"
                ).length
              }{" "}
              pendentes
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma transação encontrada
              </div>
            ) : (
              filtered.map((tx: BankTransactionRow) => (
                <div
                  key={tx.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  {/* Esquerda: Descrição e Data */}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tx.descricao}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.data_transacao).toLocaleDateString(
                          "pt-BR"
                        )}
                      </p>
                      {tx.documento && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            •
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {tx.documento}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Meio: Valor e Status */}
                  <div className="flex items-center gap-4 mx-6">
                    <div className="text-right">
                      <p
                        className={`font-semibold text-sm ${
                          tx.tipo === "credito"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.tipo === "credito" ? "+" : "-"}
                        {formatBRL(Math.abs(tx.valor))}
                      </p>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>

                  {/* Direita: Ações */}
                  <div className="flex items-center gap-2">
                    {(!tx.status || tx.status === "pendente") && (
                      <>
                        <Dialog
                          open={
                            showMatchDialog &&
                            selectedTransaction?.id === tx.id
                          }
                          onOpenChange={(open) => {
                            if (!open) setShowMatchDialog(false);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenMatchDialog(tx)}
                              className="gap-2"
                            >
                              <Check className="h-4 w-4" />
                              Conciliar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Conciliar Transação</DialogTitle>
                              <DialogDescription>
                                Vincule esta transação a um pagamento registrado
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="bg-muted p-3 rounded">
                                <p className="text-xs text-muted-foreground">
                                  Transação
                                </p>
                                <p className="font-medium text-sm">
                                  {selectedTransaction?.descricao}
                                </p>
                                <p className="text-sm font-semibold text-green-600">
                                  {selectedTransaction
                                    ? formatBRL(
                                        Math.abs(selectedTransaction.valor)
                                      )
                                    : ""}
                                </p>
                              </div>
                              <div>
                                <Label>Notas (opcional)</Label>
                                <Input
                                  placeholder="Adicione observações..."
                                  value={matchNotes}
                                  onChange={(e) =>
                                    setMatchNotes(e.target.value)
                                  }
                                  className="mt-2"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={() =>
                                  selectedTransaction &&
                                  handleManualMatch(selectedTransaction.id)
                                }
                                disabled={isReconciling}
                              >
                                {isReconciling
                                  ? "Processando..."
                                  : "Vincular Transação"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenRejectDialog(tx)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Pendentes */}
      {summary && summary.pendentes > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-900">
              {summary.pendentes} transação(ões) pendente(s)
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              Use o auto-matching para encontrar correspondências automáticas ou
              concilie manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Rejeitar Transação?</AlertDialogTitle>
          <AlertDialogDescription>
            Adicione um motivo para rejeição
          </AlertDialogDescription>
          <Input
            placeholder="Motivo da rejeição..."
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
          />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isRejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? "Rejeitando..." : "Rejeitar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <ImportStatementDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
    </div>
  );
}
