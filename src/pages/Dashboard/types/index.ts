export interface DashboardMetrics {
  // Financial
  totalRecebido: number;
  totalPendente: number;
  totalVencido: number;
  saldo: number;

  // Appointments
  totalAgendamentos: number;
  confirmados: number;
  pendentes: number;
  cancelados: number;

  // Patients
  totalPacientes: number;
  ativos: number;
  novosEsteMes: number;

  // Performance
  taxaConfirmacao: number;
  taxaComparecimento: number;
}

export type DashboardRole = "admin" | "gestor" | "secretario" | "profissional" | "paciente" | "master";

export type PeriodValue = "today" | "7days" | "30days" | "month" | "year";

export interface SectionConfig {
  id: string;
  label: string;
  visible: boolean;
}
