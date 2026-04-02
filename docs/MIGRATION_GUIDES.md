# Migration Guides

Step-by-step instructions for moving from deprecated patterns to the current architecture.

---

## 1. Direct Supabase Import → Service Layer {#direct-supabase-imports}

### Problem

Pages and components that import `supabase` directly bypass the service/hook abstraction and make testing harder.

```typescript
// ❌ Old pattern
import { supabase } from "@/integrations/supabase/client";

const { data } = await supabase.from("pacientes").select("*").eq("clinic_id", clinicId);
```

### Solution

Use the appropriate service function or hook from `src/modules/`.

```typescript
// ✅ New pattern
import { usePatients } from "@/modules/patients/hooks/usePatients";

const { data: patients } = usePatients(clinicId);
```

Or for imperative calls:

```typescript
import { patientService } from "@/modules/patients/services/patientService";

const patients = await patientService.listPatients(clinicId);
```

### Automated migration

```bash
node scripts/codemods/migrate-imports.js --dry-run src/pages
node scripts/codemods/migrate-imports.js src/pages          # apply
```

---

## 2. Custom Dashboard Layout → AppLayout / DashboardBase {#dashboard-migration}

### Problem

Some older pages render their own `<div className="flex min-h-screen">` shell instead of using the shared `AppLayout` (which provides the sidebar, header and outlet).

### Solution

Remove the custom shell and rely on the `<AppLayout>` route wrapper already declared in `App.tsx`.

```tsx
// ❌ Old pattern
export function MyPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main>...</main>
    </div>
  );
}

// ✅ New pattern
// App.tsx already wraps protected routes in <AppLayout />.
// Just export your page content directly.
export function MyPage() {
  return (
    <div className="space-y-6">
      ...
    </div>
  );
}
```

### Automated migration

```bash
node scripts/codemods/migrate-dashboard.js --dry-run src/pages
node scripts/codemods/migrate-dashboard.js src/pages          # apply
```

---

## 3. Duplicated Patient Forms → PatientFormBuilder {#form-migration}

### Problem

Three pages implement patient data collection independently:

| File | Flow |
|------|------|
| `src/pages/PacienteForm.tsx` | Staff create/edit |
| `src/pages/PatientOnboarding.tsx` | Post-signup wizard |
| `src/pages/PreCadastro.tsx` | Anonymous self-registration |

This leads to ~600 lines of duplicated validation, masking and UI logic.

### Solution

Use `PatientFormBuilder` from `src/pages/patients/PatientFormBuilder.tsx`.

```tsx
import { PatientFormBuilder, PatientFormData } from "@/pages/patients/PatientFormBuilder";

// Staff create/edit
<PatientFormBuilder
  mode="staff"
  initialData={existingPatientData}
  onSubmit={handleSave}
  onCancel={() => navigate("/pacientes")}
  loading={isSaving}
/>

// Post-signup onboarding
<PatientFormBuilder
  mode="onboarding"
  initialData={{ nome: patient.nome, cpf: patient.cpf }}
  onSubmit={handleOnboarding}
  loading={isSaving}
/>

// Anonymous pre-registration
<PatientFormBuilder
  mode="pre-cadastro"
  onSubmit={handlePreCadastro}
  loading={isSaving}
/>
```

### Step-by-step

1. Import `PatientFormBuilder` and `PatientFormData` from `@/pages/patients/PatientFormBuilder`.
2. Map the old state variables to a `PatientFormData` object and pass as `initialData`.
3. Move the save logic into the `onSubmit` callback.
4. Remove the individual field state variables, mask functions and validation logic (they are built into the builder).
5. Delete the old form JSX.

### Automated migration (scan only)

```bash
node scripts/codemods/migrate-forms.js --dry-run src/pages
```

---

## 4. Legacy Redirect Routes

The following URL aliases are kept for a **6-week transition window** and will be removed in a subsequent version:

| Old URL | New URL |
|---------|---------|
| `/conciliacao-bancaria` | `/financeiro/conciliacao` |
| `/agenda-premium` | `/agenda?tab=vagas` |

Update any bookmarks, deep links, or email templates to use the new URLs before the deadline.

---

## 5. `HistoricoSessoes` → `HistoricoSessoes` (no change)

This route is stable. No migration needed.
