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
        
        // 1. pagamentos (Manual, Planos, etc.)
        try {
            let q1 = supabase
                .from("pagamentos")
                .select("id, valor, data_pagamento, data_vencimento, status, forma_pagamento, descricao, observacoes, created_at, paciente_id, pacientes(nome), plano_id")
                .order("created_at", { ascending: false });
            if (clinicId) q1 = q1.eq("clinic_id", clinicId);
            const { data: pgtos, error: err1 } = await q1;
            
            if (err1) {
                console.error("Error fetching 'pagamentos':", err1);
            } else {
                (pgtos || []).forEach((p: any) => {
                    const formaLabel: Record<string, string> = {
                        pix: "PIX", dinheiro: "Dinheiro", boleto: "Boleto",
                        cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
                        transferencia: "Transferência",
                    };
                    results.push({
                        ...p,
                        valor: Number(p.valor),
                        forma_pagamento: formaLabel[p.forma_pagamento] || p.forma_pagamento || "—",
                        descricao: p.descricao || p.observacoes || (p.plano_id ? "Plano de Sessões" : "Pagamento Manual"),
                        paciente_nome: p.pacientes?.nome ?? "—",
                        origem_tipo: p.plano_id ? "plano" : "manual",
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
                .select("id, valor, data_pagamento, status, mes_referencia, forma_pagamento_id, observacoes, created_at, paciente_id, pacientes(nome), matricula_id")
                .order("created_at", { ascending: false });
            if (clinicId) q2 = q2.eq("clinic_id", clinicId);
            const { data: mensalidades, error: err2 } = await q2;
            
            if (err2) {
                console.error("Error fetching 'pagamentos_mensalidade':", err2);
            } else {
                (mensalidades || []).forEach((m: any) => {
                    results.push({
                        ...m,
                        valor: Number(m.valor),
                        data_vencimento: m.mes_referencia,
                        status: m.status ?? "aberto",
                        forma_pagamento: m.forma_pagamento_id || "—",
                        descricao: `Mensalidade - ${m.mes_referencia}`,
                        paciente_nome: m.pacientes?.nome ?? "—",
                        origem_tipo: "mensalidade",
                        source_table: "pagamentos_mensalidade",
                    });
                });
            }
        } catch (e) {
            console.error("Critical error in 'pagamentos_mensalidade' fetch:", e);
        }

        // 2.1 Forecast for active matriculas (Virtual Mensualities)
        try {
            const currentMonth = new Date().toISOString().substring(0, 7);
            let qMatriculas = supabase
                .from("matriculas")
                .select("id, paciente_id, valor_mensal, data_inicio, status, pacientes(nome)")
                .eq("status", "ativo");
            if (clinicId) qMatriculas = qMatriculas.eq("clinic_id", clinicId);
            
            const { data: activeMatriculas, error: errM } = await qMatriculas;
            if (!errM && activeMatriculas) {
                activeMatriculas.forEach((m: any) => {
                    // Check if a payment for current month already exists in results
                    const hasPayment = results.some(r => 
                        r.source_table === "pagamentos_mensalidade" && 
                        r.matricula_id === m.id && 
                        r.mes_referencia === currentMonth
                    );
                    
                    if (!hasPayment) {
                        results.push({
                            id: `virtual-m-${m.id}-${currentMonth}`,
                            valor: Number(m.valor_mensal),
                            data_pagamento: null,
                            data_vencimento: `${currentMonth}-10`, // Suggest 10th as default
                            status: "pendente",
                            forma_pagamento: "—",
                            descricao: `Mensalidade Prevista - ${currentMonth}`,
                            created_at: new Date().toISOString(),
                            paciente_nome: m.pacientes?.nome ?? "—",
                            paciente_id: m.paciente_id,
                            matricula_id: m.id,
                            origem_tipo: "mensalidade",
                            source_table: "matriculas_virtual",
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Error in virtual monthly forecast:", e);
        }

        // 3. pagamentos_sessoes (Sessões Avulsas REALIZADAS)
        try {
            let q3 = supabase
                .from("pagamentos_sessoes")
                .select("id, valor, data_pagamento, status, observacoes, created_at, paciente_id, forma_pagamento_id, pacientes(nome), agendamento_id")
                .order("created_at", { ascending: false });
            if (clinicId) q3 = q3.eq("clinic_id", clinicId);
            const { data: sessoes, error: err3 } = await q3;
            
            if (err3) {
                console.error("Error fetching 'pagamentos_sessoes':", err3);
            } else {
                (sessoes || []).forEach((s: any) => {
                    results.push({
                        ...s,
                        valor: Number(s.valor),
                        data_vencimento: s.status === "pago" ? null : s.data_pagamento,
                        status: s.status ?? "aberto",
                        forma_pagamento: s.forma_pagamento_id || "—",
                        descricao: s.observacoes || "Sessão avulsa",
                        paciente_nome: s.pacientes?.nome ?? "—",
                        origem_tipo: "sessao",
                        source_table: "pagamentos_sessoes",
                    });
                });
            }
        } catch (e) {
            console.error("Critical error in 'pagamentos_sessoes' fetch:", e);
        }

        // 4. agendamentos com valor (Previsão de Sessões FUTURAS)
        try {
            let q4 = supabase
                .from("agendamentos")
                .select("id, valor_sessao, data_horario, status, tipo_sessao, paciente_id, pacientes(nome), enrollment_id")
                // Pegar qualquer agendamento que não esteja realizado/cancelado
                .neq("status", "realizado")
                .neq("status", "cancelado")
                // Filtramos por sessões que não são Matrícula (que já tratamos no Forecast 2.1)
                .neq("tipo_sessao", "sessao_matricula")
                .order("data_horario", { ascending: false });
            if (clinicId) q4 = q4.eq("clinic_id", clinicId);
            const { data: upcoming, error: err4 } = await q4;

            if (err4) {
                console.error("Error fetching upcoming appointments for forecast:", err4);
            } else {
                (upcoming || []).forEach((u: any) => {
                    // Evitar duplicidade com pagamentos_sessoes
                    const alreadyHasPayment = results.some(r => r.agendamento_id === u.id);
                    if (!alreadyHasPayment) {
                        const isPlano = u.tipo_sessao === "sessao_plano";
                        results.push({
                            id: u.id,
                            valor: Number(u.valor_sessao || 0),
                            data_pagamento: null,
                            data_vencimento: u.data_horario,
                            status: "pendente",
                            forma_pagamento: "—",
                            descricao: isPlano ? `Sessão Plano (${u.pacientes?.nome})` : `Sessão Avulsa (${u.tipo_sessao})`,
                            created_at: u.data_horario,
                            paciente_nome: u.pacientes?.nome ?? "—",
                            paciente_id: u.paciente_id,
                            agendamento_id: u.id,
                            origem_tipo: isPlano ? "plano" : "sessao",
                            source_table: "agendamentos",
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Critical error in 'agendamentos' forecast fetch:", e);
        }

        return results.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    }

};
