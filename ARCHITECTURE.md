# Fisio Flow Care — Architecture

> This document describes the frontend architecture, data flow, component hierarchy,
> and key design decisions of the Fisio Flow Care platform.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser / PWA                                  │
│                                                                             │
│  ┌──────────────┐   ┌─────────────────────────────────────────────────┐    │
│  │  React Router│   │               React Application                  │    │
│  │  (64 routes) │──▶│  Providers: Auth · Clinic · I18n · QueryClient   │    │
│  └──────────────┘   │  ┌──────────────┐   ┌────────────────────────┐  │    │
│                      │  │ AppLayout /  │   │      Domain Modules     │  │    │
│                      │  │ AppSidebar   │   │  auth · patients ·      │  │    │
│                      │  └──────────────┘   │  appointments · clinic  │  │    │
│                      │  ┌──────────────┐   │  clinical · finance ·   │  │    │
│                      │  │  Page comps  │──▶│  professionals ·        │  │    │
│                      │  │  (64 pages)  │   │  inventory · marketing  │  │    │
│                      │  └──────────────┘   │  shared                 │  │    │
│                      │                      └──────────┬─────────────┘  │    │
│                      └────────────────────────────────┼────────────────┘    │
└───────────────────────────────────────────────────────┼─────────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Supabase                                      │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ PostgreSQL │  │     Auth     │  │    Storage   │  │    Realtime     │   │
│  │ 82 tables  │  │  JWT + RLS   │  │ (attachments)│  │  (messages,     │   │
│  │ 104 migrs  │  │  policies    │  │              │  │   teleconsult)  │   │
│  └───────────┘  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture Layers

The frontend follows a **strict layered architecture**:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5 — Pages (src/pages/)                           │
│  Route-level components. Compose hooks + UI only.        │
│  Should NOT import from integrations/supabase directly.  │
├─────────────────────────────────────────────────────────┤
│  Layer 4 — Components (src/components/)                  │
│  Reusable UI components. Layout + feature components.    │
│  Should call hooks, not services directly.               │
├─────────────────────────────────────────────────────────┤
│  Layer 3 — Domain Hooks (src/modules/*/hooks/)           │
│  React Query hooks. Coordinate service calls + cache.    │
│  Return typed data + mutation functions to components.   │
├─────────────────────────────────────────────────────────┤
│  Layer 2 — Service Layer (src/modules/*/services/)       │
│  Pure async functions. ONLY layer that touches Supabase. │
│  Named column constants, explicit TypeScript returns.    │
├─────────────────────────────────────────────────────────┤
│  Layer 1 — Integration (src/integrations/supabase/)      │
│  Auto-generated Supabase client + type definitions.      │
│  Never imported above the service layer.                 │
└─────────────────────────────────────────────────────────┘
```

### Layering Rules

1. **Pages** consume domain hooks or shared hooks only; never import from `integrations/supabase` directly.
2. **Domain hooks** call their module's service only; never import from `integrations/supabase` directly.
3. **Domain components** call their module's hook; never import from `integrations/supabase` directly.
4. **Services** are the *only* files that may import `@/integrations/supabase/client`.
5. **`modules/shared`** has zero dependency on `integrations/supabase`.
6. **`components/ui`** has zero dependency on any module or service.

> **Note:** A refactoring effort is in progress. See [`docs/dependency-map.md`](docs/dependency-map.md)
> for the full violation catalogue (110 files that currently bypass the service layer).

---

## 3. Module Structure

Each domain module follows the same internal layout:

```
src/modules/<domain>/
├── services/         ← Data access (Supabase calls)
│   └── <domain>Service.ts
├── hooks/            ← React Query hooks
│   └── use<Domain>.ts
├── components/       ← Domain-specific UI components (optional)
├── utils/            ← Zod schemas, helpers
│   └── schemas.ts
└── types/            ← Domain-specific TypeScript types (optional)
```

### Domain Modules

| Module | Services | Hooks | Key DB tables |
|---|---|---|---|
| `auth` | `authService.ts` | `useAuth.tsx` | `profiles`, `user_roles`, `user_permissions`, `clinic_users` |
| `appointments` | `appointmentService.ts` | `useAppointments.ts`, `useCrossBooking.ts`, `useModalidades.ts` | `agendamentos`, `disponibilidade_profissional`, `bloqueios_profissional`, `weekly_schedules` |
| `patients` | `patientService.ts` | `usePacientes.ts`, `usePatientForm.tsx`, `usePatientAgenda.ts`, `useGamification.ts` | `pacientes`, `planos`, `pagamentos`, `evolutions`, `patient_achievements` |
| `professionals` | `professionalService.ts` | `useProfessionals.ts`, `useProfessionalAnalytics.ts` | `profiles`, `profissional_formacoes`, `regras_comissao`, `professional_goals` |
| `clinic` | `clinicGroupService.ts` | `useClinic.tsx`, `useClinicGroup.ts`, `useClinicSettings.ts`, `usePlanLimits.ts` | `clinicas`, `clinic_settings`, `clinic_groups`, `clinic_group_members`, `clinic_subscriptions` |
| `clinical` | `clinicalService.ts` | `useClinical.ts` | `evolutions`, `evaluations`, `documentos_clinicos`, `patient_attachments` |
| `finance` | `financeService.ts` | `useFinance.ts` | `pagamentos`, `expenses`, `commissions`, `config_pix`, `formas_pagamento` |
| `inventory` | `inventoryService.ts` | `useInventory.ts` | `produtos`, `equipamentos`, `entradas_estoque`, `reservas_produtos` |
| `marketing` | — | `useLandingContent.ts` | `landing_content`, `marketing_campaigns` |
| `shared` | `auditService.ts` | `useI18n.tsx`, `usePermission.ts`, `useDashboardLayout.ts`, `usePersistedFilter.ts` | `audit_logs` |

---

## 4. Global State & Context

The application uses three React Contexts wrapped at the root level in `App.tsx`:

```tsx
<ThemeProvider>             // Dark/light mode (next-themes)
  <QueryClientProvider>     // React Query cache
    <I18nProvider>          // i18next language context
      <AuthProvider>        // User, session, roles, permissions
        <ClinicProvider>    // Active clinic ID + multi-clinic
          {children}
        </ClinicProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
