# Fisio Flow Care — Module Documentation

> This document describes every domain module: its purpose, main components,
> services, hooks, and the database tables it accesses.

---

## 1. Module Overview

```
src/modules/
├── auth/          Authentication, authorisation, role management
├── appointments/  Scheduling, availability, teleconsultation
├── patients/      Patient CRUD, records, gamification, forms
├── professionals/ Professional profiles, analytics, KPIs
├── clinic/        Clinic settings, multi-clinic groups, subscriptions
├── clinical/      Clinical records (evolutions, evaluations, documents)
├── finance/       Payments, commissions, expenses, PIX, NFe
├── inventory/     Products, equipment, stock movements
├── marketing/     Landing page content, marketing campaigns
└── shared/        Cross-cutting: queryKeys, errorHandler, i18n, hooks
```

---

## 2. `auth` Module

### Purpose
Manages user authentication (sign-in, sign-out, password reset), session lifecycle,
role loading, and fine-grained permission checks.

### Services

#### `authService.ts`
| Method | Description |
|---|---|
| `getProfile(userId)` | Fetch user profile from `profiles` |
| `getRoles(userId)` | Fetch all roles from `user_roles` |
| `getPermissions(userId)` | Fetch resource permissions from `user_permissions` |
| `getPatientId(userId)` | Resolve patient record linked to user account |
| `signIn(email, password)` | Supabase Auth sign-in |
| `signOut()` | Supabase Auth sign-out |
| `resetPassword(email)` | Trigger password reset email |

### Hooks

#### `useAuth()` — `hooks/useAuth.tsx`
Global authentication context. Provides:
- `user`, `session`, `profile`
- `roles`, `permissions`
- `isAdmin`, `isGestor`, `isProfissional`, `isSecretario`, `isPatient`, `isMaster`
- `clinicId`, `patientId`
- `hasPermission(resource)`, `canEdit(resource)`
- `signIn()`, `signOut()`, `resetPassword()`

#### `usePermission()` — `hooks/usePermission.ts` (shared module)
Thin wrapper around `useAuth()` for component-level role checks.

### Components

| Component | Purpose |
|---|---|
| `ProtectedRoute.tsx` | Redirects unauthenticated users to `/login` |
| `LoginForm.tsx` | Email + password login form with Zod validation |

### Utilities

| File | Purpose |
|---|---|
| `utils/schemas.ts` | Zod schemas for login and registration forms |

### Database Tables

| Table | Access |
|---|---|
| `profiles` | Read user profile |
| `user_roles` | Read assigned roles |
| `user_permissions` | Read resource permissions |
| `clinic_users` | Determine clinic memberships |
| `pacientes` | Resolve patient ID from user_id |

---

## 3. `appointments` Module

### Purpose
All appointment scheduling: viewing/creating/editing appointments, availability
management, recurring sessions, group sessions, check-in, and teleconsultation.

### Services

#### `appointmentService.ts`
| Method | Description |
|---|---|
| `getAppointments(options)` | List appointments with optional filters (patient, professional, clinic) |
| `getScheduleSlots(options)` | Fetch availability slots for a professional on a date range |
| `bookAppointment(params)` | Create a new appointment |
| `updateAppointment(id, data)` | Update appointment fields |
| `cancelAppointment(id, reason)` | Cancel appointment and record reason |
| `checkInPaciente(id)` | Mark patient check-in |
| `checkInProfissional(id)` | Mark professional check-in |
| `getModalidades(clinicId)` | Fetch treatment modalities |
| `getDisponibilidade(profId, date, clinicId)` | Get professional's available slots |
| `createDisponibilidade(data)` | Create availability slot |
| `updateDisponibilidade(id, data)` | Update availability slot |
| `deleteDisponibilidade(id)` | Delete availability slot |
| `getWeeklySchedule(profId, clinicId)` | Get recurring weekly schedule |
| `upsertWeeklySchedule(data)` | Create or update weekly schedule entry |

