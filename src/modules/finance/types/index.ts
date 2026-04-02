export type BancoType =
  | "inter"
  | "nubank"
  | "bradesco"
  | "itau"
  | "santander"
  | "bbrasil"
  | "caixa"
  | "sicoob"
  | "sicredi"
  | "outro";

export const BANCO_OPTIONS: { value: BancoType; label: string; codigo: string }[] = [
  { value: "inter", label: "Banco Inter", codigo: "077" },
  { value: "nubank", label: "Nubank", codigo: "260" },
  { value: "bradesco", label: "Bradesco", codigo: "237" },
  { value: "itau", label: "Itaú", codigo: "341" },
  { value: "santander", label: "Santander", codigo: "033" },
  { value: "bbrasil", label: "Banco do Brasil", codigo: "001" },
  { value: "caixa", label: "Caixa Econômica Federal", codigo: "104" },
  { value: "sicoob", label: "Sicoob", codigo: "756" },
  { value: "sicredi", label: "Sicredi", codigo: "748" },
  { value: "outro", label: "Outro", codigo: "000" },
];

export interface BankAccount {
  id: string;
  clinic_id: string | null;
  banco_codigo: string;
  banco_nome: string;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  apelido: string | null;
  ativo: boolean | null;
  api_enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateBankAccountDTO {
  clinic_id: string;
  banco_codigo: string;
  banco_nome: string;
  agencia?: string;
  conta?: string;
  tipo?: string;
  apelido?: string;
  ativo?: boolean;
}

export interface ReviewEntry {
  action: "approve" | "reject" | "match" | "unmatch";
  reviewer_id: string;
  timestamp: string;
  note?: string | null;
}

export interface MatchResult {
  payment_id: string;
  confidence: number; // 0–100
  reason: string;
}

export interface BankStatementTransaction {
  data_transacao: string;
  descricao: string;
  valor: number;
  documento?: string;
  saldo?: number;
  tipo?: "credito" | "debito";
  dados_originais?: Record<string, unknown>;
}

export interface ImportValidationResult {
  valid: BankStatementTransaction[];
  invalid: Array<{ row: number; reason: string; raw: unknown }>;
  total: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  batchId: string;
}
