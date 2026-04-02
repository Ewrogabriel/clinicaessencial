# Architecture (Updated – Post Phase 4 Refactor)

> **Status:** Current as of Phase 4 (April 2026)

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Module Architecture](#4-module-architecture)
5. [Data Flow](#5-data-flow)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Routing Strategy](#7-routing-strategy)
8. [State Management](#8-state-management)
9. [Component Hierarchy](#9-component-hierarchy)
10. [Key Architectural Decisions](#10-key-architectural-decisions)

---

## 1. High-Level Overview

Clínica Essencial is a **React 18 + Supabase** single-page application for clinic management. It serves four primary roles: **admin/gestor**, **secretário**, **profissional** and **paciente**, each with a tailored dashboard and permission set.

```
Browser (React SPA)
      │
      ▼
 src/App.tsx  ──────────────── BrowserRouter (react-router-dom v6)
      │                               │
      │                        60+ Routes (see RoutesConfig.ts)
      ▼
 AuthProvider / ClinicProvider  ← Global context
      │
      ├─ AppLayout (protected)
      │     ├─ AppSidebar (navigation)
      │     └─ <Outlet> (page content)
      │
      └─ Public pages (no layout wrapper)
```

```
React SPA ──HTTP──▶ Supabase Edge (REST + Realtime)
                          │
                    ┌─────┴──────┐
                 Postgres     Storage
                 (RLS)        (files)
```

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Routing | react-router-dom v6 |
| UI components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS |
| Server state | TanStack Query v5 |
| Forms | react-hook-form + zod |
| Backend / DB | Supabase (Postgres + Auth + Storage) |
| Animations | framer-motion |
| Charts | recharts |
| PDF generation | jsPDF + jspdf-autotable |
| Testing | Vitest + React Testing Library |
| i18n | react-i18next |

---

## 3. Directory Structure

```
src/
├── App.tsx                    # Root component; all routes defined here
├── main.tsx                   # React entry point
├── pages/                     # One file per route (+ subdirs for sub-modules)
│   ├── auth/
│   │   └── RoutesConfig.ts    # Route catalogue with descriptions & roles
│   ├── patients/
│   │   └── PatientFormBuilder.tsx  # Unified patient form (3 flows → 1)
│   ├── gamification/          # Gamification-specific pages
│   └── master/                # Master-admin pages
├── components/
│   ├── ui/                    # shadcn/ui primitives (do not edit)
│   ├── layout/                # AppLayout, AppSidebar, Header
│   └── ...                    # Feature-specific components
├── modules/                   # Domain modules (self-contained)
│   ├── auth/                  # useAuth hook, ProtectedRoute, schemas
│   ├── clinic/                # useClinic hook
│   ├── patients/              # Patient services, hooks, components
│   ├── finance/               # Payment services
│   ├── appointments/          # Scheduling services
│   ├── professionals/         # Professional services
│   └── shared/                # Shared hooks, utilities
├── integrations/supabase/     # Auto-generated Supabase client + types
├── lib/                       # Pure utility functions (masks, PDF, etc.)
├── types/                     # Global TypeScript type definitions
└── test/                      # Test infrastructure
    ├── setup.ts               # Global test setup
    ├── integration/           # Integration test suites
    └── *.test.{ts,tsx}        # Unit tests
```

---

## 4. Module Architecture

Each feature module under `src/modules/` follows this structure:

```
modules/<domain>/
├── components/    # Domain-specific React components
├── hooks/         # Custom React hooks (data fetching, state)
├── services/      # Pure async functions (Supabase calls)
├── utils/         # Domain-specific utilities
└── __tests__/     # Unit tests
```

**Rule:** Components call hooks; hooks call services; services call Supabase. Pages import hooks directly or via context.

---

## 5. Data Flow

```
Page Component
      │ calls
      ▼
useXxx() hook  (TanStack Query or useState)
      │ calls
      ▼
XxxService.method()
      │ calls
      ▼
supabase.from("table")...   (src/integrations/supabase/client.ts)
      │
      ▼
Supabase Postgres (RLS enforced)
```

**Realtime subscriptions** follow the same path but return a channel that is cleaned up in `useEffect`.

---

## 6. Authentication & Authorization

- **Provider:** Supabase Auth (email + password, magic link).
- **Context:** `useAuth()` from `src/modules/auth/hooks/useAuth.tsx`.
- **Route protection:** `<ProtectedRoute>` redirects unauthenticated users to `/login`. `<RequireRole roles={[...]}>` renders 403 for insufficient roles.
- **Roles:** `admin | gestor | secretario | profissional | paciente | master` stored in `user_roles` table.
- **RLS:** Every Postgres table has Row-Level Security policies. The service role key is never exposed to the client.

---

## 7. Routing Strategy

Routes are declared in `src/App.tsx` and documented in `src/pages/auth/RoutesConfig.ts`.

**Groups:**
- `authRoutes` – public / pre-auth pages
- `protectedRoutes` – main app (requires login)
- `adminRoutes` – master-only panel
- `redirectRoutes` – legacy URL aliases (kept for 6-week migration window)

All protected routes are lazy-loaded via `React.lazy()` for code splitting.

---

## 8. State Management

| Concern | Solution |
|---------|---------|
| Server/async data | TanStack Query (`useQuery`, `useMutation`) |
| Auth state | React Context (`AuthProvider`) |
| Clinic selection | React Context (`ClinicProvider`) |
| UI / local state | `useState` / `useReducer` |
| Form state | `react-hook-form` |
| Theme | `next-themes` |

A single `QueryClient` instance is created in `src/lib/queryClient.ts`. On sign-out, the cache should be cleared to prevent stale cross-user data (see `docs/SECURITY_AUDIT.md`).

---

## 9. Component Hierarchy

```
App
└── ThemeProvider
    └── QueryClientProvider
        └── I18nProvider
            └── AuthProvider
                └── ClinicProvider
                    └── BrowserRouter
                        └── Suspense
                            ├── [public pages]
                            └── ProtectedRoute
                                └── AppLayout
                                    ├── AppSidebar
                                    ├── Header
                                    └── <Outlet> ← page content
```

---

## 10. Key Architectural Decisions

| Decision | Rationale |
|---------|-----------|
| Single `App.tsx` with all routes | Centralises routing for easier navigation; RoutesConfig.ts provides documentation |
| Lazy-loading all pages | Reduces initial bundle; only critical path (Index, Login, NotFound) is eager |
| Module-per-domain under `src/modules/` | Clear ownership; modules are independently testable |
| TanStack Query for server state | Handles caching, deduplication, background refetch, optimistic updates |
| Supabase RLS for multi-tenancy | Security enforced at DB level; no risk of accidental data leaks |
| PatientFormBuilder as single form source | Eliminates ~600 lines of duplication across PacienteForm, PatientOnboarding, PreCadastro |
