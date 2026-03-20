# Fisio Flow Care — Module Map

> Inter-module dependency analysis, coupling catalogue, and architectural recommendations.
> Generated from static analysis of `src/modules/`, `src/pages/`, and `src/components/`.

---

## 1. Module Inventory

| Module | Directory | Purpose |
|---|---|---|
| `auth` | `src/modules/auth/` | Authentication, session, roles, permissions |
| `appointments` | `src/modules/appointments/` | Scheduling, availability, teleconsultation |
| `patients` | `src/modules/patients/` | Patient records, plans, gamification |
| `professionals` | `src/modules/professionals/` | Profiles, analytics, goals, commissions |
| `clinic` | `src/modules/clinic/` | Clinic settings, groups, subscriptions |
| `clinical` | `src/modules/clinical/` | Evolutions, evaluations, clinical documents |
| `finance` | `src/modules/finance/` | Payments, expenses, PIX, commissions |
| `inventory` | `src/modules/inventory/` | Products, equipment, stock movements |
| `marketing` | `src/modules/marketing/` | Landing page content, campaigns |
| `shared` | `src/modules/shared/` | Cross-cutting utilities (no module deps) |

---

## 2. Module Dependency Matrix

A `●` means the row module **directly depends on** the column module.

|  | `shared` | `auth` | `clinic` | `patients` | `appointments` | `professionals` | `clinical` | `finance` | `inventory` | `marketing` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **shared** | — | | | | | | | | | |
| **auth** | ● | — | | | | | | | | |
| **clinic** | ● | ● | — | | | | | | | |
| **patients** | ● | ● | ● | — | | | | | | |
| **appointments** | ● | ● | ● | ● | — | ● | | | | |
| **professionals** | ● | ● | ● | | | — | | | | |
| **clinical** | ● | ● | | ● | | | — | | | |
| **finance** | ● | ● | ● | ● | | ● | | — | | |
| **inventory** | ● | | ● | | | | | | — | |
| **marketing** | ● | | | | | | | | | — |

**Key observations:**
- `shared` is the universal foundation — zero external deps.
- `auth` and `clinic` are the two infrastructure modules; all others depend on them.
- `appointments` has the most dependencies (5 modules).
- `marketing` and `inventory` are the most isolated.

---

## 3. Detailed Module Relationships

### `shared` → (none)
The shared module is dependency-free. It provides:
- `queryKeys` — centralised React Query key factory
- `errorHandler` — `handleError()` + `AppError` class
- `useI18n()` — i18next adapter
- `usePermission()` — thin wrapper around `useAuth()`
- `usePersistedFilter()` — localStorage filter persistence
- `useDashboardLayout()` — layout state management
- `auditService` — writes to `audit_logs`

### `auth` → `shared`
Uses `handleError()` for all Supabase errors.  
Provides `AuthContext` consumed by all other modules via `useAuth()`.

### `clinic` → `shared`, `auth`
Uses `useAuth()` to get the authenticated user's ID.  
Provides `ClinicContext` (active clinic, clinic list, `switchClinic()`).  
Exposes `usePlanLimits()` to enforce subscription quotas.

### `patients` → `shared`, `auth`, `clinic`
Uses `useAuth()` for role checks.  
Uses `ClinicContext` for `activeClinicId` in all queries.  
`usePatientForm` hook manages all form state (5 grouped objects, refactored from 47 `useState` calls).

### `appointments` → `shared`, `auth`, `clinic`, `patients`, `professionals`
The most interconnected module.  
Joins `pacientes` (patient name/phone) and `profiles` (professional colour) in queries.  
Cross-booking hook (`useCrossBooking`) uses `clinic_group_id` from `clinic` module.

### `professionals` → `shared`, `auth`, `clinic`
Uses `useAuth()` to determine if viewing own profile.  
`useProfessionalAnalytics` aggregates from `agendamentos` and `commissions`.

### `clinical` → `shared`, `auth`, `patients`
Uses patient ID from `patients` module context.  
Creates evolutions with `profissional_id` from `useAuth()`.

### `finance` → `shared`, `auth`, `clinic`, `patients`, `professionals`
Payments are linked to `paciente_id` and `profissional_id`.  
Commission calculations reference `regras_comissao` which is linked to `profiles`.

### `inventory` → `shared`, `clinic`
No dependency on patients or professionals at the service layer.  
Product reservations reference appointments by ID but do not import the appointments module.

