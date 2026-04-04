// ============================================================
// WhatsApp Conversation Service
// Manages the inbox: conversations, messages, professional assignment
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  WhatsAppConversation,
  WhatsAppConversationMessage,
  WhatsAppConfig,
  ConversationStatus,
} from "@/modules/whatsapp/types";

// ── Conversations ────────────────────────────────────────────

export async function getConversations(
  clinicId: string,
  status?: ConversationStatus
): Promise<WhatsAppConversation[]> {
  let q = (supabase as any)
    .from("whatsapp_conversations")
    .select(
      `id, clinic_id, patient_id, phone_number, contact_name,
       assigned_professional_id, status, last_message_at,
       last_message_preview, unread_count, created_at, updated_at,
       patient:pacientes(id, nome, foto_url),
       professional:profiles!assigned_professional_id(user_id, nome)`
    )
    .eq("clinic_id", clinicId)
    .order("last_message_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WhatsAppConversation[];
}

export async function getMessages(
  conversationId: string
): Promise<WhatsAppConversationMessage[]> {
  const { data, error } = await (supabase as any)
    .from("whatsapp_conversation_messages")
    .select(
      `id, conversation_id, direction, content, sent_by_professional_id,
       message_id_external, read_at, created_at,
       professional:profiles!sent_by_professional_id(nome)`
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WhatsAppConversationMessage[];
}

export async function assignProfessional(
  conversationId: string,
  professionalId: string | null
): Promise<void> {
  const { error } = await (supabase as any)
    .from("whatsapp_conversations")
    .update({ assigned_professional_id: professionalId })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  const { error } = await (supabase as any)
    .from("whatsapp_conversations")
    .update({ status })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function markAsRead(conversationId: string): Promise<void> {
  await (supabase as any)
    .from("whatsapp_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);

  // Mark messages as read
  await (supabase as any)
    .from("whatsapp_conversation_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("direction", "incoming")
    .is("read_at", null);
}

// ── Sending replies ──────────────────────────────────────────

export async function sendReply(params: {
  conversationId: string;
  clinicId: string;
  phoneNumber: string;
  content: string;
  professionalId: string;
}): Promise<void> {
  // Load clinic WhatsApp config
  const { data: cfg, error: cfgErr } = await (supabase as any)
    .from("whatsapp_config")
    .select(
      "provider, api_token, phone_number_id, evolution_api_url, evolution_instance, evolution_api_key, is_active"
    )
    .eq("clinic_id", params.clinicId)
    .maybeSingle();

  if (cfgErr || !cfg?.is_active) throw new Error("WhatsApp não configurado ou inativo.");

  // Send via the appropriate provider
  if (cfg.provider === "evolution") {
    if (!cfg.evolution_api_url || !cfg.evolution_instance || !cfg.evolution_api_key) {
      throw new Error("Configuração Evolution API incompleta.");
    }
    const phone = params.phoneNumber.replace(/\D/g, "");
    const resp = await fetch(
      `${cfg.evolution_api_url}/message/sendText/${cfg.evolution_instance}`,
      {
        method: "POST",
        headers: {
          apikey: cfg.evolution_api_key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number: phone, text: params.content }),
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as any)?.response?.message ?? `HTTP ${resp.status}`);
    }
  } else {
    // Meta
    if (!cfg.api_token || !cfg.phone_number_id) {
      throw new Error("Configuração Meta API incompleta.");
    }
    const phone = params.phoneNumber.startsWith("+")
      ? params.phoneNumber
      : `+${params.phoneNumber}`;
    const resp = await fetch(
      `https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.api_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: false, body: params.content },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `HTTP ${resp.status}`);
    }
  }

  // Save message locally
  await (supabase as any).from("whatsapp_conversation_messages").insert({
    conversation_id: params.conversationId,
    direction: "outgoing",
    content: params.content,
    sent_by_professional_id: params.professionalId,
  });

  // Update conversation preview
  await (supabase as any)
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: params.content.slice(0, 100),
    })
    .eq("id", params.conversationId);
}

// ── Evolution API – test connection ─────────────────────────

export async function testEvolutionConnection(
  apiUrl: string,
  instance: string,
  apiKey: string
): Promise<{ success: boolean; status: string | null; error: string | null }> {
  try {
    const resp = await fetch(`${apiUrl}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: apiKey },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json().catch(() => null);
    const instances = Array.isArray(data) ? data : (data?.data ?? []);
    const found = instances.find(
      (i: Record<string, unknown>) =>
        (i.name ?? i.instanceName) === instance
    );
    if (!found) {
      return {
        success: false,
        status: null,
        error: `Instância "${instance}" não encontrada no servidor.`,
      };
    }
    const state = (found.connectionStatus ?? found.state ?? "unknown") as string;
    return { success: state === "open", status: state, error: null };
  } catch (err) {
    return {
      success: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