#### `schedulingService.ts`
Business logic for schedule conflict checking, capacity validation, and
recurring appointment generation. Uses `disponibilidade_profissional` and
`bloqueios_profissional` tables to determine real-time availability.

### Hooks

| Hook | Purpose |
|---|---|
| `useAppointments.ts` | Query + mutate appointments |
| `useModalidades.ts` | Fetch treatment modalities list |
| `useCrossBooking.ts` | Cross-clinic appointment booking (clinic groups) |
| `useAvailability.ts` | Check and update professional availability |

### Key Components

| Component | Purpose |
|---|---|
| `AgendaCalendar.tsx` | Full calendar view (week/day/month) |
| `AppointmentForm.tsx` | Create/edit appointment modal |
| `CheckInPanel.tsx` | Professional check-in interface |
| `DisponibilidadeForm.tsx` | Set availability slots |
| `WeeklyScheduleEditor.tsx` | Recurring schedule template editor |

### Database Tables

`agendamentos`, `disponibilidade_profissional`, `weekly_schedules`,
`bloqueios_profissional`, `lista_espera`, `feriados`, `modalidades`,
`agenda_extra`, `teleconsulta_sessions`, `teleconsulta_messages`,
`solicitacoes_remarcacao`, `solicitacoes_mudanca_horario`

---

## 4. `patients` Module

### Purpose
Patient registration, editing, detail views, medical record overview,
exercise plans, gamification points, and patient self-service portal.

### Services

#### `patientService.ts`
All methods use named column-list constants (never `select("*")`).

| Method | Description |
|---|---|
| `getPatients(options)` | List patients for a clinic with optional status filter |
| `getPatient(id)` | Get full patient record |
| `createPatient(data)` | Create new patient |
| `updatePatient(id, data)` | Update patient fields |
| `deletePatient(id)` | Soft delete patient |
| `getPatientAttachments(patientId)` | List file attachments |
| `uploadAttachment(patientId, file)` | Upload file to Supabase Storage |
| `getPatientPoints(patientId, clinicId)` | Get gamification points |
| `getPatientAchievements(patientId, clinicId)` | Get earned achievements |

### Hooks

| Hook | Purpose |
|---|---|
| `usePacientes.ts` | List patients with React Query |
| `usePatientForm.tsx` | Form state management (5 grouped state objects, replaces 47 useState) |
| `usePatientAgenda.ts` | Patient's own appointment list |
| `useGamification.ts` | Gamification points, achievements, challenges |

### Components

| Component | Purpose |
|---|---|
| `PacienteForm.tsx` (page) | Patient registration / edit form (472 lines post-refactor) |
| `PacienteDetalhes.tsx` (page) | Full patient detail view |
| `PatientCard.tsx` | Patient summary card |
| `PatientAttachments.tsx` | File upload and listing |
| `PatientAchievements.tsx` | Gamification badge display |

### Database Tables

`pacientes`, `clinic_pacientes`, `planos`, `pagamentos`, `matriculas`,
`evolutions`, `evaluations`, `patient_attachments`, `documentos_clinicos`,
`patient_achievements`, `patient_challenges`, `patient_points`,
`pesquisa_satisfacao`, `ficha_requests`, `pre_cadastros`,
`solicitacoes_alteracao_dados`, `contratos_digitais`, `planos_exercicios`

---

## 5. `professionals` Module

### Purpose
Professional profile management, education/credentials, availability display,
performance analytics (KPIs), commission rules, and AI-powered insights.

### Services

#### `professionalService.ts`
| Method | Description |
|---|---|
| `getProfessionals(clinicId)` | List professionals in a clinic |
| `getProfessional(userId)` | Get professional detail |
| `updateProfessional(id, data)` | Update profile |
| `getProfessionalStats(clinicId, period)` | Attendance KPIs per professional |
| `getFormacoes(profissionalId)` | List education/credentials |
| `addFormacao(data)` | Add education entry |
| `getGoals(professionalId, clinicId)` | List performance goals |
| `upsertGoal(data)` | Create or update a goal |

