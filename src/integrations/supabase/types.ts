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
          created_at?: string
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
          checkin_paciente: boolean | null
          checkin_paciente_at: string | null
          checkin_profissional: boolean | null
          checkin_profissional_at: string | null
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
      avisos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          id: string
          mensagem: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          id?: string
          mensagem: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          id?: string
          mensagem?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      bloqueios_profissional: {
        Row: {
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
          created_at?: string
          data?: string
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          profissional_id?: string
        }
        Relationships: []
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
      commissions: {
        Row: {
          agendamento_id: string | null
          clinic_id: string
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
        ]
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
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          max_pacientes?: number
          profissional_id?: string
          updated_at?: string
        }
        Relationships: []
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
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
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
      matriculas: {
        Row: {
          auto_renew: boolean
          cancellation_date: string | null
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
            foreignKeyName: "matriculas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
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
      modalidades: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
      pacientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          created_by: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          foto_url: string | null
          id: string
          nome: string
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
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          nome: string
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
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
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
          status?: Database["public"]["Enums"]["status_paciente"]
          telefone?: string
          tem_responsavel_legal?: boolean | null
          tipo_atendimento?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
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
      profiles: {
        Row: {
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
          telefone: string | null
          tipo_contratacao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
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
          telefone?: string | null
          tipo_contratacao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
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
          telefone?: string | null
          tipo_contratacao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "profissional" | "gestor" | "paciente"
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
      app_role: ["admin", "profissional", "gestor", "paciente"],
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
      ],
      status_paciente: ["ativo", "inativo"],
      status_pagamento: ["pendente", "pago", "cancelado"],
      status_plano: ["ativo", "vencido", "cancelado", "finalizado", "suspenso"],
      tipo_atendimento: ["fisioterapia", "pilates", "rpg"],
      tipo_sessao: ["individual", "grupo"],
    },
  },
} as const
