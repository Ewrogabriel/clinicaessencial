import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  bankAccountId?: string;
  status?: string;
  tipo?: string;
  pacienteSearch?: string;
}

export interface ReportRow {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  categoria: string | null;
  banco: string;
  paciente?: string;
  pagamento_id: string | null;
  data_conciliacao: string | null;
}

export interface ReconciliationReport {
  rows: ReportRow[];
  summary: {
    total: number;
    conciliados: number;
    pendentes: number;
    rejeitados: number;
    totalValue: number;
    reconciledValue: number;
    taxaReconciliacao: number;
  };
  period: { from: string; to: string };
}

export const reportingService = {
  /**
   * Generate reconciliation report data.
   */
  async generateReport(
    clinicId: string,
    filters: ReportFilters = {}
  ): Promise<ReconciliationReport> {
    try {
      let q = (supabase as any)
        .from("bank_transactions")
        .select(
          `id, data_transacao, descricao, valor, tipo, status, categoria, pagamento_id, data_conciliacao,
           bank_accounts!bank_account_id(banco_nome)`
        )
        .eq("clinic_id", clinicId)
        .order("data_transacao", { ascending: false });

      if (filters.dateFrom) q = q.gte("data_transacao", filters.dateFrom);
      if (filters.dateTo) q = q.lte("data_transacao", filters.dateTo);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      if (filters.status && filters.status !== "todos") q = q.eq("status", filters.status);
      if (filters.tipo && filters.tipo !== "todos") q = q.eq("tipo", filters.tipo);

      const { data, error } = await q;
      if (error) throw error;

      const rows: ReportRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        data_transacao: r.data_transacao,
        descricao: r.descricao,
        valor: r.valor,
        tipo: r.tipo ?? "",
        status: r.status ?? "pendente",
        categoria: r.categoria,
        banco: r.bank_accounts?.banco_nome ?? "N/A",
        pagamento_id: r.pagamento_id,
        data_conciliacao: r.data_conciliacao,
      }));

      const conciliados = rows.filter((r) => r.status === "conciliado");
      const pendentes = rows.filter((r) => r.status === "pendente" || !r.status);
      const rejeitados = rows.filter((r) => r.status === "rejeitado");

      return {
        rows,
        summary: {
          total: rows.length,
          conciliados: conciliados.length,
          pendentes: pendentes.length,
          rejeitados: rejeitados.length,
          totalValue: rows.reduce((s, r) => s + Math.abs(Number(r.valor)), 0),
          reconciledValue: conciliados.reduce((s, r) => s + Math.abs(Number(r.valor)), 0),
          taxaReconciliacao: rows.length > 0 ? (conciliados.length / rows.length) * 100 : 0,
        },
        period: {
          from: filters.dateFrom ?? "",
          to: filters.dateTo ?? "",
        },
      };
    } catch (error) {
      handleError(error, "Erro ao gerar relatório");
      throw error;
    }
  },

  /**
   * Export report as CSV string.
   */
  exportCSV(report: ReconciliationReport): string {
    const headers = [
      "ID",
      "Data",
      "Descrição",
      "Valor",
      "Tipo",
      "Status",
      "Categoria",
      "Banco",
      "ID Pagamento",
      "Data Conciliação",
    ];

    const rows = report.rows.map((r) =>
      [
        r.id,
        r.data_transacao,
        `"${r.descricao.replace(/"/g, '""')}"`,
        r.valor.toFixed(2),
        r.tipo,
        r.status,
        r.categoria ?? "",
        r.banco,
        r.pagamento_id ?? "",
        r.data_conciliacao ?? "",
      ].join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  },

  /**
   * Export report as JSON string.
   */
  exportJSON(report: ReconciliationReport): string {
    return JSON.stringify(report, null, 2);
  },

  /**
   * Trigger a browser download.
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