### Hooks

| Hook | Purpose |
|---|---|
| `useProfessionals.ts` | List professionals with React Query |
| `useProfessionalAnalytics.ts` | KPI calculations (attendance rate, revenue, etc.) |

### Database Tables

`profiles`, `profissional_formacoes`, `professional_goals`,
`professional_documents`, `professional_points`, `regras_comissao`,
`commissions`, `fechamentos_comissao`

---

## 6. `clinic` Module

### Purpose
Clinic profile configuration, multi-clinic group management, subscription plan
management, plan limit enforcement, and clinic-level settings.

### Services

#### `clinicGroupService.ts`
| Method | Description |
|---|---|
| `getClinicGroups(userId)` | Get groups the user belongs to |
| `createClinicGroup(data)` | Create new group |
| `addClinicToGroup(groupId, clinicId)` | Add clinic to group |
| `removeClinicFromGroup(groupId, clinicId)` | Remove clinic from group |
| `getGroupClinics(groupId)` | List clinics in group |

### Hooks

| Hook | Purpose |
|---|---|
| `useClinic.tsx` | Active clinic context (Provider) |
| `useClinicGroup.ts` | Multi-clinic group operations |
| `useClinicSettings.ts` | Read/update clinic profile and settings |
| `usePlanLimits.ts` | Check SaaS plan limits (max patients, professionals, etc.) |

### Components

| Component | Purpose |
|---|---|
| `ClinicUnitSelector.tsx` | Dropdown to switch between clinics in a group |
| `ClinicSwitcher.tsx` | Sidebar header clinic picker |
| `ClinicSettingsForm.tsx` | Clinic profile editor |

### Database Tables

`clinicas`, `clinic_settings`, `clinic_groups`, `clinic_group_members`,
`clinic_users`, `clinic_subscriptions`, `platform_plans`,
`subscription_payments`, `politicas_cancelamento`

---

## 7. `clinical` Module

### Purpose
Clinical records: evolution notes (SOAP format), patient evaluations,
digital documents, contract templates, and clinical document signing.

### Services

#### `clinicalService.ts`
Uses `Database["public"]["Tables"]["evolutions"]["Insert"]` for fully typed inserts.

| Method | Description |
|---|---|
| `getEvolutions(patientId, clinicId)` | List evolution notes for a patient |
| `createEvolution(data)` | Create SOAP evolution note |
| `updateEvolution(id, data)` | Update evolution |
| `getEvaluations(patientId, clinicId)` | List evaluations |
| `createEvaluation(data)` | Create initial evaluation |
| `getDocuments(patientId, clinicId)` | List clinical documents |
| `createDocument(data)` | Create clinical document |
| `signDocument(id, signatureUrl)` | Record digital signature |
| `getManualSections(clinicId)` | Get in-app help sections |

### Hooks

| Hook | Purpose |
|---|---|
| `useClinical.ts` | Evolutions, evaluations, documents CRUD |

### Database Tables

`evolutions`, `evaluations`, `documentos_clinicos`,
`patient_attachments`, `contratos_digitais`, `manual_sections`

---

## 8. `finance` Module

### Purpose
Financial management: payment recording and tracking, monthly enrollment billing,
commission calculation, expense tracking, PIX configuration, NFe integration,
and financial dashboards.

### Services

#### `financeService.ts`
Uses `ConfigPixEntry` type for typed PIX config operations.

