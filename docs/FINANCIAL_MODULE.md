# Financial Module

## Overview

The financial module consolidates all payment and revenue management into a single unified interface.

## Architecture

### Services (`src/modules/finance/services/`)

| Service | Responsibility |
|---------|---------------|
| `financeService.ts` | Core payment CRUD, unified payment listing across 3 tables |
| `reconciliationService.ts` | Bank transaction review: approve/reject/bulk/undo |
| `financialAggregationService.ts` | Batched KPI aggregation and monthly chart data |

### Hooks (`src/modules/finance/hooks/`)

| Hook | Stale Time | Description |
|------|-----------|-------------|
| `useFinance.ts` | Default | Patient-facing payment data |
| `useReconciliation.ts` | 5 min | Reconciliation state with bulk selection |
| `useFinancialDashboard.ts` | KPIs: 1h, Charts: 4h | Aggregated financial KPIs |

### Components (`src/components/financial/`)

| Component | Description |
|-----------|-------------|
| `FinancialTabs` | Consolidated tab layout (replaces old inline Tabs in `Financeiro.tsx`) |
| `ReconciliationPage` | Bank transaction list with bulk approve/reject |
| `TransactionFilter` | Filter bar: date range, payment method, status, search |
| `BulkApprovalDialog` | Confirmation dialog for bulk approve/reject with note |
| `TransactionDetailDrawer` | Sheet panel: transaction fields, actions, timeline |
| `TransactionTimeline` | Audit trail showing import → review events |

## Financial Tabs

The `FinancialTabs` component unifies:

1. **Visão Geral** — `FinanceDashboard` with KPIs
2. **Pagamentos** — All payments (passed as `pagamentosContent` prop)
3. **Previsão** — Upcoming/overdue payments (passed as `previsaoContent` prop)
4. **Despesas** — Expense management
5. **Comissões** — Professional commissions
6. **Notas Fiscais** — Invoices
7. **Conciliação** — Bank reconciliation (`ReconciliationPage`)
8. **DRE** — Income statement (passed as `dreContent` prop)
9. **Integrações** — External integration status

## Caching Strategy

| Data | Stale Time | Notes |
|------|-----------|-------|
| Dashboard metrics | 1 hour | Aggregated via `dashboardService` |
| Monthly charts | 4 hours | Lazy-loaded |
| KPIs | 1 hour | Month-scoped |
| Reconciliation list | 5 minutes | Per filters |

## Bank Reconciliation

### Workflow

1. Import transactions from bank CSV (existing `ConciliacaoBancaria` importer)
2. Open **Conciliação** tab to review pending transactions
3. Filter by date, payment method, status, or search description
4. Select individual or all transactions
5. Approve or reject in bulk with an optional note
6. Undo reviews within a **5-minute window**

### Status Values

| Status | Description |
|--------|-------------|
| `pendente` (null) | Not yet reviewed |
| `aprovado` | Manually approved |
| `rejeitado` | Manually rejected |

### Audit Trail

Each approval/rejection records:
- `reviewed_at` timestamp
- `reviewed_by` user UUID
- Optional note stored in `review_note`

## Utilities (`src/modules/finance/utils/`)

### `reconciliationHelpers.ts`
- `getStatusConfig(status)` — label + CSS class
- `formatBRL(value)` — Brazilian currency format
- `sortTransactions(list)` — pending-first sort
- `groupTransactionsByDate(list)` — date-keyed grouping
- `canUndo(transaction)` — checks 5-minute undo window
- `calcRunningBalance(list)` — running balance array

### `permissionSchemas.ts`
See [PERMISSIONS_SCHEMA.md](./PERMISSIONS_SCHEMA.md).

## Database Migrations

| Migration | Change |
|-----------|--------|
| `20260402020000_add_reconciliation_tracking.sql` | Adds `rejection_reason`, `review_note`, `idx_bank_transactions_status_clinic`, `email_delivery_log` table |
| `20260402030000_add_permission_validation.sql` | Adds `user_permissions` JSONB to `profiles`, `audit_logs` table |
