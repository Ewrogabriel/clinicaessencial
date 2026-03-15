import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";

/** Column lists (avoids SELECT *). */
const PAGAMENTO_COLUMNS =
    "id, paciente_id, profissional_id, plano_id, matricula_id, agendamento_id, origem_tipo, valor, status, data_vencimento, data_pagamento, descricao, observacoes, forma_pagamento, clinic_id, created_at" as const;

const FORMA_PAGAMENTO_COLUMNS =
    "id, nome, tipo, ativo, ordem" as const;

const MENSALIDADE_COLUMNS =
    "id, paciente_id, valor, status, mes_referencia, data_pagamento" as const;

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
     * Only 'pendente' payments with an expired data_vencimento are affected.
     */
    async markPaymentOverdue(id: string): Promise<void> {
        try {
            const today = new Date().toISOString().split("T")[0];
            const { data: current, error: fetchError } = await supabase
                .from("pagamentos")
                .select("id, status, data_vencimento")
                .eq("id", id)
                .single();
            if (fetchError) throw fetchError;
            if (!current || current.status !== "pendente") {
                throw new Error("Apenas pagamentos pendentes podem ser marcados como vencidos.");
            }
            if (!current.data_vencimento || current.data_vencimento > today) {
                throw new Error("O pagamento ainda não está vencido.");
            }

            const { error } = await supabase
                .from("pagamentos")
                .update({ status: "vencido" } as any)
                .eq("id", id);
            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao marcar pagamento como vencido.");
            throw error;
        }
    },

    /**
     * Calls the DB function mark_overdue_pagamentos() which bulk-updates all
     * 'pendente' payments with expired data_vencimento to 'vencido'.
     * Returns the number of payments updated.
     */
    async syncOverduePagamentos(): Promise<number> {
        try {
            const { data, error } = await supabase.rpc("mark_overdue_pagamentos");
            if (error) throw error;
            return (data as number) ?? 0;
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

            const { error } = await supabase.from("pagamentos").insert({
                paciente_id: params.pacienteId,
                profissional_id: params.profissionalId,
                agendamento_id: params.agendamentoId,
                valor: params.valor,
                status: "pendente",
                data_pagamento: new Date().toISOString().split("T")[0],
                data_vencimento: new Date().toISOString().split("T")[0],
                descricao,
                origem_tipo: "sessao_avulsa",
                clinic_id: params.clinicId,
                created_by: params.createdBy,
            });

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao registrar pagamento da sessão avulsa.");
            throw error;
        }
    },
};
