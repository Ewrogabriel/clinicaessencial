export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface AiGatewayErrorResponse {
  error: string;
  message: string;
}

export function validateApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    console.error("LOVABLE_API_KEY not configured");
    throw new Error("API_KEY_MISSING");
  }
  return key;
}

export function handleAiGatewayError(
  status: number,
  errorText: string,
): AiGatewayErrorResponse {
  console.error(`AI Gateway error: ${status}`, errorText);
  switch (status) {
    case 429:
      return {
        error: "RATE_LIMIT",
        message:
          "Limite de requisições atingido. Tente novamente em alguns segundos.",
      };
    case 402:
      return {
        error: "CREDITS_INSUFFICIENT",
        message:
          "Créditos insuficientes. Adicione créditos ao seu workspace.",
      };
    case 401:
      return {
        error: "AUTH_ERROR",
        message: "Erro de autenticação com o serviço de IA.",
      };
    case 500:
      return {
        error: "SERVER_ERROR",
        message: "Erro no serviço de IA. Tente novamente.",
      };
    default:
      return {
        error: "UNKNOWN_ERROR",
        message: "Erro desconhecido no serviço de IA.",
      };
  }
}

export function createValidationError(message: string): AiGatewayErrorResponse {
  return { error: "INVALID_INPUT", message };
}
