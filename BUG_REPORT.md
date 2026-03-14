# Bug Detection Audit Report — Fisio Flow Care

**Date:** 2026-03-14  
**Auditor:** Senior SRE (automated deep audit)  
**Stack:** React · TypeScript · Vite · Supabase  
**Test baseline:** 372 tests across 34 files (all passing before audit)

---

## Summary

| # | Severity | Area | Status |
|---|----------|------|--------|
| 1 | 🔴 Critical | `Agenda.tsx` – drag-drop uses wrong `profissionalId` | ✅ Fixed |
| 2 | 🟠 High | `AgendamentoForm.tsx` – null `clinic_id` passed to `bookAppointment` | ✅ Fixed |
| 3 | 🟠 High | `Dashboard.tsx` – 6 sequential Supabase queries in monthly chart | ✅ Fixed |
| 4 | 🟡 Medium | `useAuth.tsx` – stale closure in safety timer | ✅ Fixed |
| 5 | 🟡 Medium | `inventoryService.ts` – `select("*")` inconsistent with service layer pattern | ✅ Fixed |
| 6 | 🟢 Low | `authService.ts` – `getProfile` uses `select("*")` | ✅ Fixed |

---

## Detailed Findings

---

### Bug #1 — 🔴 Critical: Drag-drop reschedule uses wrong professional ID

**File:** `src/pages/Agenda.tsx`  
**Line:** `handleDragDrop` function

**Root Cause:**  
When an appointment is drag-dropped to a new time slot, the `rescheduleMutation` was called with `profissionalId: user?.id || ""`, passing the **current logged-in user's** ID instead of the **appointment's own professional's** ID.

