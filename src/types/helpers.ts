/**
 * Helper types para eliminar "as any" no projeto
 * Use esses tipos em vez de fazer cast com "as any"
 */

import { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ============ Tipos de Entidades Principais ============

export type Matricula = Tables<"matriculas">;
export type MatriculaInsert = TablesInsert<"matriculas">;
export type MatriculaUpdate = TablesUpdate<"matriculas">;

export type Agendamento = Tables<"agendamentos">;
export type AgendamentoInsert = TablesInsert<"agendamentos">;
export type AgendamentoUpdate = TablesUpdate<"agendamentos">;

export type Paciente = Tables<"pacientes">;
export type PacienteInsert = TablesInsert<"pacientes">;
export type PacienteUpdate = TablesUpdate<"pacientes">;

// "profissionais" table doesn't exist - use profiles
export type Profissional = Tables<"profiles">;
export type ProfissionalInsert = TablesInsert<"profiles">;
export type ProfissionalUpdate = TablesUpdate<"profiles">;

export type Clinica = Tables<"clinicas">;
export type ClinicaInsert = TablesInsert<"clinicas">;
export type ClinicaUpdate = TablesUpdate<"clinicas">;

export type PagamentoMensalidade = Tables<"pagamentos_mensalidade">;
export type PagamentoMensalidadeInsert = TablesInsert<"pagamentos_mensalidade">;
export type PagamentoMensalidadeUpdate = TablesUpdate<"pagamentos_mensalidade">;

export type WeeklySchedule = Tables<"weekly_schedules">;
export type WeeklyScheduleInsert = TablesInsert<"weekly_schedules">;
export type WeeklyScheduleUpdate = TablesUpdate<"weekly_schedules">;

// "sessoes" table doesn't exist in schema - define as any
export type Sessao = any;
export type SessaoInsert = any;
export type SessaoUpdate = any;

// ============ Tipos com Relações (select com joins) ============

export interface MatriculaComSchedules extends Matricula {
  weekly_schedules?: WeeklySchedule[];
}

export interface MatriculaComPaciente extends Matricula {
  pacientes?: Paciente;
}

export interface MatriculaComProfissionais extends Matricula {
  weekly_schedules?: (WeeklySchedule & { profissionais?: Profissional })[];
}

export interface AgendamentoComPaciente extends Agendamento {
  pacientes?: Paciente;
}

export interface AgendamentoComProfissional extends Agendamento {
  profissionais?: Profissional;
}

export interface AgendamentoComMatricula extends Agendamento {
  matriculas?: Matricula;
}

export type SessaoComPaciente = any;
export type SessaoComProfissional = any;

// ============ Tipos de Enumerações ============

export type StatusAgendamento = Database["public"]["Enums"]["status_agendamento"];
export type TipoSessao = Database["public"]["Enums"]["tipo_sessao"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type StatusPagamento = Database["public"]["Enums"]["status_pagamento"];

// ============ Tipos de Resposta da API ============

export interface ApiResponse<T> {
  data?: T;
  error?: Error | null;
  count?: number;
}

export interface ApiListResponse<T> {
  data: T[];
  count: number;
  error?: Error | null;
}

// ============ Utilities para narrowing de tipos ============

export function isAgendamento(obj: any): obj is Agendamento {
  return (
    obj &&
    typeof obj === "object" &&
    "id" in obj &&
    "paciente_id" in obj &&
    "profissional_id" in obj &&
    "data_horario" in obj
  );
}

export function isMatricula(obj: any): obj is Matricula {
  return (
    obj &&
    typeof obj === "object" &&
    "id" in obj &&
    "paciente_id" in obj &&
    "clinic_id" in obj
  );
}

export function isPaciente(obj: any): obj is Paciente {
  return (
    obj &&
    typeof obj === "object" &&
    "id" in obj &&
    "nome" in obj
  );
}

// ============ Tipos Genéricos Úteis ============

export type ArrayElement<T extends any[]> = T extends (infer E)[] ? E : never;

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type DeepRequired<T> = T extends object
  ? {
      [P in keyof T]-?: DeepRequired<T[P]>;
    }
  : T;

export type OmitKeys<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type PublicFields<T> = Omit<T, "created_at" | "updated_at">;
