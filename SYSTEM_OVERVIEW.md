# Fisio Flow Care — System Overview

> **Reverse engineering analysis** — complete system description reconstructed from the codebase.
> Use this document as your entry point before reading any other file.

---

## 1. What Is This System?

**Fisio Flow Care** is a multi-tenant SaaS platform for **physiotherapy and pilates clinic management**.
It covers the full operational cycle of a clinic: from patient registration and appointment scheduling
through to clinical records, financial tracking, and staff performance analytics.

The system is a **single-page React application** backed by **Supabase** (PostgreSQL + Auth + Realtime + Storage).
It is fully multi-clinic (one database, multiple isolated tenant clinics) and supports an optional
**clinic group** model where several clinic units share patients and data.

---

## 2. Who Uses It?

| Role | Portuguese label | Capabilities |
|---|---|---|
| **Master** | `master` | Super-admin. Manages all clinic tenants from a dedicated panel (`/master`). |
| **Admin** | `admin` | Full access to all clinic data: patients, scheduling, finance, staff, settings. |
| **Gestor** | `gestor` | Same as admin but scoped to one clinic. No access to master panel. |
| **Profissional** | `profissional` | Views own schedule, records clinical evolutions, sees own commissions. |
| **Secretário** | `secretario` | Manages scheduling and patient intake. Limited financial access. |
| **Paciente** | `paciente` | Reads own records, upcoming sessions, payments, and achievements via patient portal. |

---

## 3. Core Capabilities

### Patient Management
- Full patient lifecycle: registration, status tracking (`ativo / inativo / suspenso`), treatment plans
- Clinical records: SOAP evolutions, evaluations, documents, attachments
- Gamification: achievements and goal tracking for patient engagement
- Patient portal with self-service onboarding and online access

### Appointment Scheduling
- Individual, group, teleconsultation (`teleconsulta`), and home-visit (`domiciliar`) sessions
- Professional availability management and blocking
- Double-booking prevention at service layer
- Weekly schedule templates (`weekly_schedules`)
- Cross-clinic booking (patients can book across units in same group)
- Real-time status updates: `agendado → confirmado → realizado / cancelado / falta`

### Clinical Records
- Evolution notes (SOAP format) per appointment
- Formal evaluations linked to patient history
- Clinical document management with file attachments (Supabase Storage)
- Exercise plan management (`PlanosExercicios`)

### Financial Management
- Session payments with multiple payment methods (cash, card, PIX, insurance)
- PIX configuration per clinic
- Commission engine: fixed or percentage per professional
- Expense tracking
- Revenue dashboard and period reports
- Electronic invoice (NFe) integration stub

### Professional Management
- Professional profiles with specialties, availability colours
- Analytics dashboard: sessions, revenue, commissions, patient count
- Personal goal setting and KPI tracking
- Public profile pages (`/perfil-profissional/:id`)

### Clinic & Multi-Tenant
- Per-clinic settings (name, logo, address, hours, payment methods)
- Multi-clinic groups: several units share patient records and cross-book
- Subscription plans with configurable limits (`check_plan_limit()` DB function)
- Clinic selector for users who belong to multiple clinics

### Communication & Marketing
- Internal messaging system (`MensagensInternas`)
- Admin notifications/bulletins (`AvisosAdmin`)
- Automated notifications (`Automacoes`)
- Landing page content manager for public clinic sites (`/site`)
- Marketing campaign management

### Inventory
- Product and equipment catalogue
- Stock entry and movement tracking
- Product reservation per appointment

### Internationalisation
- Powered by `i18next` with Brazilian Portuguese (`pt`), English (`en`), and Spanish (`es`)
- Language selector accessible to all users

---

## 4. Core Modules

```
src/modules/
├── auth/          ← Authentication, session, roles, permissions
├── appointments/  ← Scheduling, availability, teleconsultation
├── patients/      ← Patient CRUD, plans, gamification, forms
├── professionals/ ← Profiles, analytics, goals
├── clinic/        ← Settings, multi-clinic groups, subscriptions
├── clinical/      ← Evolutions, evaluations, documents
├── finance/       ← Payments, commissions, expenses, PIX
├── inventory/     ← Products, equipment, stock
├── marketing/     ← Landing page, campaigns
└── shared/        ← Cross-cutting utilities (queryKeys, i18n, errors)
```

