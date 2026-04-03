// ─── PaymentHistoryTab local types ────────────────────────────────────────────

export interface PaymentEntry {
  id: string;
  source_table: "pagamentos" | "pagamentos_mensalidade" | "pagamentos_sessoes" | "matriculas" | "planos";
  data_pagamento: string | null;
  data_vencimento: string | null;
  descricao: string;
  status: string;
  forma_pagamento: string | null;
  valor: number;
  origem_tipo: string;
  observacoes?: string | null;
  bank_transaction_id?: string | null;
  bank_status?: string | null;
  bank_data_conciliacao?: string | null;
  created_at: string;
  dias_atraso?: number;
  profissional?: string | null;
  mes_referencia?: string | null;
}

export interface PaymentHistoryTabProps {
  pacienteId: string;
  pacienteNome: string;
}

export interface FilterState {
  searchText: string;
  filterForma: string;
  filterPeriodo: string;
  filterStatus: string;
  filterTipo: string;
}

export interface PaymentSummary {
  totalDebito: number;
  totalPago: number;
  saldo: number;
  totalPendente: number;
  totalAtrasado: number;
}