### `marketing` → `shared`
Minimal module. Only reads `landing_content` and `marketing_campaigns` tables.

---

## 4. Shared Utilities Usage Map

| Utility | Used by |
|---|---|
| `queryKeys.*` | All 10 modules + page files |
| `handleError()` | All service files |
| `useI18n()` | All page and component files |
| `usePermission()` | Pages requiring role-gated UI (Dashboard, Financeiro, etc.) |
| `usePersistedFilter()` | Pacientes, Agenda, Financeiro pages |
| `useDashboardLayout()` | Dashboard, ProfessionalDashboard |
| `auditService` | Admin actions (patient create/update, finance ops) |

---

## 5. Cross-Module Data Sharing Patterns

### Pattern 1: Auth Context propagation
Every module reads auth state via `useAuth()`. The auth context provides `clinicId`
(active clinic) so modules do not need to import from `clinic` just for the ID.

```
useAuth() → { clinicId, user, isAdmin, hasPermission }
               ↑ consumed by every module
```

### Pattern 2: Query key namespacing
Modules that need to invalidate another module's cache use `queryKeys.*` from `shared`:

```typescript
// finance hook: after creating a payment, invalidate patient's pendências
queryClient.invalidateQueries({ queryKey: queryKeys.patients.detail(patientId) });
```

### Pattern 3: Entity IDs as boundary
Modules pass entity IDs (not full objects) across boundaries:
- `appointments` receives `paciente_id: string` — not the full `Paciente` object
- `clinical` receives `agendamento_id: string` — not the full `Agendamento` object

This keeps modules loosely coupled despite sharing the same database.

---

## 6. Coupling Analysis

### Tight Coupling (concerns)
| Location | Problem |
|---|---|
| `appointments` ↔ `patients` | `useAppointments` joins `pacientes` table directly in SQL |
| `finance` ↔ `professionals` | Commission rules reference `profiles.commission_rate` directly |
| Pages direct Supabase access | ~110 page/component files bypass the service layer (ongoing refactor) |

### Loose Coupling (good)
| Location | How it's decoupled |
|---|---|
| All modules ↔ Supabase types | `Database["public"]["Tables"]` type prevents runtime shape drift |
| Modules ↔ shared | Only depends on stable utilities, not other domain modules |
| Marketing ↔ everything | Marketing is fully isolated |

---

## 7. Module Boundaries — What Each Module Owns

| Module | Owns these DB tables | Must NOT write to |
|---|---|---|
| `auth` | `profiles`, `user_roles`, `user_permissions`, `clinic_users` | Any data table |
| `clinic` | `clinicas`, `clinic_settings`, `clinic_groups`, `clinic_group_members`, `clinic_subscriptions` | Patient or appointment data |
| `patients` | `pacientes`, `planos`, `patient_achievements`, `patient_goals` | Appointments, finance |
| `appointments` | `agendamentos`, `disponibilidade_profissional`, `bloqueios_profissional`, `weekly_schedules` | Clinical records, payments |
| `professionals` | `profissional_formacoes`, `profissional_certificados`, `professional_goals`, `professional_kpis` | Appointments directly |
| `clinical` | `evolutions`, `evaluations`, `documentos_clinicos`, `patient_attachments` | Patient demographics |
| `finance` | `pagamentos`, `expenses`, `commissions`, `config_pix`, `formas_pagamento` | Clinical records |
| `inventory` | `produtos`, `equipamentos`, `entradas_estoque`, `reservas_produtos` | Finance tables |
| `marketing` | `landing_content`, `marketing_campaigns` | Any operational data |
| `shared` | `audit_logs` | Any domain data |

---

## 8. Recommended Architecture Improvements

1. **Complete the service layer migration** — eliminate 110 direct Supabase imports in pages and components.
   Use the existing services as the migration target.

2. **Extract appointment-patient join into a view** — create a Supabase DB view `agendamentos_com_paciente`
   that pre-joins the two tables, removing the cross-module SQL dependency.

3. **Introduce module index files** — each module should have an `index.ts` re-exporting its public API
   (hooks and types only). This makes cross-module imports explicit and auditable.

4. **Separate `appointments` group-booking** — the `useCrossBooking` hook has enough complexity to warrant
   its own service file (`crossBookingService.ts`).

5. **Move `regras_comissao` ownership** — the commission rules table is currently shared between
   `finance` and `professionals`. Consider a dedicated `commissions` sub-module.
