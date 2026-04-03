// ============================================================
// WhatsApp Business Integration – Configuration Service
// Manages WhatsApp API credentials per clinic:
//   getConfig, updateConfig, testConnection
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import { WhatsAppService } from "@/lib/whatsapp/whatsappService";
import type {
  WhatsAppConfig,
  WhatsAppAutomationSettings,
  ConnectionTestResult,
} from "@/modules/whatsapp/types";

// ── Config CRUD ──────────────────────────────────────────────

/**
 * Retrieves the WhatsApp configuration for the given clinic.
 * Returns null if no configuration has been created yet.
 */
export async function getConfig(clinicId: string): Promise<WhatsAppConfig | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("whatsapp_config")
      .select("id, clinic_id, api_token, phone_number_id, is_active, created_at, updated_at")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (error) throw error;
    return data as WhatsAppConfig | null;
  } catch (error) {
    handleError(error, "Erro ao buscar configuração do WhatsApp.");
    return null;
  }
}

/**
 * Creates or updates the WhatsApp configuration for a clinic.
 * Accepts partial updates – only provided fields are modified.
 */
export async function updateConfig(
  clinicId: string,
  updates: Partial<Pick<WhatsAppConfig, "api_token" | "phone_number_id" | "is_active">>
): Promise<WhatsAppConfig | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("whatsapp_config")
      .upsert(
        { clinic_id: clinicId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "clinic_id" }
      )
      .select("id, clinic_id, api_token, phone_number_id, is_active, created_at, updated_at")
      .single();

    if (error) throw error;
    return data as WhatsAppConfig;
  } catch (error) {
    handleError(error, "Erro ao atualizar configuração do WhatsApp.");
    return null;
  }
}

/**
 * Tests the provided credentials by making a live call to the
 * WhatsApp Business API.  Does NOT persist any data.
 */
export async function testConnection(
  token: string,
  phoneNumberId: string
): Promise<ConnectionTestResult> {
  return WhatsAppService.testConnection(token, phoneNumberId);
}

// ── Automation settings ──────────────────────────────────────

/**
 * Retrieves the automation settings for the given clinic.
 * Returns null if none have been configured yet.
 */
export async function getAutomationSettings(
  clinicId: string
): Promise<WhatsAppAutomationSettings | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("whatsapp_automation_settings")
      .select("*")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (error) throw error;
    return data as WhatsAppAutomationSettings | null;
  } catch (error) {
    handleError(error, "Erro ao buscar configurações de automação do WhatsApp.");
    return null;
  }
}

/**
 * Creates or updates automation settings for a clinic.
 */
export async function updateAutomationSettings(
  clinicId: string,
  updates: Partial<Omit<WhatsAppAutomationSettings, "id" | "clinic_id" | "created_at" | "updated_at">>
): Promise<WhatsAppAutomationSettings | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("whatsapp_automation_settings")
      .upsert(
        { clinic_id: clinicId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "clinic_id" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return data as WhatsAppAutomationSettings;
  } catch (error) {
    handleError(error, "Erro ao atualizar configurações de automação do WhatsApp.");
    return null;
  }
}
