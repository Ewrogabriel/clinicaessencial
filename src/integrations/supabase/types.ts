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
      achievements: {
        Row: {
          ativo: boolean
          categoria: string
          condicao: Json
          created_at: string
          descricao: string
          icone: string
          id: string
          nome: string
          pontos: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          condicao: Json
          created_at?: string
          descricao: string
          icone: string
          id?: string
          nome: string
          pontos?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          condicao?: Json
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          nome?: string
          pontos?: number
        }
        Relationships: []
      }
      agenda_extra: {
        Row: {
          clinic_id: string | null
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          max_pacientes: number
          motivo: string | null
          profissional_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          max_pacientes?: number
          motivo?: string | null
          profissional_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          max_pacientes?: number
          motivo?: string | null
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_extra_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          checkin_paciente: boolean | null
          checkin_paciente_at: string | null
          checkin_profissional: boolean | null
          checkin_profissional_at: string | null
          clinic_id: string | null
          created_at: string
          created_by: string
          data_horario: string
          dias_semana: number[] | null
          duracao_minutos: number
          enrollment_id: string | null
          frequencia_semanal: number | null
          id: string
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          recorrencia_fim: string | null
          recorrencia_grupo_id: string | null
          recorrente: boolean
          status: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento: string
          tipo_sessao: Database["public"]["Enums"]["tipo_sessao"]
          updated_at: string
          valor_mensal: number | null
          valor_sessao: number | null
        }
        Insert: {
          checkin_paciente?: boolean | null
          checkin_paciente_at?: string | null
          checkin_profissional?: boolean | null
          checkin_profissional_at?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by: string
          data_horario: string
          dias_semana?: number[] | null
          duracao_minutos?: number
          enrollment_id?: string | null
          frequencia_semanal?: number | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          recorrencia_fim?: string | null
          recorrencia_grupo_id?: string | null
          recorrente?: boolean
          status?: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento?: string
          tipo_sessao?: Database["public"]["Enums"]["tipo_sessao"]
          updated_at?: string
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Update: {
          checkin_paciente?: boolean | null
          checkin_paciente_at?: string | null
          checkin_profissional?: boolean | null
          checkin_profissional_at?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          data_horario?: string
          dias_semana?: number[] | null
          duracao_minutos?: number
          enrollment_id?: string | null
          frequencia_semanal?: number | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          recorrencia_fim?: string | null
          recorrencia_grupo_id?: string | null
          recorrente?: boolean
          status?: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento?: string
          tipo_sessao?: Database["public"]["Enums"]["tipo_sessao"]
          updated_at?: string
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
            foreignKeyName: "agendamentos_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          registro_id: string
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id: string
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id?: string
          tabela?: string
          user_id?: string | null
        }
        Relationships: []
      }
      avisos: {
        Row: {
          ativo: boolean
          clinic_id: string | null
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          mensagem: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinic_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          mensagem: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          mensagem?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_profissional: {
        Row: {
          clinic_id: string | null
          created_at: string
          data: string
          dia_inteiro: boolean
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          motivo: string | null
          profissional_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          data: string
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          profissional_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          data?: string
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_profissional_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_parceiros: {
        Row: {
          created_at: string
          created_by: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          descricao: string
          icone: string
          id: string
          meta: Json
          metric_type: string
          pontos_recompensa: number
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          descricao: string
          icone: string
          id?: string
          meta: Json
          metric_type?: string
          pontos_recompensa?: number
          tipo: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          descricao?: string
          icone?: string
          id?: string
          meta?: Json
          metric_type?: string
          pontos_recompensa?: number
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      clinic_group_members: {
        Row: {
          clinic_id: string
          created_at: string
          cross_booking_enabled: boolean | null
          group_id: string
          id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          cross_booking_enabled?: boolean | null
          group_id: string
          id?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          cross_booking_enabled?: boolean | null
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_group_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "clinic_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_groups: {
        Row: {
          ativo: boolean | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_pacientes: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          paciente_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          paciente_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          paciente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_pacientes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_pacientes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          nome: string
          numero: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          numero?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          numero?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      clinic_subscriptions: {
        Row: {
          clinic_id: string
          created_at: string
          data_inicio: string
          data_vencimento: string | null
          desconto_percentual: number | null
          id: string
          observacoes: string | null
          plan_id: string
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          data_inicio?: string
          data_vencimento?: string | null
          desconto_percentual?: number | null
          id?: string
          observacoes?: string | null
          plan_id: string
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          data_inicio?: string
          data_vencimento?: string | null
          desconto_percentual?: number | null
          id?: string
          observacoes?: string | null
          plan_id?: string
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "platform_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_users: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          nome: string
          numero: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome: string
          numero?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          numero?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agendamento_id: string | null
          clinic_id: string
          clinic_id_ref: string | null
          created_at: string
          id: string
          professional_id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          clinic_id: string
          clinic_id_ref?: string | null
          created_at?: string
          id?: string
          professional_id: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          agendamento_id?: string | null
          clinic_id?: string
          clinic_id_ref?: string | null
          created_at?: string
          id?: string
          professional_id?: string
          status?: string
          updated_at?: string
          valor?: number
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
            foreignKeyName: "commissions_clinic_id_ref_fkey"
            columns: ["clinic_id_ref"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_nfe: {
        Row: {
          aliquota_iss: number | null
          ambiente: string
          created_at: string | null
          id: string
          prestador_cnpj: string | null
          prestador_codigo_municipio: string | null
          prestador_inscricao_municipal: string | null
          servico_cnae: string | null
          servico_codigo_tributacao: string | null
          servico_discriminacao_padrao: string | null
          servico_item_lista: string | null
          updated_at: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          ambiente?: string
          created_at?: string | null
          id?: string
          prestador_cnpj?: string | null
          prestador_codigo_municipio?: string | null
          prestador_inscricao_municipal?: string | null
          servico_cnae?: string | null
          servico_codigo_tributacao?: string | null
          servico_discriminacao_padrao?: string | null
          servico_item_lista?: string | null
          updated_at?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          ambiente?: string
          created_at?: string | null
          id?: string
          prestador_cnpj?: string | null
          prestador_codigo_municipio?: string | null
          prestador_inscricao_municipal?: string | null
          servico_cnae?: string | null
          servico_codigo_tributacao?: string | null
          servico_discriminacao_padrao?: string | null
          servico_item_lista?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      config_pix: {
        Row: {
          chave_pix: string
          created_at: string | null
          forma_pagamento_id: string
          id: string
          nome_beneficiario: string
          tipo_chave: string
          updated_at: string | null
        }
        Insert: {
          chave_pix: string
          created_at?: string | null
          forma_pagamento_id: string
          id?: string
          nome_beneficiario: string
          tipo_chave: string
          updated_at?: string | null
        }
        Update: {
          chave_pix?: string
          created_at?: string | null
          forma_pagamento_id?: string
          id?: string
          nome_beneficiario?: string
          tipo_chave?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_pix_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          mensagem: string | null
          nome: string
          origem: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          mensagem?: string | null
          nome: string
          origem?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          mensagem?: string | null
          nome?: string
          origem?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contratos_digitais: {
        Row: {
          assinado_em: string | null
          assinatura_url: string | null
          clinic_id: string | null
          conteudo: string
          created_at: string
          created_by: string
          id: string
          paciente_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          assinatura_url?: string | null
          clinic_id?: string | null
          conteudo: string
          created_at?: string
          created_by: string
          id?: string
          paciente_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          assinatura_url?: string | null
          clinic_id?: string | null
          conteudo?: string
          created_at?: string
          created_by?: string
          id?: string
          paciente_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_digitais_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_digitais_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          created_by: string
          descricao: string | null
          email: string | null
          endereco: string | null
          id: string
          imagem_card_url: string | null
          imagem_descricao_url: string | null
          instagram: string | null
          nome: string
          site: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          imagem_card_url?: string | null
          imagem_descricao_url?: string | null
          instagram?: string | null
          nome: string
          site?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          imagem_card_url?: string | null
          imagem_descricao_url?: string | null
          instagram?: string | null
          nome?: string
          site?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      descontos_pacientes: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          id: string
          motivo: string | null
          paciente_id: string
          percentual_desconto: number
          preco_plano_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          id?: string
          motivo?: string | null
          paciente_id: string
          percentual_desconto?: number
          preco_plano_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          id?: string
          motivo?: string | null
          paciente_id?: string
          percentual_desconto?: number
          preco_plano_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "descontos_pacientes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descontos_pacientes_preco_plano_id_fkey"
            columns: ["preco_plano_id"]
            isOneToOne: false
            referencedRelation: "precos_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade_profissional: {
        Row: {
          ativo: boolean
          clinic_id: string | null
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          max_pacientes: number
          profissional_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinic_id?: string | null
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          max_pacientes?: number
          profissional_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string | null
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          max_pacientes?: number
          profissional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidade_profissional_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_clinicos: {
        Row: {
          clinic_id: string | null
          conteudo: string
          created_at: string
          dados_extras: Json | null
          id: string
          paciente_id: string
          profissional_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          conteudo?: string
          created_at?: string
          dados_extras?: Json | null
          id?: string
          paciente_id: string
          profissional_id: string
          tipo: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          conteudo?: string
          created_at?: string
          dados_extras?: Json | null
          id?: string
          paciente_id?: string
          profissional_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_clinicos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      emissoes_nf: {
        Row: {
          clinic_id: string | null
          created_at: string
          emitida: boolean | null
          emitida_em: string | null
          emitida_por: string | null
          focus_nfe_erro: string | null
          focus_nfe_ref: string | null
          focus_nfe_status: string | null
          id: string
          mes_referencia: string
          nf_pdf_url: string | null
          observacoes: string | null
          paciente_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          emitida?: boolean | null
          emitida_em?: string | null
          emitida_por?: string | null
          focus_nfe_erro?: string | null
          focus_nfe_ref?: string | null
          focus_nfe_status?: string | null
          id?: string
          mes_referencia: string
          nf_pdf_url?: string | null
          observacoes?: string | null
          paciente_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          emitida?: boolean | null
          emitida_em?: string | null
          emitida_por?: string | null
          focus_nfe_erro?: string | null
          focus_nfe_ref?: string | null
          focus_nfe_status?: string | null
          id?: string
          mes_referencia?: string
          nf_pdf_url?: string | null
          observacoes?: string | null
          paciente_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "emissoes_nf_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emissoes_nf_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      entradas_estoque: {
        Row: {
          created_at: string
          created_by: string
          data_entrada: string
          id: string
          observacoes: string | null
          produto_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          created_by: string
          data_entrada?: string
          id?: string
          observacoes?: string | null
          produto_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          data_entrada?: string
          id?: string
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          clinic_id: string | null
          cor: string | null
          created_at: string
          created_by: string
          data_aquisicao: string | null
          data_proxima_revisao: string | null
          data_ultima_revisao: string | null
          descricao: string | null
          e_consumo: boolean
          estoque_atual: number | null
          estoque_minimo: number | null
          foto_url: string | null
          id: string
          marca: string | null
          modelo: string | null
          nome: string
          observacoes_manutencao: string | null
          quantidade: number
          status: string
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          clinic_id?: string | null
          cor?: string | null
          created_at?: string
          created_by: string
          data_aquisicao?: string | null
          data_proxima_revisao?: string | null
          data_ultima_revisao?: string | null
          descricao?: string | null
          e_consumo?: boolean
          estoque_atual?: number | null
          estoque_minimo?: number | null
          foto_url?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          nome: string
          observacoes_manutencao?: string | null
          quantidade?: number
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          clinic_id?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string
          data_aquisicao?: string | null
          data_proxima_revisao?: string | null
          data_ultima_revisao?: string | null
          descricao?: string | null
          e_consumo?: boolean
          estoque_atual?: number | null
          estoque_minimo?: number | null
          foto_url?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          nome?: string
          observacoes_manutencao?: string | null
          quantidade?: number
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          antecedentes_pessoais: string | null
          clinic_id: string
          conduta_inicial: string | null
          created_at: string
          data_avaliacao: string
          historico_doenca: string | null
          id: string
          objetivos_tratamento: string | null
          paciente_id: string
          profissional_id: string
          queixa_principal: string
          updated_at: string
        }
        Insert: {
          antecedentes_pessoais?: string | null
          clinic_id: string
          conduta_inicial?: string | null
          created_at?: string
          data_avaliacao?: string
          historico_doenca?: string | null
          id?: string
          objetivos_tratamento?: string | null
          paciente_id: string
          profissional_id: string
          queixa_principal: string
          updated_at?: string
        }
        Update: {
          antecedentes_pessoais?: string | null
          clinic_id?: string
          conduta_inicial?: string | null
          created_at?: string
          data_avaliacao?: string
          historico_doenca?: string | null
          id?: string
          objetivos_tratamento?: string | null
          paciente_id?: string
          profissional_id?: string
          queixa_principal?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      evolutions: {
        Row: {
          assinatura_url: string | null
          clinic_id: string
          conduta: string | null
          created_at: string
          data_evolucao: string
          descricao: string
          id: string
          paciente_id: string
          profissional_id: string
          updated_at: string
        }
        Insert: {
          assinatura_url?: string | null
          clinic_id: string
          conduta?: string | null
          created_at?: string
          data_evolucao?: string
          descricao: string
          id?: string
          paciente_id: string
          profissional_id: string
          updated_at?: string
        }
        Update: {
          assinatura_url?: string | null
          clinic_id?: string
          conduta?: string | null
          created_at?: string
          data_evolucao?: string
          descricao?: string
          id?: string
          paciente_id?: string
          profissional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          categoria: string | null
          clinic_id: string
          clinic_id_ref: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          clinic_id: string
          clinic_id_ref?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          clinic_id?: string
          clinic_id_ref?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_clinic_id_ref_fkey"
            columns: ["clinic_id_ref"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_comissao: {
        Row: {
          bonus_descricao: string | null
          bonus_valor: number
          compensacao_anterior: number
          created_at: string
          descricao_compensacao: string | null
          fechado_por: string
          id: string
          mes_referencia: string
          profissional_id: string
          status: string
          total_atendimentos: number
          total_comissao: number
          total_valor: number
          updated_at: string
          valor_final: number
        }
        Insert: {
          bonus_descricao?: string | null
          bonus_valor?: number
          compensacao_anterior?: number
          created_at?: string
          descricao_compensacao?: string | null
          fechado_por: string
          id?: string
          mes_referencia: string
          profissional_id: string
          status?: string
          total_atendimentos?: number
          total_comissao?: number
          total_valor?: number
          updated_at?: string
          valor_final?: number
        }
        Update: {
          bonus_descricao?: string | null
          bonus_valor?: number
          compensacao_anterior?: number
          created_at?: string
          descricao_compensacao?: string | null
          fechado_por?: string
          id?: string
          mes_referencia?: string
          profissional_id?: string
          status?: string
          total_atendimentos?: number
          total_comissao?: number
          total_valor?: number
          updated_at?: string
          valor_final?: number
        }
        Relationships: []
      }
      feriados: {
        Row: {
          created_at: string
          created_by: string
          data: string
          descricao: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data: string
          descricao: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      ficha_requests: {
        Row: {
          created_at: string
          id: string
          motivo_rejeicao: string | null
          paciente_id: string
          pdf_available_until: string | null
          pdf_url: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          paciente_id: string
          pdf_available_until?: string | null
          pdf_url?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          paciente_id?: string
          pdf_available_until?: string | null
          pdf_url?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficha_requests_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      landing_content: {
        Row: {
          conteudo: Json
          id: string
          secao: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conteudo?: Json
          id?: string
          secao: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conteudo?: Json
          id?: string
          secao?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lista_espera: {
        Row: {
          clinic_id: string | null
          created_at: string
          dia_semana: number[] | null
          hora_preferida_fim: string | null
          hora_preferida_inicio: string | null
          id: string
          matricula_id: string | null
          notificado_em: string | null
          observacoes: string | null
          paciente_id: string
          profissional_id: string | null
          status: string
          tipo: string
          tipo_atendimento: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          dia_semana?: number[] | null
          hora_preferida_fim?: string | null
          hora_preferida_inicio?: string | null
          id?: string
          matricula_id?: string | null
          notificado_em?: string | null
          observacoes?: string | null
          paciente_id: string
          profissional_id?: string | null
          status?: string
          tipo?: string
          tipo_atendimento?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          dia_semana?: number[] | null
          hora_preferida_fim?: string | null
          hora_preferida_inicio?: string | null
          id?: string
          matricula_id?: string | null
          notificado_em?: string | null
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string | null
          status?: string
          tipo?: string
          tipo_atendimento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_espera_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_sections: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          imagem_url: string | null
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: string
          created_at?: string
          id?: string
          imagem_url?: string | null
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          imagem_url?: string | null
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          clinic_id: string | null
          conteudo: Json
          created_at: string | null
          created_by: string
          id: string
          plataforma: string | null
          tipo: string
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          conteudo?: Json
          created_at?: string | null
          created_by: string
          id?: string
          plataforma?: string | null
          tipo: string
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          conteudo?: Json
          created_at?: string | null
          created_by?: string
          id?: string
          plataforma?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          auto_renew: boolean
          cancellation_date: string | null
          clinic_id: string | null
          created_at: string
          criada_por: string
          data_inicio: string
          data_vencimento: string | null
          desconto: number | null
          due_day: number
          id: string
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          status: string
          tipo: string
          tipo_atendimento: string
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          auto_renew?: boolean
          cancellation_date?: string | null
          clinic_id?: string | null
          created_at?: string
          criada_por: string
          data_inicio?: string
          data_vencimento?: string | null
          desconto?: number | null
          due_day?: number
          id?: string
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          status?: string
          tipo?: string
          tipo_atendimento?: string
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          auto_renew?: boolean
          cancellation_date?: string | null
          clinic_id?: string | null
          created_at?: string
          criada_por?: string
          data_inicio?: string
          data_vencimento?: string | null
          desconto?: number | null
          due_day?: number
          id?: string
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          status?: string
          tipo?: string
          tipo_atendimento?: string
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mensagens_internas: {
        Row: {
          assunto: string
          conteudo: string
          created_at: string
          destinatario_id: string
          id: string
          lida: boolean
          remetente_id: string
        }
        Insert: {
          assunto: string
          conteudo: string
          created_at?: string
          destinatario_id: string
          id?: string
          lida?: boolean
          remetente_id: string
        }
        Update: {
          assunto?: string
          conteudo?: string
          created_at?: string
          destinatario_id?: string
          id?: string
          lida?: boolean
          remetente_id?: string
        }
        Relationships: []
      }
      metas_clinica: {
        Row: {
          clinic_id: string | null
          created_at: string
          created_by: string
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          meta_quantidade: number | null
          meta_valor: number | null
          status: string
          tipo: string
          titulo: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          created_by: string
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          meta_quantidade?: number | null
          meta_valor?: number | null
          status?: string
          tipo?: string
          titulo: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          meta_quantidade?: number | null
          meta_valor?: number | null
          status?: string
          tipo?: string
          titulo?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_clinica_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      modalidades: {
        Row: {
          ativo: boolean
          clinic_id: string | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinic_id?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modalidades_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          conteudo: string | null
          created_at: string
          id: string
          lida: boolean
          link: string | null
          metadata: Json | null
          resumo: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          metadata?: Json | null
          resumo: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          metadata?: Json | null
          resumo?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      paciente_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          paciente_id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          paciente_id: string
          session_token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          paciente_id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "paciente_sessions_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_acesso: string | null
          complemento: string | null
          convenio_id: string | null
          cpf: string | null
          created_at: string
          created_by: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          foto_url: string | null
          id: string
          identidade_genero: string | null
          lgpd_consentimento: boolean | null
          lgpd_consentimento_data: string | null
          nf_cnpj_cpf: string | null
          nf_email: string | null
          nf_endereco: string | null
          nf_inscricao_estadual: string | null
          nf_razao_social: string | null
          nome: string
          nome_social: string | null
          numero: string | null
          observacoes: string | null
          profissional_id: string | null
          responsavel_bairro: string | null
          responsavel_cep: string | null
          responsavel_cidade: string | null
          responsavel_complemento: string | null
          responsavel_cpf: string | null
          responsavel_email: string | null
          responsavel_endereco: string | null
          responsavel_estado: string | null
          responsavel_nome: string | null
          responsavel_numero: string | null
          responsavel_parentesco: string | null
          responsavel_rg: string | null
          responsavel_rua: string | null
          responsavel_telefone: string | null
          rg: string | null
          rua: string | null
          sexo: string | null
          solicita_nf: boolean | null
          status: Database["public"]["Enums"]["status_paciente"]
          telefone: string
          tem_responsavel_legal: boolean | null
          tipo_atendimento: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_acesso?: string | null
          complemento?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          identidade_genero?: string | null
          lgpd_consentimento?: boolean | null
          lgpd_consentimento_data?: string | null
          nf_cnpj_cpf?: string | null
          nf_email?: string | null
          nf_endereco?: string | null
          nf_inscricao_estadual?: string | null
          nf_razao_social?: string | null
          nome: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          profissional_id?: string | null
          responsavel_bairro?: string | null
          responsavel_cep?: string | null
          responsavel_cidade?: string | null
          responsavel_complemento?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_endereco?: string | null
          responsavel_estado?: string | null
          responsavel_nome?: string | null
          responsavel_numero?: string | null
          responsavel_parentesco?: string | null
          responsavel_rg?: string | null
          responsavel_rua?: string | null
          responsavel_telefone?: string | null
          rg?: string | null
          rua?: string | null
          sexo?: string | null
          solicita_nf?: boolean | null
          status?: Database["public"]["Enums"]["status_paciente"]
          telefone: string
          tem_responsavel_legal?: boolean | null
          tipo_atendimento?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_acesso?: string | null
          complemento?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          identidade_genero?: string | null
          lgpd_consentimento?: boolean | null
          lgpd_consentimento_data?: string | null
          nf_cnpj_cpf?: string | null
          nf_email?: string | null
          nf_endereco?: string | null
          nf_inscricao_estadual?: string | null
          nf_razao_social?: string | null
          nome?: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          profissional_id?: string | null
          responsavel_bairro?: string | null
          responsavel_cep?: string | null
          responsavel_cidade?: string | null
          responsavel_complemento?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_endereco?: string | null
          responsavel_estado?: string | null
          responsavel_nome?: string | null
          responsavel_numero?: string | null
          responsavel_parentesco?: string | null
          responsavel_rg?: string | null
          responsavel_rua?: string | null
          responsavel_telefone?: string | null
          rg?: string | null
          rua?: string | null
          sexo?: string | null
          solicita_nf?: boolean | null
          status?: Database["public"]["Enums"]["status_paciente"]
          telefone?: string
          tem_responsavel_legal?: boolean | null
          tipo_atendimento?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          clinic_id: string | null
          created_at: string
          created_by: string
          data_pagamento: string
          data_vencimento: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacoes: string | null
          paciente_id: string
          plano_id: string | null
          profissional_id: string
          status: Database["public"]["Enums"]["status_pagamento"]
          updated_at: string
          valor: number
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          created_by: string
          data_pagamento?: string
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          plano_id?: string | null
          profissional_id: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor?: number
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          data_pagamento?: string
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          plano_id?: string | null
          profissional_id?: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_mensalidade: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          data_pagamento: string | null
          forma_pagamento_id: string | null
          id: string
          matricula_id: string | null
          mes_referencia: string
          observacoes: string | null
          paciente_id: string
          status: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          matricula_id?: string | null
          mes_referencia: string
          observacoes?: string | null
          paciente_id: string
          status?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          matricula_id?: string | null
          mes_referencia?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_mensalidade_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_mensalidade_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_mensalidade_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_sessoes: {
        Row: {
          agendamento_id: string | null
          clinic_id: string | null
          created_at: string | null
          data_pagamento: string | null
          forma_pagamento_id: string | null
          id: string
          observacoes: string | null
          paciente_id: string
          status: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          status?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          agendamento_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_sessoes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_sessoes_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_achievements: {
        Row: {
          achievement_id: string
          desbloqueada_em: string
          id: string
          paciente_id: string
          visualizada: boolean
        }
        Insert: {
          achievement_id: string
          desbloqueada_em?: string
          id?: string
          paciente_id: string
          visualizada?: boolean
        }
        Update: {
          achievement_id?: string
          desbloqueada_em?: string
          id?: string
          paciente_id?: string
          visualizada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "patient_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_achievements_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_attachments: {
        Row: {
          created_at: string
          descricao: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          paciente_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          paciente_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          paciente_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_attachments_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_challenges: {
        Row: {
          challenge_id: string
          completado: boolean
          completado_em: string | null
          created_at: string
          id: string
          meta: number
          paciente_id: string
          progresso: number
          updated_at: string
        }
        Insert: {
          challenge_id: string
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          id?: string
          meta: number
          paciente_id: string
          progresso?: number
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          id?: string
          meta?: number
          paciente_id?: string
          progresso?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_challenges_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_points: {
        Row: {
          agendamento_id: string | null
          created_at: string
          descricao: string | null
          id: string
          origem: string
          paciente_id: string
          pontos: number
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          origem: string
          paciente_id: string
          pontos?: number
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          origem?: string
          paciente_id?: string
          pontos?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_points_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_points_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisa_satisfacao: {
        Row: {
          clinic_id: string | null
          comentario: string | null
          created_at: string
          id: string
          nota: number
          paciente_id: string
        }
        Insert: {
          clinic_id?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          paciente_id: string
        }
        Update: {
          clinic_id?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          paciente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_satisfacao_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisa_satisfacao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          created_at: string
          created_by: string
          data_inicio: string
          data_vencimento: string | null
          id: string
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          sessoes_utilizadas: number
          status: Database["public"]["Enums"]["status_plano"]
          tipo_atendimento: string
          total_sessoes: number
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          created_by: string
          data_inicio?: string
          data_vencimento?: string | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          sessoes_utilizadas?: number
          status?: Database["public"]["Enums"]["status_plano"]
          tipo_atendimento?: string
          total_sessoes?: number
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          data_inicio?: string
          data_vencimento?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          sessoes_utilizadas?: number
          status?: Database["public"]["Enums"]["status_plano"]
          tipo_atendimento?: string
          total_sessoes?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "planos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_plans: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string
          descricao: string | null
          destaque: boolean | null
          id: string
          max_clinicas: number | null
          max_pacientes: number | null
          max_profissionais: number | null
          nome: string
          recursos_disponiveis: Json | null
          updated_at: string
          validade_dias: number | null
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean | null
          id?: string
          max_clinicas?: number | null
          max_pacientes?: number | null
          max_profissionais?: number | null
          nome: string
          recursos_disponiveis?: Json | null
          updated_at?: string
          validade_dias?: number | null
          valor_mensal?: number
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean | null
          id?: string
          max_clinicas?: number | null
          max_pacientes?: number | null
          max_profissionais?: number | null
          nome?: string
          recursos_disponiveis?: Json | null
          updated_at?: string
          validade_dias?: number | null
          valor_mensal?: number
        }
        Relationships: []
      }
      politicas_cancelamento: {
        Row: {
          aplica_cancelamento: boolean
          aplica_falta: boolean
          ativo: boolean
          created_at: string
          created_by: string
          descricao: string | null
          exige_justificativa: boolean
          id: string
          multa_percentual: number
          nome: string
          prazo_aviso_horas: number
          prazo_reagendamento_dias: number
          prazo_remarcacao_dias: number
          updated_at: string
        }
        Insert: {
          aplica_cancelamento?: boolean
          aplica_falta?: boolean
          ativo?: boolean
          created_at?: string
          created_by: string
          descricao?: string | null
          exige_justificativa?: boolean
          id?: string
          multa_percentual?: number
          nome: string
          prazo_aviso_horas?: number
          prazo_reagendamento_dias?: number
          prazo_remarcacao_dias?: number
          updated_at?: string
        }
        Update: {
          aplica_cancelamento?: boolean
          aplica_falta?: boolean
          ativo?: boolean
          created_at?: string
          created_by?: string
          descricao?: string | null
          exige_justificativa?: boolean
          id?: string
          multa_percentual?: number
          nome?: string
          prazo_aviso_horas?: number
          prazo_reagendamento_dias?: number
          prazo_remarcacao_dias?: number
          updated_at?: string
        }
        Relationships: []
      }
      pre_cadastros: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          estado: string | null
          id: string
          nome: string
          numero: string | null
          observacoes: string | null
          responsavel_cpf: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_parentesco: string | null
          responsavel_telefone: string | null
          revisado_por: string | null
          rg: string | null
          rua: string | null
          status: string
          telefone: string
          tem_responsavel_legal: boolean | null
          tipo_atendimento: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nome: string
          numero?: string | null
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          revisado_por?: string | null
          rg?: string | null
          rua?: string | null
          status?: string
          telefone: string
          tem_responsavel_legal?: boolean | null
          tipo_atendimento?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nome?: string
          numero?: string | null
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          revisado_por?: string | null
          rg?: string | null
          rua?: string | null
          status?: string
          telefone?: string
          tem_responsavel_legal?: boolean | null
          tipo_atendimento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      precos_planos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          descricao: string | null
          frequencia_semanal: number
          id: string
          modalidade: string
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          descricao?: string | null
          frequencia_semanal?: number
          id?: string
          modalidade?: string
          nome: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          descricao?: string | null
          frequencia_semanal?: number
          id?: string
          modalidade?: string
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          descricao: string | null
          estoque: number
          foto_url: string | null
          id: string
          nome: string
          preco: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          descricao?: string | null
          estoque?: number
          foto_url?: string | null
          id?: string
          nome: string
          preco?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          descricao?: string | null
          estoque?: number
          foto_url?: string | null
          id?: string
          nome?: string
          preco?: number
          updated_at?: string
        }
        Relationships: []
      }
      professional_documents: {
        Row: {
          created_at: string
          descricao: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          nome: string
          profissional_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          nome: string
          profissional_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          nome?: string
          profissional_id?: string
        }
        Relationships: []
      }
      professional_goals: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          meta_tipo: string
          meta_valor: number
          pontos_recompensa: number | null
          target_user_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          meta_tipo: string
          meta_valor?: number
          pontos_recompensa?: number | null
          target_user_id?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          meta_tipo?: string
          meta_valor?: number
          pontos_recompensa?: number | null
          target_user_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      professional_points: {
        Row: {
          created_at: string | null
          id: string
          motivo: string
          pontos: number
          profissional_id: string
          referencia_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          motivo: string
          pontos?: number
          profissional_id: string
          referencia_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          motivo?: string
          pontos?: number
          profissional_id?: string
          referencia_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aceita_domiciliar: boolean | null
          aceita_teleconsulta: boolean | null
          bairro: string | null
          bio: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          commission_fixed: number | null
          commission_rate: number | null
          cor_agenda: string | null
          cpf: string | null
          created_at: string
          cursos: string[] | null
          data_nascimento: string | null
          domiciliar_observacoes: string | null
          domiciliar_raio_km: number | null
          domiciliar_valor_adicional: number | null
          email: string | null
          endereco: string | null
          especialidade: string | null
          especializacoes: string[] | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          graduacao: string | null
          id: string
          nome: string
          numero: string | null
          registro_profissional: string | null
          rg: string | null
          teleconsulta_link: string | null
          teleconsulta_plataforma: string | null
          telefone: string | null
          tipo_contratacao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aceita_domiciliar?: boolean | null
          aceita_teleconsulta?: boolean | null
          bairro?: string | null
          bio?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          commission_fixed?: number | null
          commission_rate?: number | null
          cor_agenda?: string | null
          cpf?: string | null
          created_at?: string
          cursos?: string[] | null
          data_nascimento?: string | null
          domiciliar_observacoes?: string | null
          domiciliar_raio_km?: number | null
          domiciliar_valor_adicional?: number | null
          email?: string | null
          endereco?: string | null
          especialidade?: string | null
          especializacoes?: string[] | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          graduacao?: string | null
          id?: string
          nome: string
          numero?: string | null
          registro_profissional?: string | null
          rg?: string | null
          teleconsulta_link?: string | null
          teleconsulta_plataforma?: string | null
          telefone?: string | null
          tipo_contratacao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aceita_domiciliar?: boolean | null
          aceita_teleconsulta?: boolean | null
          bairro?: string | null
          bio?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          commission_fixed?: number | null
          commission_rate?: number | null
          cor_agenda?: string | null
          cpf?: string | null
          created_at?: string
          cursos?: string[] | null
          data_nascimento?: string | null
          domiciliar_observacoes?: string | null
          domiciliar_raio_km?: number | null
          domiciliar_valor_adicional?: number | null
          email?: string | null
          endereco?: string | null
          especialidade?: string | null
          especializacoes?: string[] | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          graduacao?: string | null
          id?: string
          nome?: string
          numero?: string | null
          registro_profissional?: string | null
          rg?: string | null
          teleconsulta_link?: string | null
          teleconsulta_plataforma?: string | null
          telefone?: string | null
          tipo_contratacao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profissional_formacoes: {
        Row: {
          carga_horaria: number | null
          certificado_url: string | null
          created_at: string
          data_conclusao: string | null
          id: string
          instituicao: string | null
          nome: string
          observacoes: string | null
          profissional_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          carga_horaria?: number | null
          certificado_url?: string | null
          created_at?: string
          data_conclusao?: string | null
          id?: string
          instituicao?: string | null
          nome: string
          observacoes?: string | null
          profissional_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          carga_horaria?: number | null
          certificado_url?: string | null
          created_at?: string
          data_conclusao?: string | null
          id?: string
          instituicao?: string | null
          nome?: string
          observacoes?: string | null
          profissional_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      regras_comissao: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          id: string
          observacoes: string | null
          percentual: number | null
          profissional_id: string
          tipo_atendimento: string
          updated_at: string
          valor_fixo: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          id?: string
          observacoes?: string | null
          percentual?: number | null
          profissional_id: string
          tipo_atendimento?: string
          updated_at?: string
          valor_fixo?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          id?: string
          observacoes?: string | null
          percentual?: number | null
          profissional_id?: string
          tipo_atendimento?: string
          updated_at?: string
          valor_fixo?: number | null
        }
        Relationships: []
      }
      reservas_produtos: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          paciente_id: string
          produto_id: string
          quantidade: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          paciente_id: string
          produto_id: string
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          paciente_id?: string
          produto_id?: string
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_produtos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_alteracao_dados: {
        Row: {
          approved_at: string | null
          aprovador_id: string | null
          created_at: string
          dados_atuais: Json
          dados_novos: Json
          id: string
          motivo: string | null
          motivo_rejeicao: string | null
          paciente_id: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          aprovador_id?: string | null
          created_at?: string
          dados_atuais?: Json
          dados_novos?: Json
          id?: string
          motivo?: string | null
          motivo_rejeicao?: string | null
          paciente_id: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          aprovador_id?: string | null
          created_at?: string
          dados_atuais?: Json
          dados_novos?: Json
          id?: string
          motivo?: string | null
          motivo_rejeicao?: string | null
          paciente_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_alteracao_dados_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_mudanca_horario: {
        Row: {
          aprovador_id: string | null
          created_at: string
          dia_semana_atual: number[] | null
          dia_semana_novo: number[]
          horario_atual: string | null
          horario_novo: string
          id: string
          lista_espera_id: string
          matricula_id: string
          motivo_rejeicao: string | null
          paciente_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aprovador_id?: string | null
          created_at?: string
          dia_semana_atual?: number[] | null
          dia_semana_novo: number[]
          horario_atual?: string | null
          horario_novo: string
          id?: string
          lista_espera_id: string
          matricula_id: string
          motivo_rejeicao?: string | null
          paciente_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aprovador_id?: string | null
          created_at?: string
          dia_semana_atual?: number[] | null
          dia_semana_novo?: number[]
          horario_atual?: string | null
          horario_novo?: string
          id?: string
          lista_espera_id?: string
          matricula_id?: string
          motivo_rejeicao?: string | null
          paciente_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_mudanca_horario_lista_espera_id_fkey"
            columns: ["lista_espera_id"]
            isOneToOne: false
            referencedRelation: "lista_espera"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_mudanca_horario_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_mudanca_horario_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_remarcacao: {
        Row: {
          agendamento_id: string
          created_at: string
          id: string
          motivo: string | null
          nova_data_horario: string
          paciente_id: string
          respondido_at: string | null
          respondido_por: string | null
          status: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          id?: string
          motivo?: string | null
          nova_data_horario: string
          paciente_id: string
          respondido_at?: string | null
          respondido_por?: string | null
          status?: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          id?: string
          motivo?: string | null
          nova_data_horario?: string
          paciente_id?: string
          respondido_at?: string | null
          respondido_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_remarcacao_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          forma_pagamento: string | null
          id: string
          mes_referencia: string
          observacoes: string | null
          status: string
          subscription_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          mes_referencia: string
          observacoes?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "clinic_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      teleconsulta_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_name: string
          sender_role: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_name: string
          sender_role?: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teleconsulta_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "teleconsulta_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      teleconsulta_sessions: {
        Row: {
          admitted_at: string | null
          agendamento_id: string | null
          clinic_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          paciente_id: string
          profissional_id: string
          room_id: string
          started_at: string | null
          status: string
          updated_at: string
          waiting_room_entered_at: string | null
        }
        Insert: {
          admitted_at?: string | null
          agendamento_id?: string | null
          clinic_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          paciente_id: string
          profissional_id: string
          room_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          waiting_room_entered_at?: string | null
        }
        Update: {
          admitted_at?: string | null
          agendamento_id?: string | null
          clinic_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          paciente_id?: string
          profissional_id?: string
          room_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          waiting_room_entered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teleconsulta_sessions_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsulta_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsulta_sessions_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          access_level: string
          created_at: string
          enabled: boolean
          id: string
          resource: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          enabled?: boolean
          id?: string
          resource: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          enabled?: boolean
          id?: string
          resource?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas_produtos: {
        Row: {
          created_at: string
          created_by: string
          data_venda: string
          id: string
          observacoes: string | null
          paciente_id: string | null
          produto_id: string
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          created_by: string
          data_venda?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          produto_id: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          data_venda?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          produto_id?: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_produtos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_schedules: {
        Row: {
          created_at: string
          enrollment_id: string
          id: string
          professional_id: string
          session_duration: number
          time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          id?: string
          professional_id: string
          session_duration?: number
          time: string
          weekday: number
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          id?: string
          professional_id?: string
          session_duration?: number
          time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedules_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_plan_limit: {
        Args: { _clinic_id: string; _resource: string }
        Returns: Json
      }
      get_gamification_ranking: {
        Args: { limit_count?: number }
        Returns: {
          avatar: string
          nome: string
          paciente_id: string
          total_pontos: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "profissional"
        | "gestor"
        | "paciente"
        | "secretario"
        | "master"
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
        | "reagendado"
        | "pendente"
      status_paciente: "ativo" | "inativo"
      status_pagamento: "pendente" | "pago" | "cancelado"
      status_plano:
        | "ativo"
        | "vencido"
        | "cancelado"
        | "finalizado"
        | "suspenso"
      tipo_atendimento: "fisioterapia" | "pilates" | "rpg"
      tipo_sessao: "individual" | "grupo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "profissional",
        "gestor",
        "paciente",
        "secretario",
        "master",
      ],
      forma_pagamento: [
        "dinheiro",
        "pix",
        "cartao_credito",
        "cartao_debito",
        "boleto",
        "transferencia",
      ],
      status_agendamento: [
        "agendado",
        "confirmado",
        "realizado",
        "cancelado",
        "falta",
        "reagendado",
        "pendente",
      ],
      status_paciente: ["ativo", "inativo"],
      status_pagamento: ["pendente", "pago", "cancelado"],
      status_plano: ["ativo", "vencido", "cancelado", "finalizado", "suspenso"],
      tipo_atendimento: ["fisioterapia", "pilates", "rpg"],
      tipo_sessao: ["individual", "grupo"],
    },
  },
} as const
