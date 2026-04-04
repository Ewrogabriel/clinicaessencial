// Deno Edge Function: evolution-webhook
// Receives events from the Evolution API webhook and:
//  1. Creates/updates a whatsapp_conversation
//  2. Saves the message in whatsapp_conversation_messages
//  3. Tries to link the phone number to a patient
//  4. Broadcasts via Supabase Realtime (automatic via insert)
//
// Webhook URL to configure in Evolution API:
//   https://<supabase-project>.supabase.co/functions/v1/evolution-webhook
//
// Evolution API auth: pass the clinic's evolution_api_key as
// the "apikey" header on the webhook configuration.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalise to digits only (no +, spaces, etc.) */
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Parse Evolution API payload ──────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Evolution API sends different event types. We only care about MESSAGE events.
  const event = payload.event as string | undefined;
  if (!event || !event.includes("MESSAGE")) {
    return json({ ok: true, skipped: true });
  }

  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return json({ ok: true, skipped: true });

  // Only process messages that came FROM the contact (not from us)
  const key = data.key as Record<string, unknown> | undefined;
  const fromMe = key?.fromMe as boolean | undefined;
  if (fromMe) return json({ ok: true, skipped: "outgoing" });

  const instanceName = payload.instance as string | undefined;
  if (!instanceName) return json({ error: "Missing instance" }, 400);

  const rawPhone = (key?.remoteJid as string | undefined)?.replace("@s.whatsapp.net", "") ?? "";
  if (!rawPhone) return json({ error: "Missing phone" }, 400);

  const phoneNumber = normalisePhone(rawPhone);

  // Extract message text
  const message = data.message as Record<string, unknown> | undefined;
  let content =
    (message?.conversation as string) ??
    (message?.extendedTextMessage as Record<string, unknown>)?.text as string ??
    (message?.imageMessage as Record<string, unknown>)?.caption as string ??
    "[Mídia recebida]";
  content = String(content);

  const pushName = data.pushName as string | undefined;

  // ── Supabase client ──────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Identify clinic by instance name ────────────────────
  const { data: waCfg, error: cfgErr } = await (supabase as any)
    .from("whatsapp_config")
    .select("clinic_id, evolution_instance")
    .eq("evolution_instance", instanceName)
    .eq("provider", "evolution")
    .eq("is_active", true)
    .maybeSingle();

  if (cfgErr || !waCfg) {
    console.warn("[evolution-webhook] No active clinic found for instance:", instanceName);
    return json({ ok: true, skipped: "no_clinic" });
  }

  const clinicId: string = waCfg.clinic_id;

  // ── Try to link to a patient ─────────────────────────────
  const { data: patientRows } = await (supabase as any)
    .from("pacientes")
    .select("id, nome")
    .eq("clinic_id", clinicId)
    .or(`whatsapp.ilike.%${phoneNumber}%,telefone.ilike.%${phoneNumber}%`)
    .limit(1);

  const patient = (patientRows as Array<{ id: string; nome: string }>)?.[0] ?? null;

  // ── Upsert conversation ──────────────────────────────────
  const { data: conv, error: convErr } = await (supabase as any)
    .from("whatsapp_conversations")
    .upsert(
      {
        clinic_id: clinicId,
        phone_number: phoneNumber,
        patient_id: patient?.id ?? null,
        contact_name: pushName ?? patient?.nome ?? phoneNumber,
        last_message_at: new Date().toISOString(),
        last_message_preview: content.slice(0, 100),
      },
      {
        onConflict: "clinic_id,phone_number",
        ignoreDuplicates: false,
      }
    )
    .select("id, unread_count")
    .single();

  if (convErr || !conv) {
    console.error("[evolution-webhook] upsert conversation error:", convErr);
    return json({ error: "DB error" }, 500);
  }

  // Increment unread count
  await (supabase as any)
    .from("whatsapp_conversations")
    .update({ unread_count: (conv.unread_count ?? 0) + 1 })
    .eq("id", conv.id);

  // ── Insert message ───────────────────────────────────────
  const externalId = (key?.id as string) ?? null;

  await (supabase as any).from("whatsapp_conversation_messages").insert({
    conversation_id: conv.id,
    direction: "incoming",
    content,
    message_id_external: externalId,
  });

  return json({ ok: true, conversation_id: conv.id });
});
