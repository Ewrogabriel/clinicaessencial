import { z } from "zod";

/**
 * Zod schema for the `user_permissions` JSONB column.
 * Permissions follow the format { resource: { action: boolean } }.
 *
 * Example:
 *   { financeiro: { read: true, write: false }, pacientes: { read: true } }
 */
export const permissionActionSchema = z.object({
  read: z.boolean().optional(),
  write: z.boolean().optional(),
  delete: z.boolean().optional(),
  export: z.boolean().optional(),
  approve: z.boolean().optional(),
});

export type PermissionAction = z.infer<typeof permissionActionSchema>;

export const RESOURCES = [
  "pacientes",
  "agendamentos",
  "financeiro",
  "comissoes",
  "despesas",
  "relatorios",
  "profissionais",
  "clinica",
  "conciliacao",
  "prontuarios",
  "contratos",
  "pre_cadastros",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const userPermissionsSchema = z
  .record(z.string(), permissionActionSchema)
  .superRefine((val, ctx) => {
    // Warn if unknown resources are present (non-blocking)
    Object.keys(val).forEach((key) => {
      if (!RESOURCES.includes(key as Resource)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Recurso desconhecido: "${key}"`,
          path: [key],
          fatal: false,
        });
      }
    });
  });

export type UserPermissions = z.infer<typeof userPermissionsSchema>;

/**
 * Default permission sets per role.
 */
export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  admin: RESOURCES.reduce<UserPermissions>((acc, r) => {
    acc[r] = { read: true, write: true, delete: true, export: true, approve: true };
    return acc;
  }, {}),

  gestor: RESOURCES.reduce<UserPermissions>((acc, r) => {
    acc[r] = { read: true, write: true, delete: false, export: true, approve: false };
    return acc;
  }, {}),

  secretario: {
    pacientes: { read: true, write: true, delete: false },
    agendamentos: { read: true, write: true, delete: false },
    financeiro: { read: true, write: false },
    pre_cadastros: { read: true, write: true },
    prontuarios: { read: false },
    clinica: { read: false },
    profissionais: { read: true },
    relatorios: { read: false },
    comissoes: { read: false },
    despesas: { read: false },
    contratos: { read: true },
    conciliacao: { read: false },
  },

  profissional: {
    pacientes: { read: true, write: true, delete: false },
    agendamentos: { read: true, write: true, delete: false },
    financeiro: { read: false },
    comissoes: { read: true },
    prontuarios: { read: true, write: true, delete: false },
    clinica: { read: false },
    profissionais: { read: false },
    relatorios: { read: false },
    despesas: { read: false },
    contratos: { read: true },
    pre_cadastros: { read: false },
    conciliacao: { read: false },
  },

  paciente: {
    pacientes: { read: true, write: false },
    agendamentos: { read: true, write: false },
    financeiro: { read: true, write: false },
    prontuarios: { read: true, write: false },
    clinica: { read: false },
    profissionais: { read: false },
    relatorios: { read: false },
    comissoes: { read: false },
    despesas: { read: false },
    contratos: { read: true, write: false },
    pre_cadastros: { read: false },
    conciliacao: { read: false },
  },
};

/**
 * Validate raw JSONB from DB. Returns parsed permissions or null if invalid.
 */
export function validatePermissions(raw: unknown): UserPermissions | null {
  const result = userPermissionsSchema.safeParse(raw);
  if (result.success) return result.data;
  console.warn("Invalid user_permissions schema:", result.error.flatten());
  return null;
}

/**
 * Check if a permissions object grants a specific action on a resource.
 */
export function hasPermission(
  permissions: UserPermissions | null | undefined,
  resource: Resource,
  action: keyof PermissionAction
): boolean {
  if (!permissions) return false;
  return permissions[resource]?.[action] === true;
}
