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
        const results: any[] = [];
        
        // 1. pagamentos
        try {
            let q1 = supabase
                .from("pagamentos")
                .select("id, valor, data_pagamento, data_vencimento, origem_tipo, status, forma_pagamento:formas_pagamento(nome_forma), observacoes, created_at, paciente_id, pacientes(nome)")
                .order("created_at", { ascending: false });
            if (clinicId) q1 = q1.eq("clinic_id", clinicId);
            const { data: pgtos, error: err1 } = await q1;
            
            if (err1) {
                console.error("Error fetching 'pagamentos':", err1);
            } else {
                (pgtos || []).forEach((p: any) => {
                    results.push({
                        id: p.id,
                        valor: Number(p.valor),
                        data_pagamento: p.data_pagamento,
                        data_vencimento: p.data_vencimento,
                        status: p.status,
                        forma_pagamento: p.forma_pagamento?.nome_forma || "—",
                        descricao: p.observacoes || "—",
                        created_at: p.created_at,
                        paciente_nome: p.pacientes?.nome ?? "—",
                        origem_tipo: p.origem_tipo,
                        source_table: "pagamentos",
                    });
                });
            }
        } catch (e) {
            console.error("Critical error in 'pagamentos' fetch:", e);
        }

        // 2. pagamentos_mensalidade
        try {
            let q2 = supabase
                .from("pagamentos_mensalidade")
                .select("id, valor, data_pagamento, status, mes_referencia, forma_pagamento_id, observacoes, created_at, paciente_id, pacientes(nome)")
                .order("created_at", { ascending: false });
            if (clinicId) q2 = q2.eq("clinic_id", clinicId);
            const { data: mensalidades, error: err2 } = await q2;
            
            if (err2) {
                console.error("Error fetching 'pagamentos_mensalidade':", err2);
            } else {
                (mensalidades || []).forEach((m: any) => {
                    results.push({
                        id: m.id,
                        valor: Number(m.valor),
                        data_pagamento: m.data_pagamento,
                        data_vencimento: m.mes_referencia,
                        status: m.status ?? "aberto",
                        forma_pagamento: m.forma_pagamento_id,
                        descricao: `Mensalidade - ${m.mes_referencia}`,
                        created_at: m.created_at ?? "",
                        paciente_nome: m.pacientes?.nome ?? "—",
                        origem_tipo: "mensalidade",
                        source_table: "pagamentos_mensalidade",
                    });
                });
            }
        } catch (e) {
            console.error("Critical error in 'pagamentos_mensalidade' fetch:", e);
        }

        // 3. pagamentos_sessoes
        try {
            let q3 = supabase
                .from("pagamentos_sessoes")
                .select("id, valor, data_pagamento, status, observacoes, created_at, paciente_id, forma_pagamento_id, pacientes(nome)")
                .order("created_at", { ascending: false });
            if (clinicId) q3 = q3.eq("clinic_id", clinicId);
            const { data: sessoes, error: err3 } = await q3;
            
            if (err3) {
                console.error("Error fetching 'pagamentos_sessoes':", err3);
            } else {
                (sessoes || []).forEach((s: any) => {
                    results.push({
                        id: s.id,
                        valor: Number(s.valor),
                        data_pagamento: s.status === "pago" ? s.data_pagamento : null,
                        data_vencimento: s.status === "pago" ? null : s.data_pagamento,
                        status: s.status ?? "aberto",
                        forma_pagamento: s.forma_pagamento_id,
                        descricao: s.observacoes || "Sessão avulsa",
                        created_at: s.created_at ?? "",
                        paciente_nome: s.pacientes?.nome ?? "—",
                        origem_tipo: "sessao",
                        source_table: "pagamentos_sessoes",
                    });
                });
            }
        } catch (e) {
            console.error("Critical error in 'pagamentos_sessoes' fetch:", e);
        }

        return results.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    }

};
