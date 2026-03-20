# Fisio Flow Care — Security Analysis

> Authentication, authorisation, data protection, role-based permissions, Supabase RLS policies,
> and security vulnerability catalogue.
> Generated from static analysis of migrations, service code, and auth hooks.

---

## 1. Authentication

### Provider
**Supabase Auth** — JWT-based authentication backed by PostgreSQL `auth.users`.

### Session Management
- JWT access tokens stored in `localStorage` by Supabase client
- Automatic token refresh via Supabase SDK before expiry
- `onAuthStateChange` listener updates `AuthContext` on every session event:
  `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY`

### Sign-In Flow
```
1. User submits email + password
2. authService.signIn() → supabase.auth.signInWithPassword()
3. Supabase validates credentials against auth.users
4. JWT issued (access_token + refresh_token)
5. AuthProvider.loadUserData() fetches profile, roles, permissions
6. All subsequent API calls include JWT in Authorization header
```

### Sign-Out Flow
```
1. authService.signOut() → supabase.auth.signOut()
2. JWT revoked server-side
3. AuthContext cleared (user = null, profile = null, roles = [])
4. ClinicContext cleared
5. User redirected to /login
```

### Password Reset
```
1. authService.resetPassword(email)
2. → supabase.auth.resetPasswordForEmail(email)
3. User receives email with reset link
4. Link leads to /reset-password page
5. New password submitted → supabase.auth.updateUser({ password })
```

### Session Load Timeout
`loadUserData()` has a **5-second timeout** via `Promise.race()`. If Supabase is unreachable,
the app fails gracefully with `setLoading(false)` rather than hanging indefinitely.

---

## 2. Authorisation

### Role-Based Access Control (RBAC)

The application uses **6 roles** stored in `user_roles` and `profiles.role`:

| Role | Level | Primary Capabilities |
|---|---|---|
| `master` | Super-admin | Manages all clinic tenants via `/master`. Bypasses per-clinic restrictions. |
| `admin` | Clinic admin | Full CRUD on all clinic data. Manages users, settings, finance. |
| `gestor` | Manager | Same as admin but scoped to one clinic. No master panel access. |
| `profissional` | Staff | Own schedule, own evolutions, own commissions. Read-only elsewhere. |
| `secretario` | Reception | Patient intake, scheduling, limited financial view. No reports. |
| `paciente` | Patient | Own records, own appointments, own payments via patient portal. |

### Client-Side Guards

**ProtectedRoute component:**
```tsx
if (!session) → redirect to /login
if (!activeClinicId) → redirect to /selecionar-clinica
// else render children
```

**DashboardToggle component:**
```tsx
if (isMaster && !isAdmin) → <MasterPanel />
if (isAdmin || isGestor || isSecretario) → <Dashboard />
if (isProfissional) → <ProfessionalDashboard />
else → <PatientDashboard />
```

**usePermission hook:**
```typescript
hasPermission(resource: string): boolean
  // checks user_permissions table for resource access
canEdit(resource: string): boolean
  // checks for 'edit' access level
```

**⚠️ Security Note:** Client-side role checks are UX guards only.
All real security is enforced server-side via RLS (see section 3).

### Fine-Grained Permissions

Beyond roles, `user_permissions` table allows per-resource access overrides:
```
resource: 'financeiro' | 'relatorios' | 'comissoes' | 'prontuarios' | ...
access_level: 'view' | 'edit'
```
This allows, for example, giving a `secretario` view access to `financeiro`
without granting full `admin` role.

---

## 3. Supabase Row-Level Security (RLS)

### Policy Architecture

Every table in `public` schema has RLS enabled. Policies use a hierarchy of
`SECURITY DEFINER` helper functions to avoid N+1 permission lookups.

### Core Helper Functions

