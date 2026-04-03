/**
 * Investment Detection Service
 * Automatically detects and classifies investment transactions
 */

// Minimum value to consider a transaction as a potential investment
const INVESTMENT_VALUE_THRESHOLD = 1000;

// Keywords that suggest a transaction is an investment application (DEBIT)
const DEBIT_KEYWORDS = [
  "aplicação", "aplicacao", "investimento", "cdb", "tesouro", "lci", "lca",
  "fundo", "aporte", "compra", "renda fixa", "poupança", "poupanca",
  "debenture", "debênture", "cri", "cra", "fii", "ações", "acoes",
  "previdência", "previdencia", "pgbl", "vgbl",
];

// Keywords that suggest a transaction is a redemption/yield (CREDIT)
const CREDIT_KEYWORDS = [
  "resgate", "rendimento", "juros", "crédito", "credito",
  "dividendo", "jcp", "reembolso", "liquidação", "liquidacao",
  "vencimento", "retorno", "yield",
];

export type InvestmentMovementType =
  | "aplicacao"
  | "resgate"
  | "rendimento"
  | "taxa"
  | "aporte"
  | "dividendo";

export interface InvestmentDetectionResult {
  isLikelyInvestment: boolean;
  movementType: InvestmentMovementType | null;
  suggestedType: string[];
  confidence: number; // 0-100
  reason: string;
}

/**
 * Check if a transaction description/value looks like an investment
 */
export function isLikelyInvestment(
  description: string,
  value: number
): boolean {
  const result = detectInvestment(description, value);
  return result.isLikelyInvestment;
}

/**
 * Full detection with details
 */
export function detectInvestment(
  description: string,
  value: number
): InvestmentDetectionResult {
  const lower = description.toLowerCase();
  const absValue = Math.abs(value);
  const isCredit = value > 0;

  // Check keywords
  const debitMatch = DEBIT_KEYWORDS.filter((kw) => lower.includes(kw));
  const creditMatch = CREDIT_KEYWORDS.filter((kw) => lower.includes(kw));
  const hasKeyword = debitMatch.length > 0 || creditMatch.length > 0;

  // Value heuristic: > INVESTMENT_VALUE_THRESHOLD could be an investment
  const isHighValue = absValue >= INVESTMENT_VALUE_THRESHOLD;

  // Determine if investment
  const isLikelyInvestment = hasKeyword || isHighValue;

  if (!isLikelyInvestment) {
    return {
      isLikelyInvestment: false,
      movementType: null,
      suggestedType: [],
      confidence: 0,
      reason: "Nenhum indicador de investimento detectado",
    };
  }

  // Classify movement type
  let movementType: InvestmentMovementType | null = null;
  let confidence = 0;
  let reason = "";

  if (creditMatch.length > 0) {
    if (lower.includes("dividendo") || lower.includes("jcp")) {
      movementType = "dividendo";
      confidence = 90;
      reason = `Detectado: ${creditMatch.join(", ")}`;
    } else if (lower.includes("rendimento") || lower.includes("juros")) {
      movementType = "rendimento";
      confidence = 85;
      reason = `Detectado: ${creditMatch.join(", ")}`;
    } else {
      movementType = "resgate";
      confidence = 80;
      reason = `Detectado: ${creditMatch.join(", ")}`;
    }
  } else if (debitMatch.length > 0) {
    if (lower.includes("aporte")) {
      movementType = "aporte";
      confidence = 90;
      reason = `Detectado: ${debitMatch.join(", ")}`;
    } else {
      movementType = "aplicacao";
      confidence = 85;
      reason = `Detectado: ${debitMatch.join(", ")}`;
    }
  } else if (isHighValue) {
    movementType = isCredit ? "resgate" : "aplicacao";
    confidence = 40;
    reason = `Valor alto (R$ ${absValue.toFixed(2)}) sugere investimento`;
  }

  const suggestedType = suggestInvestmentType(description);

  return {
    isLikelyInvestment: true,
    movementType,
    suggestedType,
    confidence,
    reason,
  };
}

/**
 * Classify movement type from description and direction
 */
export function classifyMovement(
  description: string,
  isCredit: boolean
): InvestmentMovementType {
  const lower = description.toLowerCase();

  if (lower.includes("dividendo") || lower.includes("jcp")) return "dividendo";
  if (lower.includes("rendimento") || lower.includes("juros")) return "rendimento";
  if (lower.includes("taxa") || lower.includes("administração") || lower.includes("administracao"))
    return "taxa";
  if (lower.includes("resgate")) return "resgate";
  if (lower.includes("aporte")) return "aporte";

  return isCredit ? "resgate" : "aplicacao";
}

/**
 * Suggest investment types based on description
 */
export function suggestInvestmentType(description: string): string[] {
  const lower = description.toLowerCase();
  const suggestions: string[] = [];

  if (lower.includes("cdb")) suggestions.push("CDB");
  if (lower.includes("lci")) suggestions.push("LCI");
  if (lower.includes("lca")) suggestions.push("LCA");
  if (lower.includes("tesouro")) {
    if (lower.includes("selic")) suggestions.push("Tesouro Selic");
    else if (lower.includes("ipca")) suggestions.push("Tesouro IPCA+");
    else if (lower.includes("prefixado")) suggestions.push("Tesouro Prefixado");
    else suggestions.push("Tesouro Direto");
  }
  if (lower.includes("fundo") || lower.includes("fund")) {
    if (lower.includes("imob") || lower.includes("fii")) suggestions.push("Fundo Imobiliário");
    else if (lower.includes("di")) suggestions.push("Fundo DI");
    else suggestions.push("Fundo de Investimento");
  }
  if (lower.includes("ações") || lower.includes("acoes") || lower.includes("bolsa"))
    suggestions.push("Ações");
  if (lower.includes("cripto") || lower.includes("bitcoin") || lower.includes("btc"))
    suggestions.push("Criptomoedas");
  if (lower.includes("previdência") || lower.includes("previdencia") || lower.includes("pgbl") || lower.includes("vgbl"))
    suggestions.push("Previdência Privada");
  if (lower.includes("poupança") || lower.includes("poupanca")) suggestions.push("Poupança");
  if (lower.includes("debenture") || lower.includes("debênture")) suggestions.push("Debênture");

  // If no specific type detected but looks like investment, suggest common ones
  if (suggestions.length === 0) {
    suggestions.push("CDB", "Tesouro Direto", "LCI", "LCA");
  }

  return suggestions;
}

/**
 * Extract institution suggestion from description
 */
export function suggestInstitution(description: string): string[] {
  const lower = description.toLowerCase();
  const institutions: string[] = [];

  const knownBanks = [
    "itau", "itaú", "bradesco", "santander", "bb", "banco do brasil",
    "caixa", "nubank", "xp", "btg", "rico", "clear", "inter", "c6",
    "modal", "sicoob", "sicredi", "safra", "votorantim",
  ];

  for (const bank of knownBanks) {
    if (lower.includes(bank)) {
      institutions.push(bank.charAt(0).toUpperCase() + bank.slice(1));
    }
  }

  return institutions;
}

export const investmentDetectionService = {
  isLikelyInvestment,
  detectInvestment,
  classifyMovement,
  suggestInvestmentType,
  suggestInstitution,
};