Full module documentation → [`MODULES.md`](MODULES.md)

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | React 18 (TypeScript) |
| **Build tool** | Vite |
| **Routing** | React Router v6 (`<Routes>` / lazy-loaded pages) |
| **Data fetching & cache** | TanStack React Query v5 |
| **Backend** | Supabase (PostgreSQL 15, Auth, Storage, Realtime) |
| **Database migrations** | Supabase CLI — 104 migration files |
| **Forms** | React Hook Form + Zod |
| **UI components** | shadcn/ui + Radix UI primitives |
| **Styling** | Tailwind CSS |
| **Internationalisation** | i18next + react-i18next |
| **Testing** | Vitest + Testing Library — 372 tests across 34 files |
| **State** | React Context (Auth, Clinic) + React Query cache |

---

## 6. Key Numbers

| Metric | Count |
|---|---|
| Domain modules | 10 |
| Application pages (routes) | 65 |
| Database tables | 82 |
| Database migrations | 104 |
| Service methods | ~80 |
| React Query cache keys | 40+ |
| Total tests | 372 (34 files) |
| Supported languages | 3 (pt, en, es) |
| Supabase enum types | 7 |
| User roles | 6 |

---

## 7. System Constraints & Design Decisions

1. **Strict layered architecture** — only the service layer touches Supabase. Pages and components
   must go through hooks. (A refactoring effort is ongoing to migrate 110 direct-import violations.)
2. **Row-Level Security everywhere** — every public table has RLS enabled. No table allows anonymous
   reads or writes. All policies are enforced server-side via `has_role()` DB helper functions.
3. **Clinic isolation** — every data query filters by `clinic_id`. Cross-clinic access requires
   membership in the same `clinic_group`.
4. **Named column selects** — service files never use `select("*")`. Each service declares an
   explicit column constant (e.g. `PATIENT_COLUMNS`) to control the fetch surface and TypeScript types.
5. **Centralised React Query keys** — all cache keys are defined in
   `src/modules/shared/constants/queryKeys.ts`. Inline string arrays are prohibited.
6. **Error surfacing** — all service errors pass through `handleError()` which shows a `sonner` toast
   and returns an `AppError` instance with optional Supabase error code.

---

## 8. Navigation Structure

The admin sidebar (`AppSidebar.tsx`) is divided into **6 prescribed groups**:

| Group | Routes |
|---|---|
| **Pacientes** | `/pacientes`, `/prontuarios`, `/contratos`, `/documentos-clinicos`, `/planos-exercicios` |
| **Agendamentos** | `/agenda`, `/modalidades`, `/disponibilidade`, `/teleconsulta` |
| **Profissionais** | `/profissionais`, `/comissoes`, `/metas-gamificacao` |
| **Financeiro** | `/financeiro`, `/relatorios` |
| **Clínica** | `/configuracoes`, `/inventario`, `/marketing`, `/automacoes`, `/importacao` |
| **Configurações** | `/convenios`, `/mensagens`, `/avisos` |

The route `/disponibilidade` renders `DisponibilidadeProfissional`, **not** the `Profissionais` page.

---

## 9. Further Reading

| Document | Contents |
|---|---|
| [`README.md`](README.md) | Quick start, environment setup, running locally |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Layered architecture, component hierarchy, data flow |
| [`ARCHITECTURE_DIAGRAM.md`](ARCHITECTURE_DIAGRAM.md) | Visual architecture and dependency diagrams |
| [`MODULE_MAP.md`](MODULE_MAP.md) | Module dependency map and inter-module relationships |
| [`DATA_FLOW.md`](DATA_FLOW.md) | State management, API patterns, React Query lifecycle |
| [`DATABASE.md`](DATABASE.md) | All 82 tables with columns and relationships |
| [`DATABASE_MODEL.md`](DATABASE_MODEL.md) | ER-style database model |
| [`MODULES.md`](MODULES.md) | Per-module documentation (services, hooks, components, tables) |
| [`WORKFLOWS.md`](WORKFLOWS.md) | Step-by-step user journey workflows |
| [`SECURITY_ANALYSIS.md`](SECURITY_ANALYSIS.md) | Authentication, RLS, role permissions, vulnerabilities |
| [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) | Install, run, extend, add modules and tables |
