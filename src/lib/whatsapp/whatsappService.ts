// ============================================================
// WhatsApp Business Integration – API Service
// Wraps the Meta WhatsApp Business Cloud API with retry logic,
// basic rate-limiting, phone validation, and error handling.
// ============================================================

import type {
  MessageType,
  TemplateParams,
  WhatsAppApiResponse,
  ConnectionTestResult,
} from "@/modules/whatsapp/types";

// ── Constants ────────────────────────────────────────────────

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
/** Minimum milliseconds between API calls to the same phone_number_id. */
const RATE_LIMIT_INTERVAL_MS = 1000;

// ── Rate-limiter (in-memory, per service instance) ───────────

class RateLimiter {
  private lastCallAt: number = 0;

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallAt;
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await delay(RATE_LIMIT_INTERVAL_MS - elapsed);
    }
    this.lastCallAt = Date.now();
  }
}

// ── Helpers ──────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
  delayMs = INITIAL_RETRY_DELAY_MS
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      // 429 Too Many Requests → always retry; 5xx → retry; others → return as-is
      if (response.status === 429 || (response.status >= 500 && attempt < retries)) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delayMs * attempt;
        await delay(waitMs);
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      await delay(delayMs * attempt);
    }
  }
  // Should never reach here
  throw new Error("Máximo de tentativas atingido ao chamar a API do WhatsApp.");
}

// ── WhatsAppService class ────────────────────────────────────

export class WhatsAppService {
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly rateLimiter: RateLimiter;

  constructor(token: string, phoneNumberId: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.rateLimiter = new RateLimiter();
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Sends a free-form text message to a WhatsApp number.
   * Use for custom/interpolated messages that don't rely on pre-approved templates.
   */
  async sendMessage(
    phoneNumber: string,
    _messageType: MessageType,
    content: string
  ): Promise<string> {
    const normalized = this.validatePhoneNumber(phoneNumber);

    await this.rateLimiter.throttle();

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalized,
      type: "text",
      text: { preview_url: false, body: content },
    };

    const response = await fetchWithRetry(
      `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const json: WhatsAppApiResponse = await response.json();

    if (!response.ok || json.error) {
      const msg = json.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`WhatsApp API error: ${msg}`);
    }

    const messageId = json.messages?.[0]?.id;
    if (!messageId) throw new Error("WhatsApp API não retornou um ID de mensagem.");
    return messageId;
  }

  /**
   * Sends a pre-approved WhatsApp template message.
   * `params.variables` are passed as positional body components.
   */
  async sendTemplate(params: TemplateParams): Promise<string> {
    const normalized = this.validatePhoneNumber(params.phoneNumber);

    await this.rateLimiter.throttle();

    const components = Object.values(params.variables).map((value) => ({
      type: "text",
      text: value,
    }));

    const body = {
      messaging_product: "whatsapp",
      to: normalized,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: "pt_BR" },
        components: components.length > 0
          ? [{ type: "body", parameters: components }]
          : [],
      },
    };

    const response = await fetchWithRetry(
      `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const json: WhatsAppApiResponse = await response.json();

    if (!response.ok || json.error) {
      const msg = json.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`WhatsApp API error (template): ${msg}`);
    }

    const messageId = json.messages?.[0]?.id;
    if (!messageId) throw new Error("WhatsApp API não retornou um ID de mensagem de template.");
    return messageId;
  }

  /**
   * Queries the status of a previously sent message.
   * Returns null when the message cannot be found.
   */
  async getMessageStatus(messageId: string): Promise<string | null> {
    await this.rateLimiter.throttle();

    const response = await fetchWithRetry(
      `${GRAPH_API_BASE}/${messageId}?fields=status`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    if (!response.ok) return null;

    const json: { status?: string } = await response.json();
    return json.status ?? null;
  }

  /**
   * Validates and normalises a phone number into E.164 format.
   * Strips spaces, dashes, parentheses and ensures a leading "+".
   * Throws if the resulting string is not a valid phone number.
   */
  validatePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-().]/g, "");
    const e164 = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
    const valid = /^\+[0-9]{7,15}$/.test(e164);
    if (!valid) {
      throw new Error(`Número de telefone inválido: "${phone}". Use o formato E.164 (ex: +5511999999999).`);
    }
    return e164;
  }

  // ── Static factory / connection test ──────────────────────

  /**
   * Tests a set of credentials by calling the Phone Number API endpoint.
   * Does not require an existing WhatsAppService instance.
   */
  static async testConnection(token: string, phoneNumberId: string): Promise<ConnectionTestResult> {
    try {
      const response = await fetchWithRetry(
        `${GRAPH_API_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
        2 // fewer retries for connectivity tests
      );

      if (!response.ok) {
        const json: WhatsAppApiResponse = await response.json().catch(() => ({}));
        return {
          success: false,
          phoneNumberId: null,
          displayPhoneNumber: null,
          error: json.error?.message ?? `HTTP ${response.status}`,
        };
      }

      const json: { id?: string; display_phone_number?: string } = await response.json();
      return {
        success: true,
        phoneNumberId: json.id ?? phoneNumberId,
        displayPhoneNumber: json.display_phone_number ?? null,
        error: null,
      };
    } catch (err) {
      return {
        success: false,
        phoneNumberId: null,
        displayPhoneNumber: null,
        error: err instanceof Error ? err.message : "Erro desconhecido ao testar conexão.",
      };
    }
  }
}
