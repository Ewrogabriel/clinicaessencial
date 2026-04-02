import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Action = "approve" | "reject";

interface BulkApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  action: Action;
  onConfirm: (note: string) => Promise<void>;
  isLoading?: boolean;
}

export function BulkApprovalDialog({
  open,
  onOpenChange,
  selectedCount,
  action,
  onConfirm,
  isLoading = false,
}: BulkApprovalDialogProps) {
  const [note, setNote] = useState("");

  const isApprove = action === "approve";
  const actionLabel = isApprove ? "Aprovar" : "Rejeitar";
  const actionIcon = isApprove ? (
    <CheckCircle2 className="h-5 w-5 text-green-600" />
  ) : (
    <XCircle className="h-5 w-5 text-red-600" />
  );

  const handleConfirm = async () => {
    await onConfirm(note);
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {actionIcon}
            {actionLabel} Transações em Lote
          </DialogTitle>
          <DialogDescription>
            Você está prestes a{" "}
            <strong>
              {isApprove ? "aprovar" : "rejeitar"} {selectedCount} transaç
              {selectedCount === 1 ? "ão" : "ões"}
            </strong>
            . Esta ação será registrada no histórico de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={isApprove ? "default" : "destructive"}
              className="text-sm px-3 py-1"
            >
              {selectedCount} selecionada{selectedCount !== 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-note" className="text-sm">
              {isApprove ? "Observação (opcional)" : "Motivo da rejeição (opcional)"}
            </Label>
            <Textarea
              id="bulk-note"
              placeholder={
                isApprove
                  ? "Adicione uma observação sobre a aprovação..."
                  : "Informe o motivo da rejeição..."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                {actionIcon}
                <span className="ml-1">{actionLabel}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