```sql
-- Check if a user has a specific role
CREATE FUNCTION has_role(user_id uuid, role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = $1 AND role = $2
  );
$$;

-- Resolve clinic group from a clinic
CREATE FUNCTION get_clinic_group_id(_clinic_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT clinic_group_id FROM public.clinicas WHERE id = _clinic_id LIMIT 1;
$$;

-- Check if current user belongs to a clinic group
CREATE FUNCTION user_in_clinic_group(_clinic_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_users cu
    JOIN public.clinicas c ON c.id = cu.clinic_id
    WHERE cu.user_id = auth.uid()
      AND c.clinic_group_id = _clinic_group_id
  );
$$;

-- Check subscription plan limits
CREATE FUNCTION check_plan_limit(_clinic_id uuid, _resource text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- Compare current count against planos_clinica.limite_*
$$;
```

### Sample RLS Policies (appointments table)

```sql
-- Admins can do everything
CREATE POLICY "agendamentos_admin_select" ON public.agendamentos
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agendamentos_admin_insert" ON public.agendamentos
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Professionals can see their own appointments
CREATE POLICY "agendamentos_profissional_select" ON public.agendamentos
  FOR SELECT USING (
    profissional_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'secretario'::app_role)
  );

-- Patients can see their own appointments
CREATE POLICY "agendamentos_paciente_select" ON public.agendamentos
  FOR SELECT USING (
    paciente_id IN (
      SELECT id FROM public.pacientes WHERE user_id = auth.uid()
    )
  );

-- Cross-clinic group access (for cross-booking)
CREATE POLICY "agendamentos_clinic_group_select" ON public.agendamentos
  FOR SELECT USING (
    clinic_group_id IS NOT NULL AND
    user_in_clinic_group(clinic_group_id)
  );
```

### Tenant Isolation

Every sensitive table has a `clinic_id` column. RLS policies verify:
1. User is a member of that clinic (via `clinic_users`)
2. OR user has `admin` / `master` role
3. OR (for cross-booking) user belongs to the same `clinic_group`

**This means: even if the frontend has a bug that sends the wrong `clinic_id`,
the database will reject the operation if the user is not a member of that clinic.**

---

## 4. Data Protection

### In Transit
- All communication over HTTPS (Supabase enforces TLS)
- JWT transmitted in `Authorization: Bearer <token>` header
- Supabase Storage URLs are signed (time-limited) for private files

### At Rest
- PostgreSQL database managed by Supabase (encrypted at rest by cloud provider)
- Patient attachments stored in Supabase Storage (private bucket, signed URLs)
- No sensitive data stored in `localStorage` beyond the Supabase auth session token

### Sensitive Data Fields
| Field | Table | Protection |
|---|---|---|
| `cpf` | `pacientes` | RLS (only clinic members can read) |
| `data_nascimento` | `pacientes` | RLS |
| `diagnostico` | `pacientes` | RLS |
| `subjetivo/objetivo/avaliacao/plano` | `evolutions` | RLS (profissional or admin only) |
| `valor` | `pagamentos` | RLS (admin/gestor only for reports) |
| `chave_pix` | `config_pix` | RLS (admin only) |
| `commission_rate` | `profiles` | RLS |

### PIX Key Protection
`config_pix.chave_pix` stores the clinic's PIX key. RLS policy:
```sql
CREATE POLICY "config_pix_admin_only" ON public.config_pix
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
```

---

## 5. Input Validation

### Client-Side (Zod schemas)
All forms validate with Zod before calling services:
- `src/modules/auth/utils/schemas.ts` — login / registration
- `src/modules/patients/utils/schemas.ts` — patient form fields
- `src/modules/professionals/utils/schemas.ts` — professional profiles
- `src/modules/finance/utils/schemas.ts` — payment forms

### Server-Side
- PostgreSQL `CHECK` constraints and `NOT NULL` on critical columns
- Unique constraints prevent duplicate CPF per clinic, duplicate bookings
- RLS `WITH CHECK` clauses on INSERT/UPDATE policies validate ownership

---

## 6. Audit Trail

All sensitive admin operations write to `audit_logs`:
```typescript
auditService.log(action, { resource_type, resource_id, metadata })
// → INSERT INTO audit_logs (user_id, clinic_id, action, resource_type, resource_id, metadata)
```

Audited actions include:
- `patient.create`, `patient.update`, `patient.delete`
- `appointment.create`, `appointment.cancel`
- `finance.payment_create`, `finance.commission_create`
- `user.role_change`, `clinic.settings_update`

