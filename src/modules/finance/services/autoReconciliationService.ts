import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import { matchingService } from "./matchingService";

export interface AutoReconcileResult {
  reconciled: number;
  suggested: number;
  skipped: number;
  logs: AutoReconcileLog[];
}

export interface AutoReconcileLog {
  transactionId: string;
  paymentId: string | null;
  score: number;
  action: "reconciled" | "suggested" | "skipped";
  reason: string;
}

export const autoReconciliationService = {
  /**
   * Run the auto-reconciliation process for a clinic.
   * - score >= threshold: auto-reconcile
   * - score >= 80: suggest (notify)
   * - score < 80: skip
   */
  async runAutoReconcile(
    clinicId: string,
    autoThreshold: number = 95,
    userId: string = "system"
  ): Promise<AutoReconcileResult> {
    const result: AutoReconcileResult = {
      reconciled: 0,
      suggested: 0,
      skipped: 0,
      logs: [],
    };

    try {
      // Fetch pending transactions
      const { data: transactions, error: txErr } = await (supabase as any)
        .from("bank_transactions")
        .select("*")
        .eq("clinic_id", clinicId)
        .in("status", ["pendente", null])
        .is("pagamento_id", null)
        .order("data_transacao", { ascending: false });

      if (txErr) throw txErr;
      if (!transactions?.length) return result;

      for (const tx of transactions) {
        try {
          const matches = await matchingService.findPossibleMatches(tx.id, 5);
          if (!matches.length) {
            result.skipped++;
            result.logs.push({
              transactionId: tx.id,
              paymentId: null,
              score: 0,
              action: "skipped",
              reason: "Sem sugestões de match",
            });
            continue;
          }

          const best = matches[0];
          const score = best.confianca * 100;

          if (score >= autoThreshold) {
            // Auto-reconcile
            await matchingService.manualMatch(
              tx.id,
              best.paymentId,
              `Auto-reconciliado (score: ${score.toFixed(0)}%)`,
            );

            // Log it
            await (supabase as any).from("auto_reconciliation_log").insert({
              clinic_id: clinicId,
              bank_transaction_id: tx.id,
              payment_id: best.paymentId,
              score,
              auto_reconciled: true,
              reason: `Auto-reconciliado (score: ${score.toFixed(0)}%)`,
              triggered_by: userId === "system" ? "cron" : "manual",
            });

            // Audit log
            await (supabase as any).from("audit_logs_reconciliation").insert({
              clinic_id: clinicId,
              user_id: null,
              action: "auto_reconcile",
              resource_type: "transaction",
              resource_id: tx.id,
              after_state: { payment_id: best.paymentId, score },
              reason: `Auto-reconciliado pelo sistema (score: ${score.toFixed(0)}%)`,
            });

            result.reconciled++;
            result.logs.push({
              transactionId: tx.id,
              paymentId: best.paymentId,
              score,
              action: "reconciled",
              reason: `Score ${score.toFixed(0)}% >= threshold ${autoThreshold}%`,
            });
          } else if (score >= 80) {
            // Suggest only
            await (supabase as any).from("auto_reconciliation_log").insert({
              clinic_id: clinicId,
              bank_transaction_id: tx.id,
              payment_id: best.paymentId,
              score,
              auto_reconciled: false,
              reason: `Sugestão pendente de revisão (score: ${score.toFixed(0)}%)`,
              triggered_by: "auto",
            });

            result.suggested++;
            result.logs.push({
              transactionId: tx.id,
              paymentId: best.paymentId,
              score,
              action: "suggested",
              reason: `Score ${score.toFixed(0)}% – revisão necessária`,
            });
          } else {
            result.skipped++;
            result.logs.push({
              transactionId: tx.id,
              paymentId: best.paymentId,
              score,
              action: "skipped",
              reason: `Score ${score.toFixed(0)}% muito baixo`,
            });
          }
        } catch {
          result.skipped++;
        }
      }

      return result;
    } catch (error) {
      handleError(error, "Erro na reconciliação automática");
      return result;
    }
  },

  /**
   * Get today's auto-reconciliation stats.
   */
  async getTodayStats(clinicId: string): Promise<{
    autoReconciled: number;
    suggested: number;
    totalProcessed: number;
  }> {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await (supabase as any)
        .from("auto_reconciliation_log")
        .select("auto_reconciled")
        .eq("clinic_id", clinicId)
        .gte("timestamp", today);
      if (error) throw error;
      const rows = data ?? [];
      return {
        autoReconciled: rows.filter((r: any) => r.auto_reconciled).length,
        suggested: rows.filter((r: any) => !r.auto_reconciled).length,
        totalProcessed: rows.length,
      };
    } catch {
      return { autoReconciled: 0, suggested: 0, totalProcessed: 0 };
    }
  },
};
