import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/modules/finance/hooks/useNotifications";
import { toast } from "@/modules/shared/hooks/use-toast";

export function NotificationPreferences() {
  const { preferences, savePreferences } = useNotifications();
  const [formData, setFormData] = useState(preferences || {});

  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);

  const handleSave = async () => {
    try {
      await savePreferences(formData);
      toast({ title: "Preferências salvas com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao salvar preferências", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔔 Preferências de Notificação</CardTitle>
        <CardDescription>Configure como deseja receber alertas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Slack */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Notificações via Slack</Label>
            <p className="text-xs text-muted-foreground">Receba alertas no Slack</p>
          </div>
          <Switch
            checked={formData.slack_enabled ?? true}
            onCheckedChange={(v) =>
              setFormData({ ...formData, slack_enabled: v })
            }
          />
        </div>

        {/* Email */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Notificações via Email</Label>
            <p className="text-xs text-muted-foreground">Receba alertas por email</p>
          </div>
          <Switch
            checked={formData.email_enabled ?? true}
            onCheckedChange={(v) =>
              setFormData({ ...formData, email_enabled: v })
            }
          />
        </div>

        {/* Push */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Notificações Push</Label>
            <p className="text-xs text-muted-foreground">Notificações do navegador</p>
          </div>
          <Switch
            checked={formData.push_enabled ?? true}
            onCheckedChange={(v) =>
              setFormData({ ...formData, push_enabled: v })
            }
          />
        </div>

        {/* Quiet Hours */}
        <div className="space-y-2">
          <Label>Horário de Silêncio</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Input
                type="time"
                value={formData.quiet_hours_start || ""}
                onChange={(e) =>
                  setFormData({ ...formData, quiet_hours_start: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input
                type="time"
                value={formData.quiet_hours_end || ""}
                onChange={(e) =>
                  setFormData({ ...formData, quiet_hours_end: e.target.value })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Notificações não críticas não serão enviadas neste período
          </p>
        </div>

        {/* Apenas Críticos */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Apenas Alertas Críticos</Label>
            <p className="text-xs text-muted-foreground">Ignore avisos e info</p>
          </div>
          <Switch
            checked={formData.critical_only ?? false}
            onCheckedChange={(v) =>
              setFormData({ ...formData, critical_only: v })
            }
          />
        </div>

        <Button onClick={handleSave} className="w-full">
          💾 Salvar Preferências
        </Button>
      </CardContent>
    </Card>
  );
}
