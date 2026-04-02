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
import { toast } from "@/modules/shared/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImportStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ImportStatementDialog({
  open,
  onOpenChange,
}: ImportStatementDialogProps) {
  const { accounts } = useBankAccounts();
  const { preview, parseError, loadPreview, importTransactions, isImporting, resetPreview } =
    useStatementImport();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAccounts = accounts.filter((a) => a.ativo !== false);

  const handleClose = () => {
    setSelectedAccountId("");
    setSelectedFile(null);
    setImportDone(false);
    setImportResult(null);
    resetPreview();
    onOpenChange(false);
  };

  const handleFileSelect = async (file: File) => {
    const allowed = ["csv", "txt", "ofx", "qfx"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowed.includes(ext)) {
      toast({
        title: "Formato não suportado",
        description: "Utilize arquivos CSV, TXT ou OFX.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setImportDone(false);
    setImportResult(null);
    await loadPreview(file);
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
    if (!selectedAccountId || preview.length === 0) return;
    try {
      const result = await importTransactions({
        transactions: preview,
        bankAccountId: selectedAccountId,
      });
      setImportResult(result);
      setImportDone(true);
      toast({
        title: "Importação concluída",
        description: `${result.imported} transaç${result.imported === 1 ? "ão importada" : "ões importadas"}.`,
      });
    } catch {
      toast({
        title: "Erro ao importar extrato",
        variant: "destructive",
      });
    }
  };

  const canImport =
    selectedAccountId && preview.length > 0 && !isImporting && !importDone;

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
          {importDone && importResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-800">
                <strong>Importação concluída!</strong>
                <br />
                {importResult.imported} importada{importResult.imported !== 1 ? "s" : ""},
                {importResult.skipped > 0 ? ` ${importResult.skipped} ignorada${importResult.skipped !== 1 ? "s" : ""},` : ""}
                {importResult.errors > 0 ? ` ${importResult.errors} com erro.` : ""}
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
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <button
                    type="button"
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      resetPreview();
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

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Transaction preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  Preview das Transações
                </Label>
                <Badge variant="secondary" className="text-xs">
                  {preview.length} transaç{preview.length === 1 ? "ão" : "ões"}
                </Badge>
              </div>
              <ScrollArea className="h-48 rounded-md border">
                <div className="divide-y">
                  {preview.slice(0, 50).map((tx, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="text-muted-foreground w-20 shrink-0">{tx.data_transacao}</span>
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
                  {preview.length > 50 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      + {preview.length - 50} mais transações
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {importDone ? "Fechar" : "Cancelar"}
          </Button>
          {!importDone && (
            <Button onClick={handleImport} disabled={!canImport}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {preview.length > 0 ? `(${preview.length})` : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