</ThemeProvider>
```

### `AuthProvider` (`src/modules/auth/hooks/useAuth.tsx`)

Exposes: `user`, `session`, `profile`, `roles`, `permissions`, `loading`,
`isMaster`, `isAdmin`, `isGestor`, `isProfissional`, `isSecretario`, `isPatient`,
`clinicId`, `patientId`, `hasPermission()`, `canEdit()`, `signIn()`, `signOut()`, `resetPassword()`.

### `ClinicProvider` (`src/modules/clinic/hooks/useClinic.tsx`)

Exposes: `activeClinicId`, `setActiveClinicId`, `clinics` list, `activeClinic`.
Persists the selected clinic to `localStorage`.

---

## 5. Routing Architecture

Routes are defined in `src/App.tsx`. All authenticated routes are wrapped in
`<ProtectedRoute>` + `<AppLayout>`.

```
/                           → Index (redirects based on auth state)
/login                      → Login
/reset-password             → Password reset
/paciente-access            → Patient self-service entry
/onboarding/:id             → Patient onboarding wizard
/pre-cadastro               → Pre-registration form
/site                       → Public landing page
/selecionar-clinica         → Clinic picker (multi-clinic users)

Protected (inside AppLayout):
/dashboard                  → Role-based dashboard (Admin/Manager/Professional/Patient)
/pacientes                  → Patient list
/pacientes/novo             → New patient form
/pacientes/:id              → Edit patient form
/pacientes/:id/detalhes     → Patient detail view
/prontuarios                → Medical records
/agenda                     → Appointment calendar
/minha-agenda               → Professional's own agenda
/check-in                   → Professional check-in
/disponibilidade            → Availability management
/financeiro                 → Financial dashboard
/relatorios                 → Reports
/profissionais              → Professional management
/clinica                    → Clinic settings
/master                     → Master panel (super-admin)
... (and 40+ more routes)
```

**Dashboard routing** is role-driven via `<DashboardToggle>`:
- `master` → `MasterPanel`
- `admin | gestor | secretario` → `Dashboard`
- `profissional` → `ProfessionalDashboard`
- `paciente` → `PatientDashboard`

---

## 6. Data Flow

### Read flow (queries)

```
Page component
  └─ calls hook: const { data } = usePacientes(activeClinicId)
       └─ React Query: queryKey = queryKeys.patients.list(clinicId)
            └─ queryFn = patientService.getPatients({ clinicId })
                 └─ supabase.from("pacientes").select(PATIENT_COLUMNS).eq("clinic_id", clinicId)
                      └─ Returns typed Paciente[]
