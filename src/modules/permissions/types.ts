export type PermissionScope = "own" | "others" | "global";
export type PermissionAction =
  | "view" | "create" | "edit" | "delete" | "approve"
  | "export" | "assign" | "cancel" | "reschedule"
  | "confirm" | "finalize" | "pay" | "refund";

export type PermissionModule =
  | "agenda" | "pacientes" | "prontuario" | "financeiro"
  | "comissoes" | "matriculas" | "planos" | "relatorios"
  | "equipe" | "configuracoes" | "mensagens" | "documentos" | "contratos";

export interface Permission {
  id: string;
  module: PermissionModule | string;
  action: PermissionAction | string;
  scope_type: PermissionScope;
  description: string | null;
}

export interface RolePermission {
  id: string;
  role: string;
  permission_id: string;
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  allowed: boolean;
  valid_until: string | null;
  granted_by: string | null;
}

export interface SchedulePermission {
  id: string;
  user_id: string;
  scope: "own" | "others" | "all";
  allowed_professionals: string[] | null;
}

export const ALL_MODULES: PermissionModule[] = [
  "agenda","pacientes","prontuario","financeiro","comissoes",
  "matriculas","planos","relatorios","equipe","configuracoes",
  "mensagens","documentos","contratos",
];

export const ALL_ACTIONS: PermissionAction[] = [
  "view","create","edit","delete","approve","export","assign",
  "cancel","reschedule","confirm","finalize","pay","refund",
];

export const ALL_SCOPES: PermissionScope[] = ["own","others","global"];

export const MODULE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  pacientes: "Pacientes",
  prontuario: "Prontuário",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  matriculas: "Matrículas",
  planos: "Planos",
  relatorios: "Relatórios",
  equipe: "Equipe",
  configuracoes: "Configurações",
  mensagens: "Mensagens",
  documentos: "Documentos",
  contratos: "Contratos",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  approve: "Aprovar",
  export: "Exportar",
  assign: "Atribuir",
  cancel: "Cancelar",
  reschedule: "Remarcar",
  confirm: "Confirmar",
  finalize: "Finalizar",
  pay: "Pagar",
  refund: "Estornar",
};
