import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import { UnifiedPayment, Payment, Tables } from "@/types/database.types";

/** Column lists (avoids SELECT *). */
const PAGAMENTO_COLUMNS =
    "id, paciente_id, profissional_id, plano_id, valor, status, data_vencimento, data_pagamento, descricao, observacoes, forma_pagamento, clinic_id, created_at" as const;

const FORMA_PAGAMENTO_COLUMNS =
    "id, nome, tipo, ativo, ordem" as const;

const MENSALIDADE_COLUMNS =
    "id, paciente_id, valor, status, mes_referencia, data_pagamento, data_vencimento, clinic_id" as const;

const SESSAO_PAGAMENTO_COLUMNS =
    "id, paciente_id, agendamento_id, valor, status, data_pagamento, created_at" as const;

export type ConfigPixEntry = {
    forma_pagamento_id: string;
    chave_pix: string | null;
    tipo_chave: string | null;
    nome_beneficiario: string | null;
};

export const financeService = {
    async getPatientPendencias(patientId: string) {
        try {
            const { data, error } = await supabase
                .from("pagamentos")
                .select(PAGAMENTO_COLUMNS)
                .eq("paciente_id", patientId)
                .eq("status", "pendente")
                .order("data_vencimento", { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar pendências do paciente.");
            return [];
        }
    },

    async getFormasPagamento() {
        try {
            const { data, error } = await supabase
                .from("formas_pagamento")
                .select(FORMA_PAGAMENTO_COLUMNS)
                .eq("ativo", true)
                .order("ordem");

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar formas de pagamento.");
            return [];
        }
    },

    async getPagamentosMensalidade(patientId: string) {
        try {
            const { data, error } = await supabase
                .from("pagamentos_mensalidade")
                .select(MENSALIDADE_COLUMNS)
                .eq("paciente_id", patientId)
                .order("mes_referencia", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar mensalidades.");
            return [];
        }
    },

    async getPagamentosSessoes(patientId: string) {
        try {
            const { data, error } = await supabase
                .from("pagamentos_sessoes")
                .select(SESSAO_PAGAMENTO_COLUMNS)
                .eq("paciente_id", patientId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar pagamentos de sessões.");
            return [];
        }
    },

    async getConfigPix() {
        try {
            const { data, error } = await supabase
                .from("config_pix")
                .select("forma_pagamento_id, chave_pix, tipo_chave, nome_beneficiario");

            if (error) throw error;

            const map: Record<string, ConfigPixEntry> = {};
            (data || []).forEach((p) => {
                map[p.forma_pagamento_id] = p;
            });
            return map;
        } catch (error) {
            handleError(error, "Erro ao buscar configuração PIX.");
            return {} as Record<string, ConfigPixEntry>;
        }
    },

    /**
     * Refund a confirmed payment by setting its status to 'reembolsado'.
     * Only 'pago' payments can be refunded. Throws if the payment is not
     * in the 'pago' state to prevent invalid state transitions.
     */
    async refundPayment(id: string): Promise<void> {
        try {
            // Guard: only allow refund of paid payments
            const { data: current, error: fetchError } = await supabase
                .from("pagamentos")
                .select("id, status")
                .eq("id", id)
                .single();
            if (fetchError) throw fetchError;
            if (!current || current.status !== "pago") {
                throw new Error("Apenas pagamentos com status 'pago' podem ser reembolsados.");
            }

            const { error } = await supabase
                .from("pagamentos")
                .update({ status: "reembolsado" } as any)
                .eq("id", id);
            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao reembolsar pagamento.");
            throw error;
        }
    },

    /**
     * Mark a single pending payment as overdue ('vencido').
     * Since 'vencido' is not a DB enum value, overdue status is computed
     * at read time by comparing data_vencimento with today's date.
     * This method is a no-op kept for backward compatibility.
     */
    async markPaymentOverdue(_id: string): Promise<void> {
        // Overdue status is computed at read time, not stored in DB.
        // The status_pagamento enum only supports: pendente, pago, cancelado.
        return;
    },

    /**
     * Calls the DB function mark_overdue_pagamentos() which bulk-updates all
     * 'pendente' payments with expired data_vencimento to 'vencido'.
     * Returns the number of payments updated.
     */
    async syncOverduePagamentos(): Promise<number> {
        try {
            const { data, error } = await supabase.rpc("mark_overdue_pagamentos" as any);
            if (error) throw error;
            return (data as unknown as number) ?? 0;
        } catch (error) {
            handleError(error, "Erro ao sincronizar pagamentos vencidos.");
            return 0;
        }
    },

    /** Manually create a sessão avulsa payment linked to an appointment.
     *  Called from the frontend as a fallback when the DB trigger cannot run
     *  (e.g. the appointment was already 'realizado' before the trigger was added).
     */
    async createSessaoAvulsaPayment(params: {
        pacienteId: string;
        profissionalId: string;
        agendamentoId: string;
        valor: number;
        tipoAtendimento: string;
        dataHorario: string;
        clinicId: string | null;
        createdBy: string;
    }): Promise<void> {
        try {
            const descricao = `Sessão Avulsa - ${params.tipoAtendimento} - ${new Date(params.dataHorario).toLocaleDateString("pt-BR")} ${new Date(params.dataHorario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

            const { error } = await supabase.from("pagamentos_sessoes").insert({
                paciente_id: params.pacienteId,
                agendamento_id: params.agendamentoId,
                valor: params.valor,
                status: "pendente",
                data_pagamento: new Date(params.dataHorario).toISOString(),
                observacoes: descricao,
                clinic_id: params.clinicId,
            } as any);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao registrar pagamento da sessão avulsa.");
            throw error;
        }
    },

    async getUnifiedPayments(clinicId: string | null): Promise<UnifiedPayment[]> {
        if (!clinicId) return [];
        // Agora podemos usar a view unificada em vez de 4 chamadas gigantes,
        // E só trazemos os que NÂO estão 'pago' para a Previsão/Forecast.
        // Eliminando o download massivo do histórico na carga inicial!
        const { data, error } = await (supabase as any)
            .from("vw_unified_payments")
            .select("*")
            .eq("clinic_id", clinicId)
            .neq("status", "pago")
            .order("data_vencimento", { ascending: true });

        if (error) {
            console.error("Error fetching forecast unified payments:", error);
            return [];
        }

        // Mapear os campos para o formato esperado pelo frontend
        return ((data as any[]) || []).map((row: any) => ({
            ...row,
            valor: Number(row.valor),
            origem_tipo: row.origem_tipo,
            source_table: row.source_table,
            paciente_nome: row.paciente_nome ?? "—",
        }));
    },

    async getPaginatedUnifiedPayments(params: {
        page: number;
        pageSize: number;
        filterMes: string;
        filterForma: string;
        filterOrigem: string;
        filterPaciente: string;
        clinicId: string | null;
    }) {
        let query: any = (supabase as any).from("vw_unified_payments").select("*", { count: "exact" });

        if (params.clinicId) {
            query = query.eq("clinic_id", params.clinicId);
        }

        // Apply filters
        if (params.filterMes && params.filterMes !== "all") {
            const [yStr, mStr] = params.filterMes.split('-');
            const y = Number(yStr);
            const m = Number(mStr);
            // Last day of the month (day 0 of next month)
            const lastDay = new Date(y, m, 0).getDate();
            const mm = mStr.padStart(2, '0');
            const dd = String(lastDay).padStart(2, '0');
            query = query.or(`data_pagamento.gte.${y}-${mm}-01,data_vencimento.gte.${y}-${mm}-01,created_at.gte.${y}-${mm}-01`);
            query = query.or(`data_pagamento.lte.${y}-${mm}-${dd},data_vencimento.lte.${y}-${mm}-${dd},created_at.lte.${y}-${mm}-${dd}`);
        }
        if (params.filterForma && params.filterForma !== "all") {
            query = query.ilike("forma_pagamento", `%${params.filterForma}%`);
        }
        if (params.filterOrigem && params.filterOrigem !== "all") {
            query = query.eq("origem_tipo", params.filterOrigem);
        }
        if (params.filterPaciente && params.filterPaciente !== "") {
            query = query.ilike("paciente_nome", `%${params.filterPaciente}%`);
        }

        // Only paid items are shown in the main pagamentos list
        query = query.eq("status", "pago");

        // Pagination
        const from = (params.page - 1) * params.pageSize;
        const to = from + params.pageSize - 1;

        query = query.order("data_pagamento", { ascending: false }).range(from, to);

        const { data, count, error } = await query;
        if (error) {
            console.error("Error fetching paginated unified payments:", error);
            throw error;
        }

        return {
            data: (data as any[]) || [],
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / params.pageSize),
        };
    },

    async bulkConfirmPayments(payments: { id: string, source_table: string }[], forma_pagamento_id: string, data_pagamento: string) {
        if (!payments || payments.length === 0) return 0;
        
        let confirmedCount = 0;
        for (const payment of payments) {
             const table = payment.source_table as "pagamentos" | "pagamentos_mensalidade" | "pagamentos_sessoes";
             try {
                if (table === "pagamentos") {
                    const formasData = await this.getFormasPagamento();
                    const tipo = formasData.find(f => f.id === forma_pagamento_id)?.tipo ?? "pix";
                    
                    const TIPO_TO_FORMA_ENUM: Record<string, string> = {
                        pix: "pix", dinheiro: "dinheiro", boleto: "boleto",
                        transferencia: "transferencia", cartao: "cartao_credito",
                        cartao_credito: "cartao_credito", cartao_debito: "cartao_debito", cheque: "transferencia",
                    };
                    const formaEnum = TIPO_TO_FORMA_ENUM[tipo] ?? "pix";
                    const { error } = await supabase.from("pagamentos").update({ status: "pago", data_pagamento, forma_pagamento: formaEnum as any }).eq("id", payment.id);
                    if (!error) confirmedCount++;
                } else if (table === "pagamentos_mensalidade") {
                    const { error } = await supabase.from("pagamentos_mensalidade").update({ status: "pago", data_pagamento, forma_pagamento_id: forma_pagamento_id || null }).eq("id", payment.id);
                    if (!error) {
                         confirmedCount++;
                         // Note: We skip commission release here for bulk to avoid massive function calls.
                         // Commission engine will run on a trigger or sync soon.
                    }
                } else if (table === "pagamentos_sessoes") {
                    const { error } = await supabase.from("pagamentos_sessoes").update({ status: "pago", data_pagamento, forma_pagamento_id: forma_pagamento_id || null }).eq("id", payment.id);
                    if (!error) confirmedCount++;
                } else if (payment.source_table === "agendamentos") {
                     // Since this isn't a payment table initially, we skip it for bulk.
                     // A user should confirm these individually. Or we could insert them, but it's risky
                     // without patient info.
                     console.warn("Skipping bulk insertion of agendamentos.");
                }
             } catch(err) {
                 console.error("Bulk confirm error for item", payment.id, err);
             }
        }
        return confirmedCount;
    },

    async getFinanceKPIs(clinicId: string | null) {
        if (!clinicId) return null;
        const { data, error } = await (supabase as any).rpc("get_finance_kpis", { p_clinic_id: clinicId });
        if (error) {
            console.error("Error fetching finance KPIs:", error);
            throw error;
        }
        return data as unknown as {
            totalRecebido: number;
            totalPendente: number;
            totalDespesas: number;
            totalComissoes: number;
            countPagos: number;
            countPendentes: number;
            countVencidos: number;
            valorVencidos: number;
            countReembolsados: number;
            valorReembolsados: number;
            lucroLiquido: number;
        };
    }
};
