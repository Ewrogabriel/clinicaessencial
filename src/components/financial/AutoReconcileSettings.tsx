import { useState, useEffect } from "react";
import { Settings, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
import { toast } from "sonner";
  configurationService,
  ReconciliationConfig,
  DEFAULT_CONFIG,
} from "@/modules/finance/services/configurationService";
interface AutoReconcileSettingsProps {
  open: boolean;
  clinicId: string;
  onClose: () => void;
}

export function AutoReconcileSettings({
  open,
  clinicId,
  onClose,
}: AutoReconcileSettingsProps) {
  const [config, setConfig] = useState<ReconciliationConfig>({
    ...DEFAULT_CONFIG,
    clinic_id: clinicId,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && clinicId) {
      setIsLoading(true);
      configurationService
        .getConfig(clinicId)
        .then(setConfig)
        .finally(() => setIsLoading(false));
    }
  }, [open, clinicId]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await configurationService.saveConfig(config);
      toast({ title: "✓ Configurações salvas" });
      onClose();
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const update = (field: keyof ReconciliationConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Reconciliação
          </DialogTitle>
          <DialogDescription>
            Configure as regras de matching e auto-reconciliação
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Janela de matching (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={config.matching_window_days}
                  onChange={(e) => update("matching_window_days", parseInt(e.target.value) || 15)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 15 dias</p>
              </div>
              <div>
                <Label>Tolerância de valor (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={0.1}
                  value={config.value_tolerance_percent}
                  onChange={(e) => update("value_tolerance_percent", parseFloat(e.target.value) || 5)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 5%</p>
              </div>
              <div>
                <Label>Score mínimo de sugestão</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.min_suggestion_score}
                  onChange={(e) => update("min_suggestion_score", parseFloat(e.target.value) || 60)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 60</p>
              </div>
              <div>
                <Label>Threshold auto-reconciliação</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.auto_reconcile_threshold}
                  onChange={(e) => update("auto_reconcile_threshold", parseFloat(e.target.value) || 95)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 95</p>
              </div>
              <div>
                <Label>Alerta: dias sem conciliar</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.alert_unreconciled_days}
                  onChange={(e) => update("alert_unreconciled_days", parseInt(e.target.value) || 30)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 30 dias</p>
              </div>
              <div>
                <Label>Schedule (cron)</Label>
                <Input
                  value={config.auto_reconcile_schedule}
                  onChange={(e) => update("auto_reconcile_schedule", e.target.value)}
                  placeholder="0 1 * * *"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Ex: 0 1 * * * (1h da manhã)</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Switch
                checked={config.auto_reconcile_enabled}
                onCheckedChange={(v) => update("auto_reconcile_enabled", v)}
              />
              <div>
                <div className="text-sm font-medium">Auto-reconciliação noturna</div>
                <div className="text-xs text-muted-foreground">
                  Executar reconciliação automática conforme schedule configurado
                </div>
              </div>
            </div>

            <div>
              <Label>Prioridade de origens</Label>
              <Input
                value={config.origin_priority}
                onChange={(e) => update("origin_priority", e.target.value)}
                placeholder="matricula,plano,sessao,manual"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ordem de prioridade separada por vírgula
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
