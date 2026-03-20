# Fisio Flow Care

![Tests](https://img.shields.io/badge/tests-372%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Supabase-blue.svg)

> **SaaS platform for physiotherapy and pilates clinic management**

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Documentation](#documentation)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

---

## Overview

Fisio Flow Care is a comprehensive SaaS platform built for physiotherapy and pilates clinics. It supports multi-clinic management groups, online scheduling, patient records, financial control, gamification, AI-assisted analytics, and teleconsultation.

**Target users:**
| Role | Description |
|---|---|
| `admin` | Clinic administrator — full access to all features |
| `gestor` | Clinic manager — operational access |
| `profissional` | Physiotherapist / instructor |
| `secretario` | Receptionist / front-desk |
| `paciente` | Patient / student with self-service portal |
| `master` | Platform super-admin (multi-clinic oversight) |

---

## Key Features

- **Patient management** — registration, medical records (prontuários), attachments, NPS surveys, gamification points
- **Scheduling** — individual/group sessions, recurrence, waiting list, availability slots, teleconsultation
- **Financial** — payment tracking, plans (planos), enrollments (matrículas), commissions, PIX, NFe integration, expense management
- **Clinical records** — evolutions, evaluations, exercise plans, digital documents/contracts, attachments
- **Professionals** — profile management, availability, performance KPIs, commission rules, AI insights
- **Clinic settings** — multi-clinic groups, cross-booking, landing page editor, notifications, branding
- **Intelligence** — churn prediction, occupancy reports, AI-powered KPI insights, marketing campaigns
- **Gamification** — achievements, challenges, rewards catalog, leaderboard
- **i18n** — Portuguese (default), English, Spanish via i18next

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| State / data fetching | TanStack React Query v5 |
| Forms | React Hook Form + Zod |
| Backend / database | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Routing | React Router v6 |
| Internationalisation | i18next + react-i18next |
| Testing | Vitest + jsdom |
| PDF generation | jsPDF |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18 (see `.nvmrc`)
- npm ≥ 9
- A Supabase project (see [Environment Variables](#environment-variables))

### Install & run

```bash
# 1. Clone
git clone https://github.com/Ewrogabriel/app-essencial.git
cd app-essencial

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start development server (http://localhost:8080)
npm run dev
```

### Other scripts

```bash
npm run build          # Production build
npm run build:dev      # Development build
npm run preview        # Preview production build
npm run lint           # ESLint
npm test               # Run all tests (372 tests, 34 files)
npm run test:coverage  # Tests + V8 coverage report
npm run test:watch     # Tests in watch mode
```

---

## Project Structure

```
app-essencial/
├── src/
│   ├── App.tsx                  # Root component, routing tree
│   ├── main.tsx                 # Vite entry point
│   ├── modules/                 # Domain modules (services · hooks · utils)
│   │   ├── auth/                # Authentication & authorisation
│   │   ├── appointments/        # Scheduling & appointments
│   │   ├── patients/            # Patient management
│   │   ├── professionals/       # Professional profiles & analytics
│   │   ├── clinic/              # Clinic settings & multi-group
│   │   ├── clinical/            # Clinical records (evolutions, evaluations)
│   │   ├── finance/             # Payments, commissions, expenses
│   │   ├── inventory/           # Products & equipment
│   │   ├── marketing/           # Landing page content
│   │   └── shared/              # Cross-cutting: queryKeys, errorHandler, i18n, hooks
│   ├── pages/                   # 64 route-level components
│   ├── components/              # Reusable UI components
│   │   ├── layout/              # AppLayout, AppSidebar, navigation
│   │   ├── ui/                  # shadcn/ui primitives
│   │   └── [feature]/           # Feature-specific components
│   ├── types/                   # Shared TypeScript interfaces (entities.ts)
│   ├── lib/                     # Utilities (availability, PDF, query client)
│   ├── i18n/                    # i18next setup + locale files (pt/en/es)
│   └── integrations/supabase/   # Generated Supabase client + types
├── supabase/
│   └── migrations/              # 104 SQL migration files
├── docs/                        # Technical documentation
│   ├── dependency-map.md        # Module dependency graph
│   └── ...
├── public/                      # Static assets
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── tailwind.config.ts
```

See [`docs/dependency-map.md`](docs/dependency-map.md) for the full inter-module dependency graph.

---

## User Roles

```
master   ──► full platform access (multi-clinic oversight, master panel)
admin    ──► full clinic access (all modules)
gestor   ──► operational access (no master panel)
secretario ──► scheduling, patients, basic financials
profissional ──► own schedule, own patients, own records
paciente ──► self-service portal (own appointments, payments, records)
```

Role and permission checks are enforced via `useAuth()` (frontend) and Supabase Row Level Security policies (backend).

---

## Documentation

| Document | Contents |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture, data flow, component hierarchy |
| [`DATABASE.md`](DATABASE.md) | All 82 database tables, relationships, enums |
| [`MODULES.md`](MODULES.md) | Domain module documentation |
| [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) | Development guide, adding modules, conventions |
| [`docs/dependency-map.md`](docs/dependency-map.md) | Module dependency map with violation catalogue |

---

## Testing

```bash
npm test                # Run all 372 tests across 34 files
npm run test:coverage   # Generate V8 coverage report (threshold: 60%)
```

Test files live next to the code they test in `__tests__/` sub-directories.
Service tests use a **Proxy-based thenable chain** to mock Supabase calls.

Coverage thresholds (see `vitest.config.ts`):
- Lines: 60% · Functions: 60% · Branches: 50% · Statements: 60%

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

These are the **only** required variables. The Supabase anon key is safe to expose
in the browser — Row Level Security policies control data access.