**Impact:**  
- The double-booking check (`checkDoubleBooking`) runs against the wrong professional.  
- If the currently logged-in user is an admin or gestor (not the appointment's professional), the check passes silently — allowing genuine double-bookings for the actual professional.  
- In any non-trivial clinic with multiple professionals managed by one admin, this bug would silently corrupt scheduling data.

**Risk Level:** Critical — silent data corruption.

**Before:**
```typescript
const handleDragDrop = async (agId: string, newDate: Date) => {
  rescheduleMutation.mutate({ id: agId, newDate, profissionalId: user?.id || "" }, {
    ...
  });
};
```

**After:**
```typescript
const handleDragDrop = async (agId: string, newDate: Date) => {
  // Look up the appointment's own professional — not the logged-in user
  const ag = agendamentos.find((a) => a.id === agId);
  const profissionalId = ag?.profissional_id || user?.id || "";
  rescheduleMutation.mutate({ id: agId, newDate, profissionalId }, { ... });
};
```

---

### Bug #2 — 🟠 High: Null `clinic_id` passed to `bookAppointment`

**File:** `src/components/agenda/AgendamentoForm.tsx`  
**Function:** `onSubmit`

**Root Cause:**  
`activeClinicId` is `string | null` (from `useClinic()`). It was passed directly as `clinic_id` to `bookAppointmentMutation.mutateAsync()` without a null guard. If no clinic is selected (e.g. during initial load or an edge-case state), `clinic_id: null` would be written to the database.

**Impact:**  
- Appointment row created with a null `clinic_id`, breaking all clinic-filtered queries.  
- TypeScript type mismatch: `bookAppointment` expects `clinic_id: string`.

**Risk Level:** High — silent data integrity violation.

**Fix:** Added an early return with a user-visible error when `activeClinicId` is null:
```typescript
if (!activeClinicId) {
  toast.error("Selecione uma clínica antes de criar um agendamento.");
  return;
}
```

---

### Bug #3 — 🟠 High: Sequential Supabase queries in monthly chart (N+1 anti-pattern)

**File:** `src/pages/Dashboard.tsx`  
**Query:** `dashboard-monthly-chart`

**Root Cause:**  
The dashboard's monthly session chart computed data for 6 consecutive months using a `for...of` loop with `await` inside, making 6 sequential round-trips to Supabase instead of running them in parallel.

**Impact:**  
- Dashboard load time for the monthly chart is ~6× slower than necessary.  
- On a slow connection this causes a perceptible waterfall: the chart only appears after all 6 requests complete serially.

**Risk Level:** High — significant UX degradation.

**Fix:** Replaced the serial loop with `Promise.all`:
```typescript
const rows = await Promise.all(
  months.map(async (m) => {
    let q = supabase.from("agendamentos").select("status")...;
    const { data } = await q;
    ...
  })
);
```

---

### Bug #4 — 🟡 Medium: Stale closure in `useAuth` safety timer

**File:** `src/modules/auth/hooks/useAuth.tsx`  
**Location:** `useEffect` safety timer (`setTimeout` after 8 s)

**Root Cause:**  
The safety timer compared `loading` to decide whether to call `setLoading(false)`. Because `loading` was captured by the closure at effect-creation time (when its value was always `true`), the condition `if (mounted && loading)` would always evaluate `true` at the time the timer fired — even if `loading` had already been set to `false` by the normal auth flow.

In practice this was benign (calling `setLoading(false)` on an already-false state is a React no-op), but it:
1. Gave a false sense of safety (the guard never actually prevented a redundant `setLoading`).  
2. Creates a subtle bug if `loading` semantics ever change.

**Risk Level:** Medium — misleading guard, potential future regression.

**Fix:** Introduced a `loadingRef` (via `useRef`) that mirrors `loading` state. The timer reads `loadingRef.current` instead of the stale `loading` closure variable:
```typescript
const loadingRef = useRef(true);
// ... every setLoading(false) call also does loadingRef.current = false

const safetyTimer = setTimeout(() => {
  if (mounted && loadingRef.current) {   // always reads current value
    setLoading(false);
  }
}, 8000);
```

Two regression tests added in `useAuth.test.tsx`:
- Safety timer fires correctly when `getSession` never resolves.
- Safety timer is a no-op when loading was already cleared.

---

### Bug #5 — 🟡 Medium: `inventoryService.ts` uses `select("*")`

**File:** `src/modules/inventory/services/inventoryService.ts`  
**Function:** `getProducts`

**Root Cause:**  
`select("*")` was used instead of an explicit column list, violating the codebase convention (all other service files use named column constants — see `PATIENT_COLUMNS`, `PROFESSIONAL_COLUMNS`, etc.).

**Impact:**  
- Fetches all columns including any future columns added to the table.  
- Bypasses the TypeScript type-narrowing that explicit column lists provide.  
- Unnecessary data transfer if the table ever gains large columns (e.g. image blobs).

**Risk Level:** Medium — technical debt / potential future performance issue.

**Fix:** Added a `PRODUCT_COLUMNS` constant and updated `select()` to use it.

---

### Bug #6 — 🟢 Low: `authService.ts getProfile` uses `select("*")`

**File:** `src/modules/auth/services/authService.ts`  
**Function:** `getProfile`

**Root Cause:**  
Same `select("*")` inconsistency as Bug #5 but in the auth service. The `profiles` table is queried on every page load for every authenticated user, so over-fetching is especially wasteful here.

**Risk Level:** Low — performance and consistency issue.

**Fix:** Added a `PROFILE_COLUMNS` constant listing only the needed columns.

---

## Additional Observations (No Code Change Required)

### `Dashboard.tsx` — occupancy rate uses hardcoded multiplier
**Location:** `queryFn` for `dashboard-occupancy`, line with `* 4`  
The slot capacity calculation multiplies by `4` as an approximation of "4 weeks per month". This is inaccurate and will silently misreport occupancy. Recommended fix: count actual available days in the month, or use a dedicated Supabase RPC.

### `Financeiro.tsx` — silent zero-value payments
**Location:** `createPagamento` mutation  
`parseFloat(formData.valor) || 0` — if the user types a non-numeric string, the payment is silently created with `valor = 0`. A Zod schema validation on the form fields would prevent this.

### `useClinic.tsx` — clinic users query lacks error handling
**Location:** `queryFn` for `"user-clinics"`, lines with `as any`  
Neither the `clinic_users` query nor the fallback `clinicas` query checks for an error response. Add `if (error) throw error` guards to propagate failures correctly.

---

## Test Results After Fixes

```
Test Files  34 passed (34)
     Tests  374 passed (374)   (+2 new tests for Bug #4)
  Duration  ~22 s
```

All pre-existing tests continue to pass. Two new tests were added for the safety timer fix.
