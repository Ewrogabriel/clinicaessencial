export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agenda_extra: {
        Row: {
          created_at: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          max_pacientes: number
          motivo: string | null
          profissional_id: string
        }
        Insert: {
          created_at?: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          max_pacientes?: number
          motivo?: string | null
          profissional_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          max_pacientes?: number
          motivo?: string | null
          profissional_id?: string
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          cancellation_justification: string | null
          cancellation_reason: string | null
          checkin_paciente: boolean | null
          checkin_paciente_at: string | null
          checkin_profissional: boolean | null
          checkin_profissional_at: string | null
          clinic_id: string | null
          confirmacao_enviada_at: string | null
          confirmacao_presenca: string | null
          confirmacao_respondida_at: string | null
          created_at: string | null
          created_by: string
          data_horario: string
          dias_semana: number[] | null
          duracao_minutos: number
          enrollment_id: string | null
          frequencia_semanal: number | null
          id: string
          justification_status: string | null
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          recorrencia_fim: string | null
          recorrencia_grupo_id: string | null
          recorrente: boolean
          replaces_agendamento_id: string | null
          rescheduled_from_id: string | null
          status: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento: string
          tipo_sessao: Database["public"]["Enums"]["tipo_sessao"]
          updated_at: string | null
          valor_mensal: number | null
          valor_sessao: number | null
        }
        Insert: {
          cancellation_justification?: string | null
          cancellation_reason?: string | null
          checkin_paciente?: boolean | null
          checkin_paciente_at?: string | null
          checkin_profissional?: boolean | null
          checkin_profissional_at?: string | null
          clinic_id?: string | null
          confirmacao_enviada_at?: string | null
          confirmacao_presenca?: string | null
          confirmacao_respondida_at?: string | null
          created_at?: string | null
          created_by: string
          data_horario: string
          dias_semana?: number[] | null
          duracao_minutos?: number
          enrollment_id?: string | null
          frequencia_semanal?: number | null
          id?: string
          justification_status?: string | null
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          recorrencia_fim?: string | null
          recorrencia_grupo_id?: string | null
          recorrente?: boolean
          replaces_agendamento_id?: string | null
          rescheduled_from_id?: string | null
          status?: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento?: string
          tipo_sessao?: Database["public"]["Enums"]["tipo_sessao"]
          updated_at?: string | null
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Update: {
          cancellation_justification?: string | null
          cancellation_reason?: string | null
          checkin_paciente?: boolean | null
          checkin_paciente_at?: string | null
          checkin_profissional?: boolean | null
          checkin_profissional_at?: string | null
          clinic_id?: string | null
          confirmacao_enviada_at?: string | null
          confirmacao_presenca?: string | null
          confirmacao_respondida_at?: string | null
          created_at?: string | null
          created_by?: string
          data_horario?: string
          dias_semana?: number[] | null
          duracao_minutos?: number
          enrollment_id?: string | null
          frequencia_semanal?: number | null
          id?: string
          justification_status?: string | null
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          recorrencia_fim?: string | null
          recorrencia_grupo_id?: string | null
          recorrente?: boolean
          replaces_agendamento_id?: string | null
          rescheduled_from_id?: string | null
          status?: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento?: string
          tipo_sessao?: Database["public"]["Enums"]["tipo_sessao"]
          updated_at?: string | null
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_saas_status"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_replaces_agendamento_id_fkey"
            columns: ["replaces_agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          clinic_id: string
          created_at: string
          day_of_week: number
          duration_min: number
          end_time: string
          id: string
          is_active: boolean
          max_capacity: number
          professional_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          day_of_week: number
          duration_min?: number
          end_time: string
          id?: string
          is_active?: boolean
          max_capacity?: number
          professional_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          day_of_week?: number
          duration_min?: number
          end_time?: string
          id?: string
          is_active?: boolean
          max_capacity?: number
          professional_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agendamento_id: string | null
          clinic_id: string
          commission_pct: number | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          mes_referencia: string | null
          missed_pct_applied: number | null
          observacoes: string | null
          payment_id: string | null
          professional_id: string
          session_value: number | null
          status: string
          status_liberacao: string | null
          tipo_calculo: string | null
          updated_at: string | null
          valor: number
          valor_fixo_regra: number | null
        }
        Insert: {
          agendamento_id?: string | null
          clinic_id: string
          commission_pct?: number | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          mes_referencia?: string | null
          missed_pct_applied?: number | null
          observacoes?: string | null
          payment_id?: string | null
          professional_id: string
          session_value?: number | null
          status?: string
          status_liberacao?: string | null
          tipo_calculo?: string | null
          updated_at?: string | null
          valor?: number
          valor_fixo_regra?: number | null
        }
        Update: {
          agendamento_id?: string | null
          clinic_id?: string
          commission_pct?: number | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          mes_referencia?: string | null
          missed_pct_applied?: number | null
          observacoes?: string | null
          payment_id?: string | null
          professional_id?: string
          session_value?: number | null
          status?: string
          status_liberacao?: string | null
          tipo_calculo?: string | null
          updated_at?: string | null
          valor?: number
          valor_fixo_regra?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pagamentos_mensalidade"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          categoria: string | null
          clinic_id: string
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          id: string
          status: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          clinic_id: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          id?: string
          status?: string
          updated_at?: string | null
          valor?: number
        }
        Update: {
          categoria?: string | null
          clinic_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          status?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: []
      }
      fechamentos_comissao: {
        Row: {
          bonus_descricao: string | null
          bonus_valor: number | null
          clinic_id: string | null
          compensacao_anterior: number | null
          created_at: string
          data_pagamento: string | null
          descricao_compensacao: string | null
          despesa_id: string | null
          fechado_por: string | null
          id: string
          mes_referencia: string
          profissional_id: string | null
          status: string | null
          total_atendimentos: number | null
          total_comissao: number | null
          total_valor: number | null
          updated_at: string
          valor_final: number | null
        }
        Insert: {
          bonus_descricao?: string | null
          bonus_valor?: number | null
          clinic_id?: string | null
          compensacao_anterior?: number | null
          created_at?: string
          data_pagamento?: string | null
          descricao_compensacao?: string | null
          despesa_id?: string | null
          fechado_por?: string | null
          id?: string
          mes_referencia: string
          profissional_id?: string | null
          status?: string | null
          total_atendimentos?: number | null
          total_comissao?: number | null
          total_valor?: number | null
          updated_at?: string
          valor_final?: number | null
        }
        Update: {
          bonus_descricao?: string | null
          bonus_valor?: number | null
          clinic_id?: string | null
          compensacao_anterior?: number | null
          created_at?: string
          data_pagamento?: string | null
          descricao_compensacao?: string | null
          despesa_id?: string | null
          fechado_por?: string | null
          id?: string
          mes_referencia?: string
          profissional_id?: string | null
          status?: string | null
          total_atendimentos?: number | null
          total_comissao?: number | null
          total_valor?: number | null
          updated_at?: string
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_comissao_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_comissao_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_saas_status"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "fechamentos_comissao_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_saas_status: {
        Row: {
          clinic_id: string | null
          clinic_name: string | null
          current_period_end: string | null
          has_bi: boolean | null
          has_premium_agenda: boolean | null
          max_patients: number | null
          max_professionals: number | null
          plan_name: string | null
          subscription_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      // Functions truncated for brevity in this scratch step, but included in full file
    }
    Enums: {
      app_role: "admin" | "profissional" | "gestor" | "paciente" | "master"
      forma_pagamento:
        | "dinheiro"
        | "pix"
        | "cartao_credito"
        | "cartao_debito"
        | "boleto"
        | "transferencia"
      status_agendamento:
        | "agendado"
        | "confirmado"
        | "realizado"
        | "cancelado"
        | "falta"
        | "reposicao"
      status_paciente: "ativo" | "inativo"
      status_pagamento: "pendente" | "pago" | "cancelado"
      status_plano:
        | "ativo"
        | "vencido"
        | "cancelado"
        | "finalizado"
        | "suspenso"
      tipo_sessao: "individual" | "grupo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
