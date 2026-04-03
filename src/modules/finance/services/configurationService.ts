import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface ReconciliationConfig {
  id?: string;
  clinic_id: string;
  matching_window_days: number;
  value_tolerance_percent: number;
  origin_priority: string;
  min_suggestion_score: number;
  auto_reconcile_threshold: number;
  auto_reconcile_schedule: string;
  auto_reconcile_enabled: boolean;
  alert_unreconciled_days: number;
}

export const DEFAULT_CONFIG: Omit<ReconciliationConfig, "id" | "clinic_id"> = {
  matching_window_days: 15,
  value_tolerance_percent: 5,
  origin_priority: "matricula,plano,sessao,manual",
  min_suggestion_score: 60,
  auto_reconcile_threshold: 95,
  auto_reconcile_schedule: "0 1 * * *",
  auto_reconcile_enabled: false,
  alert_unreconciled_days: 30,
};

export const configurationService = {
  async getConfig(clinicId: string): Promise<ReconciliationConfig> {
    try {
      const { data, error } = await (supabase as any)
        .from("clinic_reconciliation_config")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as ReconciliationConfig;
      return { ...DEFAULT_CONFIG, clinic_id: clinicId };
    } catch (error) {
      handleError(error, "Erro ao buscar configurações");
      return { ...DEFAULT_CONFIG, clinic_id: clinicId };
    }
  },

  async saveConfig(config: ReconciliationConfig): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("clinic_reconciliation_config")
        .upsert(
          { ...config, updated_at: new Date().toISOString() },
          { onConflict: "clinic_id" }
        );
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao salvar configurações");
      throw error;
    }
  },
};
