import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConfig,
  updateConfig,
  testConnection,
  getAutomationSettings,
  updateAutomationSettings,
} from "@/modules/whatsapp/services/whatsappConfigService";
import { patientService } from "@/modules/patients/services/patientService";
import type { WhatsAppConfig, WhatsAppAutomationSettings } from "@/modules/whatsapp/types";
import { WhatsAppActivation } from "./WhatsAppActivation";
import { SessionConfirmationSettings } from "./SessionConfirmationSettings";
import { MonthlyReminderSettings } from "./MonthlyReminderSettings";
import { OverdueAlertSettings } from "./OverdueAlertSettings";

interface WhatsAppConfigPanelProps {
  clinicId: string;
}

const DEFAULT_CONFIG: Partial<WhatsAppConfig> = {
  api_token: "",
  phone_number_id: "",
  is_active: false,
};

const DEFAULT_AUTOMATION: Partial<WhatsAppAutomationSettings> = {
  session_confirmation_enabled: false,
  session_confirmation_hours_before: 24,
  session_confirmation_message: null,
  monthly_reminder_enabled: false,
  monthly_reminder_days_before: 7,
  monthly_reminder_message: null,
  monthly_reminder_patient_ids: null,
  overdue_alert_enabled: false,
  overdue_alert_days: 1,
  overdue_alert_include_pix: false,
  overdue_alert_message: null,
  overdue_alert_patient_ids: null,
};

interface PixData {
  chave: string;
  titular: string;
  banco: string;
}

export function WhatsAppConfigPanel({ clinicId }: WhatsAppConfigPanelProps) {
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<Partial<WhatsAppConfig>>(DEFAULT_CONFIG);
  const [automation, setAutomation] = useState<Partial<WhatsAppAutomationSettings>>(DEFAULT_AUTOMATION);
  const [pixData, setPixData] = useState<PixData>({ chave: "", titular: "", banco: "" });

  // ── Data fetching ────────────────────────────────────────────

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["whatsapp-config", clinicId],
    queryFn: () => getConfig(clinicId),
    enabled: Boolean(clinicId),
  });

  const { data: automationData, isLoading: automationLoading } = useQuery({
    queryKey: ["whatsapp-automation", clinicId],
    queryFn: () => getAutomationSettings(clinicId),
    enabled: Boolean(clinicId),
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-basic", clinicId],
    queryFn: () => patientService.getPatients(clinicId, "ativo"),
    enabled: Boolean(clinicId),
  });

  // ── Sync fetched data into local state ───────────────────────

  useEffect(() => {
    if (configData) {
      setConfig(configData);
    }
  }, [configData]);

  useEffect(() => {
    if (automationData) {
      setAutomation(automationData);
    }
  }, [automationData]);

  // ── Mutations ────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const configUpdates: Partial<Pick<WhatsAppConfig, "api_token" | "phone_number_id" | "is_active">> = {
        api_token: config.api_token ?? null,
        phone_number_id: config.phone_number_id ?? null,
        is_active: Boolean(config.is_active),
      };

      const automationUpdates: Partial<Omit<WhatsAppAutomationSettings, "id" | "clinic_id" | "created_at" | "updated_at">> = {
        session_confirmation_enabled: Boolean(automation.session_confirmation_enabled),
        session_confirmation_hours_before: automation.session_confirmation_hours_before ?? 24,
        session_confirmation_message: automation.session_confirmation_message ?? null,
        monthly_reminder_enabled: Boolean(automation.monthly_reminder_enabled),
        monthly_reminder_days_before: automation.monthly_reminder_days_before ?? 7,
        monthly_reminder_message: automation.monthly_reminder_message ?? null,
        monthly_reminder_patient_ids: automation.monthly_reminder_patient_ids ?? null,
        overdue_alert_enabled: Boolean(automation.overdue_alert_enabled),
        overdue_alert_days: automation.overdue_alert_days ?? 1,
        overdue_alert_include_pix: Boolean(automation.overdue_alert_include_pix),
        overdue_alert_message: automation.overdue_alert_message ?? null,
        overdue_alert_patient_ids: automation.overdue_alert_patient_ids ?? null,
      };

      const [updatedConfig, updatedAutomation] = await Promise.all([
        updateConfig(clinicId, configUpdates),
        updateAutomationSettings(clinicId, automationUpdates),
      ]);

      if (!updatedConfig || !updatedAutomation) {
        throw new Error("Falha ao salvar configurações");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automation", clinicId] });
      toast({ title: "Configurações salvas!", description: "WhatsApp Business atualizado com sucesso." });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────

  const handleConfigChange = (updates: Partial<WhatsAppConfig>) =>
    setConfig((prev) => ({ ...prev, ...updates }));

  const handleAutomationChange = (updates: Partial<WhatsAppAutomationSettings>) =>
    setAutomation((prev) => ({ ...prev, ...updates }));

  const handlePixChange = (updates: Partial<PixData>) =>
    setPixData((prev) => ({ ...prev, ...updates }));

  // ── Loading state ────────────────────────────────────────────

  if (configLoading || automationLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando configurações do WhatsApp...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-green-600" />
        <h2 className="text-lg font-semibold">WhatsApp Business</h2>
      </div>

      <WhatsAppActivation
        config={config}
        onChange={handleConfigChange}
        onTestConnection={testConnection}
      />

      <SessionConfirmationSettings
        settings={automation}
        onChange={handleAutomationChange}
      />

      <MonthlyReminderSettings
        settings={automation}
        onChange={handleAutomationChange}
        patients={patients}
      />

      <OverdueAlertSettings
        settings={automation}
        pixData={pixData}
        onChange={handleAutomationChange}
        onPixChange={handlePixChange}
        patients={patients}
      />

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>

      {saveMutation.isSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Configurações salvas com sucesso!
        </div>
      )}
    </div>
  );
}
