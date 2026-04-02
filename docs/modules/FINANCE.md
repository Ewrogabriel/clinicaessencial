# Finance Module

Overview of the financial features: payments, bank reconciliation, commissions and reports.

---

## Features

| Feature | Route | Roles |
|---------|-------|-------|
| Financial overview | `/financeiro` | admin, gestor, master, secretario |
| Bank reconciliation | `/financeiro/conciliacao` | admin, gestor, master |
| Commissions | `/comissoes` | authenticated |
| Reports | `/relatorios` | admin, gestor, master |
| Investments | `/investimentos` | admin, gestor, master |

---

## Payment Statuses

`pagamentos.status_pagamento` is a Postgres ENUM with:

| Value | Meaning |
|-------|---------|
| `pendente` | Awaiting payment |
| `pago` | Paid |
| `cancelado` | Cancelled |
| `reembolsado` | Refunded |
| `vencido` | Overdue |

---

## Payment Origin Types

`pagamentos.origem_tipo` is a TEXT column with a CHECK constraint:

- `matricula` – enrollment/subscription
- `plano` – plan payment
- `sessao_avulsa` – individual session
- `manual` – manually recorded

---

## Bank Reconciliation

The reconciliation page (`ConciliacaoBancaria.tsx`) matches `bank_transactions` against `pagamentos`.

`bank_transactions.tipo` is derived from the `valor` sign:
- positive value → `credito`
- negative value → `debito`

**Security note:** Both `bank_accounts` and `bank_transactions` currently have permissive RLS (`USING(true)`). See [SECURITY_AUDIT.md](../SECURITY_AUDIT.md) for the remediation plan.

---

## Commissions

Commissions are calculated per professional based on:
- Total paid sessions in the period
- Commission rate configured per professional

Formula: `commission = total_paid × commission_rate`

---

## Query Pattern

```typescript
// Scoped by clinic – always filter by clinic_id
const { data: payments } = useQuery({
  queryKey: ["pagamentos", activeClinicId],
  queryFn: async () => {
    const { data } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("clinic_id", activeClinicId)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
  enabled: !!activeClinicId,
});
```

---

## PDF Generation

Receipts and financial reports are generated with jsPDF + jspdf-autotable. See `src/lib/generateReceiptPDF.ts` and `src/lib/generateClinicReportPDF.ts`.