RLS on `audit_logs`: **insert only for authenticated users, read only for admins**.

---

## 7. Vulnerability Catalogue

### 7.1 Known Architectural Issues

| ID | Issue | Severity | Status |
|---|---|---|---|
| SEC-01 | ~110 page/component files import `supabase` client directly, bypassing the service layer | Medium | 🔴 Open (refactor in progress) |
| SEC-02 | Client-side role guards (`isAdmin`, `hasPermission`) can be bypassed via browser dev tools | Low | ✅ Mitigated by server-side RLS |
| SEC-03 | JWT stored in `localStorage` (XSS risk if 3rd-party script injected) | Medium | ⚠️ Accepted (Supabase default) |
| SEC-04 | No CSRF protection for state-mutating requests | Low | ✅ Mitigated by JWT-in-header pattern (CSRF requires cookie auth) |

### 7.2 SEC-01 Detail: Direct Supabase Imports
The architecture mandates only service files import from `integrations/supabase/client`.
However, 110+ files currently bypass this:
```typescript
// ❌ Violation pattern found in pages/Agenda.tsx and many others:
import { supabase } from "@/integrations/supabase/client";
const { data } = await supabase.from("pacientes").select("*");  // also uses select("*")
```

**Risk:** If a component constructs a query incorrectly, there is no service-layer
error handling wrapper (no `handleError()`, no toast, raw error propagates).

**Recommendation:** Complete the refactoring. Create `patientService.getPatientById()` etc.
for all missing service methods.

### 7.3 SEC-03 Detail: JWT in localStorage
```
Risk:   XSS payload can read localStorage → steal JWT → impersonate user
Mitigation: Content-Security-Policy header on hosting platform
            No eval() / innerHTML patterns in app code
            Supabase short-lived tokens (1 hour) + auto-refresh
Recommendation: Consider `httpOnly` cookie session if XSS risk profile is high
```

### 7.4 Positive Security Controls

| Control | Implementation |
|---|---|
| **Zero anonymous access** | All `public.*` tables require authenticated JWT |
| **Tenant isolation** | `clinic_id` filter in every data query + RLS enforces it |
| **Double-booking prevention** | Service-level check before every INSERT to agendamentos |
| **Plan quota enforcement** | `check_plan_limit()` DB function called before resource creation |
| **SECURITY DEFINER functions** | Helper functions run with elevated privileges but accept only `auth.uid()` — cannot be spoofed |
| **Zod validation** | All form data validated before service calls |
| **Error messages** | No database internals exposed to user; only `AppError.message` and Supabase `code` |
| **Audit logs** | Immutable log of all admin operations |
| **5-second auth timeout** | Prevents indefinite loading if Supabase Auth is unreachable |

---

## 8. Security Recommendations

1. **Complete service layer migration (SEC-01)** — highest priority. Run the refactoring script
   in `docs/dependency-map.md` to enumerate all violations and migrate them.

2. **Add Content-Security-Policy headers** — configure `frame-ancestors`, `script-src`,
   `connect-src` to mitigate XSS / injection risks. Do this at the CDN/hosting layer.

3. **Enable Supabase Auth leaked password protection** — in Supabase dashboard, enable
   HaveIBeenPwned integration to block known compromised passwords.

4. **Rate limiting on login** — Supabase provides built-in rate limiting but ensure it is
   configured. Also consider adding a CAPTCHA for the public `/pre-cadastro` and `/login` routes.

5. **Rotate PIX keys** — `config_pix.chave_pix` is stored in plain text. Ensure DB backups
   are encrypted and access is tightly controlled.

6. **Review `secretario` role scope** — currently secretários can create appointments and
   view patient demographics. Verify this matches the intended access level; consider adding
   per-resource permission entries for sensitive patient data.

7. **Supabase Storage bucket policies** — ensure all patient attachment buckets are private
   (not public). Signed URLs should have short expiry (< 1 hour).

8. **Implement session revocation on role change** — if an admin changes a user's role,
   the user's existing JWT still carries old claims until it expires. Consider forcing sign-out
   on role change by calling `supabase.auth.admin.signOut(userId)`.
