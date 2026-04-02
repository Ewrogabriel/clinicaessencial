# Custom Hooks Reference

All application-specific React hooks with usage examples.

---

## Auth

### `useAuth`

**Source:** `src/modules/auth/hooks/useAuth.tsx`

```typescript
const { user, isAdmin, isPatient, signIn, signOut, loading } = useAuth();
```

| Return | Type | Description |
|--------|------|-------------|
| `user` | `User \| null` | Supabase authenticated user |
| `session` | `Session \| null` | Current JWT session |
| `loading` | `boolean` | Auth state still loading |
| `isAdmin` | `boolean` | User has admin role |
| `isGestor` | `boolean` | User has gestor role |
| `isSecretario` | `boolean` | User has secretario role |
| `isProfissional` | `boolean` | User has profissional role |
| `isMaster` | `boolean` | User has master role |
| `isPatient` | `boolean` | User is a patient (no staff role) |
| `patientId` | `string \| null` | Linked `pacientes.id` for patient users |
| `signIn` | `fn` | Email + password login |
| `signOut` | `fn` | Sign out + clear state |

---

## Clinic

### `useClinic`

**Source:** `src/modules/clinic/hooks/useClinic.tsx`

```typescript
const { activeClinicId, clinics, setActiveClinic } = useClinic();
```

| Return | Type | Description |
|--------|------|-------------|
| `activeClinicId` | `string \| null` | Currently selected clinic |
| `clinics` | `Clinic[]` | All clinics the user belongs to |
| `setActiveClinic` | `fn` | Switch active clinic |

---

## Dashboard Layout

### `useDashboardLayout`

**Source:** `src/modules/shared/hooks/useDashboardLayout.ts`

Manages collapsible sidebar state and layout preferences.

```typescript
const { isSidebarOpen, toggleSidebar, sidebarWidth } = useDashboardLayout();
```

---

## Persistent Filters

### `usePersistedFilter`

**Source:** `src/modules/shared/hooks/usePersistedFilter.ts`

Persists a filter value to `localStorage` so it survives page refresh.

```typescript
const [status, setStatus] = usePersistedFilter("patients-status-filter", "ativo");
```

---

## Patient Form

### `usePatientForm`

**Source:** `src/modules/patients/hooks/usePatientForm.ts`

Manages all state for the staff patient create/edit form. See [SERVICES.md](./SERVICES.md) for the full return signature.

---

## Toast

### `useToast`

**Source:** `src/modules/shared/hooks/use-toast.ts`

```typescript
const { toast } = useToast();
toast({ title: "Salvo!", description: "Dados atualizados." });
```

You can also use the imperative `toast()` export directly without the hook.

---

## i18n

### `useI18n`

**Source:** `src/modules/shared/hooks/useI18n.tsx`

```typescript
const { t, currentLanguage, changeLanguage } = useI18n();
const label = t("nav.patients"); // "Pacientes"
```

---

## Query Keys Convention

All TanStack Query keys in this project follow the pattern:

```typescript
["resource", clinicId, ...filters]
```

Examples:
- `["pagamentos", activeClinicId]` – clinic-scoped payment list
- `["pacientes", clinicId, "ativo"]` – active patients for clinic
- `["agendamentos", clinicId, date]` – appointments for a day

This ensures cache entries are automatically scoped per clinic, preventing data leakage between clinic sessions.