| Method | Description |
|---|---|
| `getPayments(clinicId, filters)` | List payments with date/status filters |
| `createPayment(data)` | Record a payment |
| `updatePayment(id, data)` | Update payment |
| `getExpenses(clinicId)` | List operating expenses |
| `createExpense(data)` | Create expense record |
| `getCommissions(clinicId)` | List commission records |
| `calculateCommissions(clinicId, period)` | Calculate pending commissions |
| `getConfigPix(clinicId)` | Get PIX payment configuration |
| `upsertConfigPix(data)` | Create/update PIX config |
| `getFormasPagamento(clinicId)` | List payment methods |
| `getDashboardData(clinicId, startDate)` | Aggregate financial KPIs |
| `getPendencias(patientId)` | Get outstanding balances for a patient |

### Hooks

| Hook | Purpose |
|---|---|
| `useFinance.ts` | Payment CRUD + financial dashboard data |

### Database Tables

`pagamentos`, `pagamentos_mensalidade`, `pagamentos_sessoes`,
`expenses`, `commissions`, `regras_comissao`, `fechamentos_comissao`,
`config_pix`, `formas_pagamento`, `config_nfe`, `emissoes_nf`,
`convenios`, `descontos_pacientes`, `precos_planos`

---

## 9. `inventory` Module

### Purpose
Product and equipment catalogue management, stock entry/exit tracking, and
product reservation for appointments.

### Services

#### `inventoryService.ts`
Uses column name `estoque` (not `estoque_atual`) for stock quantity.

| Method | Description |
|---|---|
| `getProdutos(clinicId)` | List products |
| `createProduto(data)` | Create product |
| `updateProduto(id, data)` | Update product |
| `getEquipamentos(clinicId)` | List equipment |
| `createEquipamento(data)` | Create equipment record |
| `getEntradasEstoque(produtoId)` | List stock movements |
| `addEntradaEstoque(data)` | Record stock movement |
| `getReservas(agendamentoId)` | Get product reservations for an appointment |
| `createReserva(data)` | Reserve products |

### Hooks

| Hook | Purpose |
|---|---|
| `useInventory.ts` | Products, equipment, and stock CRUD |

### Database Tables

`produtos`, `equipamentos`, `entradas_estoque`,
`reservas_produtos`, `vendas_produtos`

---

## 10. `marketing` Module

### Purpose
Public landing page content management and marketing campaigns.

### Hooks

| Hook | Purpose |
|---|---|
| `useLandingContent.ts` | Read/update public landing page sections |

### Database Tables

`landing_content`, `marketing_campaigns`, `contact_submissions`,
`categorias_parceiros`

---

## 11. `shared` Module

### Purpose
Cross-cutting utilities and hooks that are used by all other modules.
Has **zero** dependency on Supabase or any domain module.

### Key Files

| File | Purpose |
|---|---|
| `constants/queryKeys.ts` | Centralised React Query key factory (26 tests) |
| `utils/errorHandler.ts` | Unified error handling with `isErrorWithCode()` type guard |
| `hooks/useI18n.tsx` | i18next adapter (thin wrapper, same API for consumers) |
| `hooks/usePermission.ts` | Role check utility from `useAuth()` |
| `hooks/useDashboardLayout.ts` | Dashboard layout state (sidebar collapsed, etc.) |
| `hooks/usePersistedFilter.ts` | Filter state persisted to `localStorage` |
| `services/auditService.ts` | Write to `audit_logs` table |

### Database Tables

`audit_logs`

---

## 12. Module Dependency Rules

```
shared ← (no imports from any domain module or supabase)
auth   ← shared
appointments ← shared, auth
patients ← shared, auth
professionals ← shared, auth
clinic ← shared, auth
clinical ← shared, auth
finance ← shared, auth
inventory ← shared, auth
marketing ← shared
```

**Cross-module imports are only allowed at the `hooks` level:**
- `useAppointments` may import from `useClinic` (to read `activeClinicId`)
- `usePacientes` may import from `useAuth` (to read `clinicId`)
- Components should **not** import from sibling domain modules directly

See [`docs/dependency-map.md`](docs/dependency-map.md) for the full inter-module
dependency graph and violation catalogue.
