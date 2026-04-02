import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatTransactionDate } from "@/modules/finance/utils/reconciliationHelpers";
import type { BankAccount } from "@/modules/finance/types";
import type { ImportStep } from "@/modules/finance/hooks/useStatementImport";
import type { BankStatementTransaction, ImportValidationResult, ImportResult } from "@/modules/finance/types";

interface ImportStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BankAccount[];
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  step: ImportStep;
  parsedData: BankStatementTransaction[];
  validation: ImportValidationResult | null;
  importResult: ImportResult | null;
  error: string | null;
  onFileSelect: (file: File) => void;
  onImport: () => void;
  onReset: () => void;
}

export function ImportStatementDialog({
  open,
  onOpenChange,
  accounts,
  selectedAccountId,
  onAccountChange,
  step,
  parsedData,
  validation,
  importResult,
  error,
  onFileSelect,
  onImport,
  onReset,
}: ImportStatementDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    onReset();
    onOpenChange(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato Bancário
          </DialogTitle>
          <DialogDescription>
            Importe transações do seu extrato em formato CSV ou OFX.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Account selector */}
          <div className="space-y-1.5">
            <Label>Conta Bancária</Label>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conta cadastrada. Cadastre uma conta primeiro.
              </p>
            ) : (
              <Select value={selectedAccountId} onValueChange={onAccountChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.apelido ?? acc.banco_nome}
                      {acc.conta ? ` — ${acc.conta}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* File upload area */}
          {step === "idle" && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary hover:bg-muted/30",
                !selectedAccountId && "opacity-50 pointer-events-none"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">
                Arraste o arquivo ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Formatos suportados: CSV, OFX, QFX
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ofx,.qfx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelect(file);
                }}
              />
            </div>
          )}

          {/* Parsing */}
          {step === "parsing" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Processando arquivo...
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Preview */}
          {step === "preview" && validation && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{validation.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {validation.valid.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Válidas</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {validation.invalid.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Inválidas</p>
                </div>
              </div>

              {/* Preview list */}
              <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                {validation.valid.slice(0, 20).map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tx.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTransactionDate(tx.data_transacao)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-semibold shrink-0 ml-2",
                        tx.valor >= 0 ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {formatBRL(tx.valor)}
                    </span>
                  </div>
                ))}
                {validation.valid.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    + {validation.valid.length - 20} transações adicionais
                  </div>
                )}
              </div>

              {/* Invalid rows */}
              {validation.invalid.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 p-3 space-y-1">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                    Linhas ignoradas:
                  </p>
                  {validation.invalid.slice(0, 5).map((inv, i) => (
                    <p key={i} className="text-xs text-yellow-600 dark:text-yellow-500">
                      Linha {inv.row}: {inv.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Importando transações...
              </p>
            </div>
          )}

          {/* Done */}
          {step === "done" && importResult && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <div>
                <p className="font-semibold">Importação concluída!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {importResult.imported} transaç
                  {importResult.imported !== 1 ? "ões importadas" : "ão importada"}{" "}
                  com sucesso.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "done" ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={step === "importing"}
              >
                Cancelar
              </Button>
              {step === "preview" && (
                <Button
                  onClick={onImport}
                  disabled={
                    !selectedAccountId ||
                    !validation ||
                    validation.valid.length === 0
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {validation?.valid.length ?? 0} transaç
                  {(validation?.valid.length ?? 0) !== 1 ? "ões" : "ão"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
