import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { Paciente, PacienteBasic } from "@/types/entities";

export interface ApprovePreCadastroParams {
    preCadastroId: string;
    preCadastroData: {
        nome: string;
        cpf?: string | null;
        rg?: string | null;
        telefone: string;
        email?: string | null;
        data_nascimento?: string | null;
        cep?: string | null;
        rua?: string | null;
        numero?: string | null;
        complemento?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        estado?: string | null;
        tipo_atendimento?: string | null;
        observacoes?: string | null;
        tem_responsavel_legal?: boolean;
        responsavel_nome?: string | null;
        responsavel_cpf?: string | null;
        responsavel_telefone?: string | null;
        responsavel_email?: string | null;
        responsavel_parentesco?: string | null;
    };
    activeClinicId: string | null;
    createdBy: string;
    revisadoPor: string;
}

export interface ApprovePreCadastroResult {
    patient: Paciente;
    codigoAcesso: string;
}

/**
 * Column list for full patient queries.
 * Matches the Paciente interface (avoids SELECT *).
 */
const PATIENT_COLUMNS =
    "id, nome, email, telefone, cpf, data_nascimento, status, tipo_atendimento, profissional_id, user_id, observacoes, foto_url, created_at, updated_at" as const;

export const patientService = {
    async getPatients(activeClinicId: string | null, status: "ativo" | "inativo" = "ativo"): Promise<Paciente[]> {
        try {
            if (activeClinicId) {
                const { data: clinicPacientes, error: cpError } = await supabase
                    .from("clinic_pacientes")
                    .select("paciente_id")
                    .eq("clinic_id", activeClinicId);

                if (cpError) throw cpError;

                const ids = clinicPacientes?.map((cp) => cp.paciente_id) ?? [];
                if (!ids.length) return [];

                const { data, error } = await supabase
                    .from("pacientes")
                    .select(PATIENT_COLUMNS)
                    .in("id", ids)
                    .eq("status", status)
                    .order("nome");

                if (error) throw error;
                return (data || []) as Paciente[];
            }

            const { data, error } = await supabase
                .from("pacientes")
                .select(PATIENT_COLUMNS)
                .eq("status", status)
                .order("nome");

            if (error) throw error;
            return (data || []) as Paciente[];
        } catch (error) {
            handleError(error, "Erro ao buscar lista de pacientes.");
            return [];
        }
    },

    async getPatientBasic(activeClinicId: string | null, status: "ativo" | "inativo" = "ativo"): Promise<PacienteBasic[]> {
        try {
            if (activeClinicId) {
                const { data: clinicPacientes, error: cpError } = await supabase
                    .from("clinic_pacientes")
                    .select("paciente_id")
                    .eq("clinic_id", activeClinicId);

                if (cpError) throw cpError;

                const ids = clinicPacientes?.map((cp) => cp.paciente_id) ?? [];
                if (!ids.length) return [];

                const { data, error } = await supabase
                    .from("pacientes")
                    .select("id, nome")
                    .in("id", ids)
                    .eq("status", status)
                    .order("nome");

                if (error) throw error;
                return data as PacienteBasic[];
            }

            const { data, error } = await supabase
                .from("pacientes")
                .select("id, nome")
                .eq("status", status)
                .order("nome");

            if (error) throw error;
            return data as PacienteBasic[];
        } catch (error) {
            handleError(error, "Erro ao buscar lista básica de pacientes.");
            return [];
        }
    },

    async getPatientById(id: string): Promise<Paciente | null> {
        try {
            const { data, error } = await supabase
                .from("pacientes")
                .select(PATIENT_COLUMNS)
                .eq("id", id)
                .single();

            if (error) throw error;
            return data as Paciente;
        } catch (error) {
            handleError(error, "Erro ao buscar detalhes do paciente.");
            return null;
        }
    },

    /**
     * Migrates an approved pre-registration to the main patient list.
     * Creates the patient record, links to clinic, and marks the pre-cadastro as approved.
     */
    async approvePreCadastro(params: ApprovePreCadastroParams): Promise<ApprovePreCadastroResult> {
        const { preCadastroId, preCadastroData, activeClinicId, createdBy, revisadoPor } = params;

        // Generate a random access code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let codigoAcesso = "";
        for (let i = 0; i < 8; i++) codigoAcesso += chars.charAt(Math.floor(Math.random() * chars.length));

        // Create patient record
        const { data: newPatient, error: patientError } = await (supabase.from("pacientes") as any).insert({
            nome: preCadastroData.nome,
            cpf: preCadastroData.cpf || null,
            rg: preCadastroData.rg || null,
            telefone: preCadastroData.telefone,
            email: preCadastroData.email || null,
            data_nascimento: preCadastroData.data_nascimento || null,
            cep: preCadastroData.cep || null,
            rua: preCadastroData.rua || null,
            numero: preCadastroData.numero || null,
            complemento: preCadastroData.complemento || null,
            bairro: preCadastroData.bairro || null,
            cidade: preCadastroData.cidade || null,
            estado: preCadastroData.estado || null,
            tipo_atendimento: preCadastroData.tipo_atendimento || "fisioterapia",
            observacoes: preCadastroData.observacoes || null,
            tem_responsavel_legal: preCadastroData.tem_responsavel_legal || false,
            responsavel_nome: preCadastroData.responsavel_nome || null,
            responsavel_cpf: preCadastroData.responsavel_cpf || null,
            responsavel_telefone: preCadastroData.responsavel_telefone || null,
            responsavel_email: preCadastroData.responsavel_email || null,
            responsavel_parentesco: preCadastroData.responsavel_parentesco || null,
            created_by: createdBy,
            profissional_id: createdBy,
            clinic_id: activeClinicId,
            codigo_acesso: codigoAcesso,
            status: "ativo",
        }).select().single();

        if (patientError) throw patientError;

        // Link patient to clinic
        if (activeClinicId && newPatient?.id) {
            const { error: linkError } = await supabase.from("clinic_pacientes").insert({
                clinic_id: activeClinicId,
                paciente_id: newPatient.id,
            });
            if (linkError) throw new Error(`Erro ao vincular paciente à clínica: ${linkError.message}`);
        }

        // Mark pre-cadastro as approved
        const { error: updateError } = await (supabase.from("pre_cadastros") as any)
            .update({ status: "aprovado", revisado_por: revisadoPor })
            .eq("id", preCadastroId);

        if (updateError) throw updateError;

        return { patient: newPatient as Paciente, codigoAcesso };
    },

    async getPatientByUserId(userId: string): Promise<Paciente | null> {
        try {
            const { data, error } = await supabase
                .from("pacientes")
                .select(PATIENT_COLUMNS)
                .eq("user_id", userId)
                .maybeSingle();

            if (error) throw error;
            return data as Paciente | null;
        } catch (error) {
            handleError(error, "Erro ao buscar paciente por user_id.");
            return null;
        }
    },
};
