import { useState, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useBankAccounts } from "@/modules/finance/hooks/useBankAccounts";
import { useStatementImport } from "@/modules/finance/hooks/useStatementImport";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { toast } from "sonner";

interface ImportStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportStatementDialog({ open, onOpenChange }: ImportStatementDialogProps) {
  const { accounts } = useBankAccounts();
  const {
    step,
    validation,
    importResult,
    error: parseError,
    parseFile,
    importTransactions,
    reset,
  } = useStatementImport();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAccounts = accounts.filter((a) => a.ativo !== false);

  const handleClose = () => {
    setSelectedAccountId("");
    setSelectedFile(null);
    setIsDragging(false);
    reset();
    onOpenChange(false);
  };

  const handleFileSelect = async (file: File) => {
    const allowed = ["csv", "txt", "ofx", "qfx"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowed.includes(ext)) {
      toast.error("Formato não suportado", { description: "Utilize arquivos CSV, TXT ou OFX." });
      return;
    }
    setSelectedFile(file);
    await parseFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!selectedAccountId) {
      toast.error("Selecione uma conta bancária.");
      return;
    }
    try {
      await importTransactions(selectedAccountId);
      toast.success("Importação concluída!");
    } catch {
      toast.error("Erro ao importar extrato");
    }
  };

  const isParsing = step === "parsing";
  const isImporting = step === "importing";
  const isDone = step === "done";
  const hasPreview = step === "preview" && validation !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato Bancário
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou OFX para importar as transações do extrato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
          {/* Success state */}
          {isDone && importResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-800">
                <strong>Importação concluída!</strong>
                <br />
                {importResult.imported} importada{importResult.imported !== 1 ? "s" : ""}
                {importResult.skipped > 0
                  ? `, ${importResult.skipped} ignorada${importResult.skipped !== 1 ? "s" : ""}`
                  : ""}
                .
              </AlertDescription>
            </Alert>
          )}

          {/* Bank account selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              Conta Bancária <span className="text-red-500">*</span>
            </Label>
            {activeAccounts.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Nenhuma conta bancária cadastrada. Cadastre uma conta primeiro.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta bancária" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.apelido || acc.banco_nome}
                      {acc.conta ? ` · ${acc.conta}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* File upload area */}
          {!isDone && (
            <div className="space-y-1.5">
              <Label className="text-sm">
                Arquivo do Extrato <span className="text-red-500">*</span>
              </Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                )}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Processando arquivo…</p>
                  </div>
                ) : selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <button
                      type="button"
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        reset();
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Arraste e solte ou{" "}
                      <span className="text-primary font-medium">clique para selecionar</span>
                    </p>
                    <p className="text-xs text-muted-foreground">CSV, TXT, OFX, QFX</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.ofx,.qfx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Transaction preview */}
          {hasPreview && validation && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Preview das Transações</Label>
                <Badge variant="secondary" className="text-xs">
                  {validation.valid.length} válida{validation.valid.length !== 1 ? "s" : ""}
                  {validation.invalid.length > 0
                    ? `, ${validation.invalid.length} ignorada${validation.invalid.length !== 1 ? "s" : ""}`
                    : ""}
                </Badge>
              </div>
              <ScrollArea className="h-48 rounded-md border">
                <div className="divide-y">
                  {validation.valid.slice(0, 50).map((tx, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="text-muted-foreground w-20 shrink-0">
                        {tx.data_transacao}
                      </span>
                      <span className="flex-1 truncate">{tx.descricao}</span>
                      <span
                        className={cn(
                          "font-semibold shrink-0",
                          tx.valor >= 0 ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {formatBRL(tx.valor)}
                      </span>
                    </div>
                  ))}
                  {validation.valid.length > 50 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      + {validation.valid.length - 50} mais transações
                    </div>
                  )}
                </div>
              </ScrollArea>
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
          {isImporting && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importando transações…</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {isDone ? "Fechar" : "Cancelar"}
          </Button>
          {!isDone && (
            <Button
              onClick={handleImport}
              disabled={
                !selectedAccountId ||
                !hasPreview ||
                !validation ||
                validation.valid.length === 0 ||
                isImporting
              }
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importando…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                  {hasPreview && validation
                    ? ` (${validation.valid.length})`
                    : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
