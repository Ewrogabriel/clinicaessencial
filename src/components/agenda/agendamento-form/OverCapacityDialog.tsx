import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AvailabilityCheckResult } from "@/lib/availabilityCheck";

interface OverCapacityDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  availabilityResult: AvailabilityCheckResult | null;
}

export function OverCapacityDialog({ open, onCancel, onConfirm, availabilityResult }: OverCapacityDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            ⚠️ Capacidade excedida
          </AlertDialogTitle>
          <AlertDialogDescription>
            {availabilityResult && (
              <>
                <strong>Você está agendando além da capacidade definida.</strong>
                <br />
                {availabilityResult.currentCount >= availabilityResult.maxCapacity
                  ? `Este horário já atingiu ${availabilityResult.currentCount}/${availabilityResult.maxCapacity} pacientes.`
                  : availabilityResult.message}
                <br /><br />
                Deseja continuar mesmo assim?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onConfirm}
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