```

### Write flow (mutations)

```
Page component
  └─ calls: mutation.mutate(data)
       └─ React Query mutation
            └─ calls patientService.createPatient(data)
                 └─ supabase.from("pacientes").insert(data)
                      └─ On success: queryClient.invalidateQueries({ queryKey: queryKeys.patients.all })
```

### Error handling

All service methods use the centralised `handleError()` from
`src/modules/shared/utils/errorHandler.ts`:

```ts
try {
  const { data, error } = await supabase.from(...).select(...);
  if (error) throw error;
  return data;
} catch (error) {
  handleError(error, "Mensagem amigável para o usuário");
  return [];
}
```

`handleError` uses an `isErrorWithCode()` type guard (not type assertion) to safely
extract the Postgres error code and display a toast notification via `sonner`.

---

## 7. React Query Cache Keys

All cache keys are centralised in `src/modules/shared/constants/queryKeys.ts`.
**No inline string arrays** should appear in hook calls.

```ts
// Correct ✅
queryKey: queryKeys.patients.list(activeClinicId, status)

// Wrong ❌
queryKey: ["pacientes", activeClinicId]
```

The factory covers: `patients`, `appointments`, `professionals`, `finance`,
`clinical`, `clinics`, `dashboard`, `inventory`, `marketing`.

---

## 8. Internationalisation (i18n)

The platform supports **Portuguese** (default), **English**, and **Spanish**.

```
src/i18n/
├── i18n.ts                  # i18next initialisation
└── locales/
    ├── pt/common.json       # Portuguese translations
    ├── en/common.json       # English translations
    └── es/common.json       # Spanish translations
```

Components access translations through `useI18n()` (a thin adapter in
`src/modules/shared/hooks/useI18n.tsx`) that keeps the same API surface
regardless of the underlying i18n implementation.

---

## 9. Component Architecture

### Layout components (`src/components/layout/`)

| Component | Purpose |
|---|---|
| `AppLayout.tsx` | Outer shell — renders `AppSidebar` + `<Outlet>` |
| `AppSidebar.tsx` | Navigation sidebar with 6 prescribed groups |
| `ClinicSwitcher.tsx` | Multi-clinic picker in sidebar header |
| `GlobalSearch.tsx` | Command-palette style global search |
| `NotificationBell.tsx` | Real-time notification indicator |
| `ThemeToggle.tsx` | Dark/light mode toggle |
| `LanguageSwitcher.tsx` | i18n locale switcher |

### Sidebar navigation groups (admin)

1. **Pacientes** — patients, records, waiting list, pre-registrations
2. **Agendamentos** — calendar, check-in, teleconsultation, availability
3. **Profissionais** — professionals, commissions, performance
4. **Financeiro** — payments, expenses, reports
5. **Clínica** — settings, automations, marketing, gamification
6. **Configurações** — clinic profile, notifications, import, master

---

## 10. Security Architecture

See [`DATABASE.md#security`](DATABASE.md#security) for the full security model
including RLS policies, role definitions, and permission tables.

Key points:
- All authentication is handled by **Supabase Auth** (JWT)
- **Row Level Security (RLS)** policies on every table enforce data isolation per clinic
- Frontend role checks (`isAdmin`, `hasPermission()`) are UI guards only — the
  database policies are the authoritative security boundary
- The `has_role()` database function is used in RLS policies to check user roles
  without requiring a separate round-trip
