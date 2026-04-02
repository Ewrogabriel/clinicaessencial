# Security Audit

> **Scope:** OWASP Top-10 compliance review for Clínica Essencial (April 2026)

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Authentication | ✅ | Supabase Auth; JWT-based sessions |
| Authorization (RLS) | ✅ | Row-Level Security on all tables |
| XSS | ✅ | React escapes by default; no dangerouslySetInnerHTML |
| CSRF | ✅ | SPA + JWT bearer token; no cookie-based auth |
| Injection | ✅ | Parameterised queries via Supabase JS client |
| Sensitive data exposure | ⚠️ | Anon key in env var (expected); service key never in client |
| Security misconfiguration | ⚠️ | Two RLS policies use `USING(true)` – see below |
| Broken access control | ⚠️ | `agendamentos` anon SELECT policy – see below |
| Stale query cache | ⚠️ | Cache not cleared on sign-out – see below |

---

## Findings

### 1. Permissive RLS on `bank_accounts` and `bank_transactions` ⚠️

**File:** `supabase/migrations/20260328003231_*.sql` lines 19–51

**Issue:** Policies use `USING(true) WITH CHECK(true)`, allowing any authenticated user to read/write all bank data.

**Recommendation:** Scope policies to the clinic the user belongs to:

```sql
-- Example fix
CREATE POLICY "Users manage own clinic bank accounts"
  ON bank_accounts
  USING (clinic_id IN (
    SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid()
  ));
```

---

### 2. Anonymous SELECT on `agendamentos` ⚠️

**File:** `supabase/migrations/20260401060000_confirmar_agendamento_anon_access.sql` lines 9–15

**Issue:** Policy grants anon role `SELECT` with `USING(true)`, enabling enumeration of all appointments without authentication.

**Recommendation:** Restrict to a specific column match (e.g., require a secret confirmation token column):

```sql
-- Example fix
CREATE POLICY "Anon can confirm own appointment by token"
  ON agendamentos FOR SELECT
  TO anon
  USING (confirmation_token IS NOT NULL);
```

---

### 3. Query cache not cleared on sign-out ⚠️

**File:** `src/modules/auth/hooks/useAuth.tsx` (signOut handler)

**Issue:** TanStack Query cache persists after sign-out. A subsequent user on the same device could see stale data from the previous session.

**Recommendation:** Call `queryClient.clear()` during sign-out:

```typescript
import { queryClient } from "@/lib/queryClient";

async function signOut() {
  await supabase.auth.signOut();
  queryClient.clear();          // ← add this
  // reset auth state...
}
```

---

### 4. `pre_cadastros` INSERT with `WITH CHECK(true)` (low risk) ⚠️

**File:** `supabase/migrations/20260308174857_*.sql` lines 36–44

**Issue:** Anon users can insert arbitrary data into `pre_cadastros`. There is no rate limiting at the DB level.

**Recommendation:** Add application-level or Supabase Edge Function rate limiting on this endpoint.

---

## Confirmed Safe

- **XSS:** React escapes all interpolated values. No `dangerouslySetInnerHTML` usage found in production code.
- **CSRF:** The app uses JWT Bearer authentication (not cookies), so CSRF tokens are not required.
- **SQL Injection:** The Supabase JS client uses parameterised queries. No raw SQL is constructed from user input.
- **Secrets:** `VITE_SUPABASE_ANON_KEY` is intentionally public (anon key, not service key). The service role key is never referenced in client code.
- **Dependency vulnerabilities:** 6 low/moderate npm vulnerabilities exist in dev dependencies (not shipped to production). Run `npm audit` for details.

---

## Recommendations for Future Sprints

1. Tighten `bank_accounts`/`bank_transactions` RLS policies.
2. Replace broad anon SELECT on `agendamentos` with token-scoped policy.
3. Clear TanStack Query cache on sign-out.
4. Add Supabase Edge Function rate limiting on `pre_cadastros` INSERT.
5. Consider adding a CSP header in the Vercel configuration.
