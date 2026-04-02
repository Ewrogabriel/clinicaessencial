# Permissions Schema

## Overview

The `user_permissions` JSONB column on the `profiles` table stores fine-grained permissions per user, validated by Zod schema at runtime.

## Schema: `src/modules/finance/utils/permissionSchemas.ts`

```ts
// Per resource, per action booleans
{
  "pacientes":    { "read": true, "write": true, "delete": false },
  "financeiro":   { "read": true, "write": false },
  "conciliacao":  { "read": false }
}
```

### Resources

`pacientes`, `agendamentos`, `financeiro`, `comissoes`, `despesas`, `relatorios`, `profissionais`, `clinica`, `conciliacao`, `prontuarios`, `contratos`, `pre_cadastros`

### Actions

`read`, `write`, `delete`, `export`, `approve`

## Default Permission Sets by Role

| Role | Read all | Write | Delete | Export | Approve |
|------|---------|-------|--------|--------|---------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| gestor | ✅ | ✅ | ❌ | ✅ | ❌ |
| secretario | Partial | Partial | ❌ | ❌ | ❌ |
| profissional | Partial | Partial | ❌ | ❌ | ❌ |
| paciente | Own data only | ❌ | ❌ | ❌ | ❌ |

## Validation

```ts
import { validatePermissions, hasPermission } from "@/modules/finance/utils/permissionSchemas";

const perms = validatePermissions(rawJsonb); // returns UserPermissions | null

if (hasPermission(perms, "financeiro", "read")) {
  // show financial tab
}
```

## Override UI

Admins can override permissions for any user via `permissionsService.saveUserPermissions()`. Changes are logged to `audit_logs`.

## Hooks

```ts
const { can, permissions, savePermissions } = usePermissionValidation(targetUserId);

if (can("conciliacao", "approve")) {
  // show approve button
}
```

## Migration

To seed default permissions for all existing profiles:

```ts
import { permissionsService } from "@/modules/shared/services/permissionsService";
await permissionsService.migrateDefaultPermissions();
```

## Audit Logging

All permission changes via `saveUserPermissions` are recorded in `audit_logs`:

```json
{
  "entity_type": "user_permissions",
  "entity_id": "<user_id>",
  "action": "update",
  "changes": { "permissions": { ... } },
  "performed_by": "<admin_user_id>"
}
```
