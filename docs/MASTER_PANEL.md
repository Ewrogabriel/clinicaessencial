# Master Panel

## Overview

The Master Panel is the top-level administrative interface accessible only to users with the `master` role. It provides a unified view across all clinics in the platform, including revenue analytics, feature management, user administration, and audit logging.

Route: `/master`

Access is guarded by `<RequireRole roles={["master"]}>`.

---

## Sub-pages & Tabs

The `/master` route renders `MasterPanel`, which organises content into tabs. Each tab can also be accessed via a dedicated route:

| Tab | Route | Component |
|-----|-------|-----------|
| Clinic Management | `/master/clinicas` | `ClinicManagement` |
| Revenue Analytics | `/master/revenue` | `RevenueAnalytics` |
| Feature Flags | `/master/features` | `FeatureFlagsPanel` |
| User Management | `/master/users` | `UserManagement` |
| Audit Logs | `/master/audit` | `AuditLogs` |

---

## Components

| Component | Path | Description |
|-----------|------|-------------|
| `ClinicManagement` | `pages/master/ClinicManagement` | List, create, suspend, and configure clinics |
| `RevenueAnalytics` | `pages/master/RevenueAnalytics` | Platform-wide revenue charts and KPIs |
| `FeatureFlagsPanel` | `pages/master/FeatureFlagsPanel` | Toggle features per clinic or globally |
| `UserManagement` | `pages/master/UserManagement` | Search, impersonate, and manage all users |
| `AuditLogs` | `pages/master/AuditLogs` | View timestamped action logs across all clinics |
| `ClinicTable` | `components/master/ClinicTable` | Paginated table of clinic records |
| `RevenueChart` | `components/master/RevenueChart` | Time-series chart of MRR and other metrics |
| `FeatureFlagToggle` | `components/master/FeatureFlagToggle` | Individual feature flag toggle control |

---

## Modules

| Module | Path | Description |
|--------|------|-------------|
| `masterService` | `modules/master/services/masterService` | Supabase calls for master-level data |
| `useMasterAdmin` | `modules/master/hooks/useMasterAdmin` | Clinic list, user management, audit data |
| `useRevenueAnalytics` | `modules/master/hooks/useRevenueAnalytics` | Revenue KPI fetching and aggregation |

---

## Business Metrics

The Revenue Analytics tab tracks the following KPIs:

| Metric | Description |
|--------|-------------|
| **MRR** (Monthly Recurring Revenue) | Sum of active subscription fees in the current month |
| **CAC** (Customer Acquisition Cost) | Total acquisition spend divided by new clinics in the period |
| **LTV** (Lifetime Value) | Average revenue per clinic multiplied by average retention months |
| **Churn Rate** | Percentage of clinics that cancelled within a given period |

Charts are rendered by `RevenueChart` and powered by `useRevenueAnalytics`.

---

## Feature Flags Table

Feature flags are stored in the `feature_flags` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `nome` | text | Feature identifier (e.g., `teleconsulta`, `gamificacao`) |
| `descricao` | text | Human-readable description |
| `ativo_globalmente` | boolean | Enabled for all clinics when `true` |
| `clinica_id` | uuid | Scope to a specific clinic (`null` = global) |
| `criado_em` | timestamptz | Creation timestamp |
| `atualizado_em` | timestamptz | Last update timestamp |

`FeatureFlagToggle` calls `masterService.toggleFeatureFlag()` to update these rows. Changes take effect immediately via real-time Supabase subscriptions.

---

## Security

- All `/master/*` routes are wrapped in `<RequireRole roles={["master"]}>`, which redirects non-master users to `/dashboard`.
- `masterService` uses the authenticated user's JWT; server-side RLS policies enforce that only `master`-role users can query platform-wide data.
- Impersonation actions in `UserManagement` are logged to the audit table with actor, target, and timestamp.
- The `DashboardToggle` component in `App.tsx` redirects master users automatically: `if (isMaster && !isAdmin) return <MasterPanel />;`
