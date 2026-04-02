# Auth Module

Deep dive into the authentication and authorization system.

---

## Overview

Authentication is handled by **Supabase Auth** (email + password). After login a JWT session is stored in `localStorage` by the Supabase client. The `AuthProvider` in `src/modules/auth/hooks/useAuth.tsx` subscribes to auth state changes and exposes the current user and derived role flags to all descendant components.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/modules/auth/hooks/useAuth.tsx` | Auth context + hook |
| `src/modules/auth/components/ProtectedRoute.tsx` | Redirects unauthenticated users |
| `src/modules/auth/components/RequireRole.tsx` | Role-gated route wrapper |
| `src/modules/auth/utils/schemas.ts` | Zod schemas for login forms |
| `src/pages/Login.tsx` | Login page |
| `src/pages/ResetPassword.tsx` | Password reset page |
| `src/pages/PatientOnboarding.tsx` | Patient account activation |
| `src/pages/auth/RoutesConfig.ts` | Full route catalogue with roles |

---

## Roles

Roles are stored in the `user_roles` table in Postgres. A user may have one or more roles.

| Role | Description |
|------|-------------|
| `master` | Platform super-admin; can manage all clinics |
| `admin` | Clinic owner; full access |
| `gestor` | Clinic manager; most admin features |
| `secretario` | Front-desk staff; limited write access |
| `profissional` | Healthcare professional; sees own schedule + patients |
| `paciente` | Patient; sees own data only |

---

## Auth Flow

```
1. User opens /login
2. Enters email + password
3. Supabase Auth returns JWT session
4. AuthProvider sets user + role flags
5. If user belongs to multiple clinics → redirected to /selecionar-clinica
6. Otherwise → redirected to /dashboard
7. DashboardToggle renders the appropriate dashboard for the role
```

---

## Route Protection

```tsx
// Requires any authenticated user
<ProtectedRoute>
  <MyPage />
</ProtectedRoute>

// Requires specific role(s)
<RequireRole roles={["admin", "gestor", "master"]}>
  <AdminPage />
</RequireRole>
```

Routes that fail the role check render a "403 Forbidden" message.

---

## Security Notes

- The JWT is automatically refreshed by the Supabase client.
- On sign-out, call `queryClient.clear()` to prevent stale data being visible to the next user. See [SECURITY_AUDIT.md](../SECURITY_AUDIT.md).
- The `anon` Supabase key is intentionally public; it only allows operations permitted by RLS policies.
- The service role key is **never** exposed to the browser.
