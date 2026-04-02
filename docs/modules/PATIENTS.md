# Patients Module

Patient management from pre-registration to active care.

---

## Flows

### 1. Staff Create (PacienteForm)

`/pacientes/novo` or `/pacientes/:id`

Staff (admin/gestor/secretario) fill in all patient fields. Uses `usePatientForm` hook from `src/modules/patients/hooks/usePatientForm.ts`.

### 2. Anonymous Pre-Registration (PreCadastro)

`/pre-cadastro`

Prospective patients fill in a public form. Creates a row in `pre_cadastros`. No authentication required. Staff review and approve via `/pre-cadastros`.

### 3. Post-Signup Onboarding (PatientOnboarding)

`/onboarding/:id`

Invited patients click a link, confirm CPF and set a password. Updates the `pacientes` row and creates a Supabase Auth user.

### 4. Unified Form (PatientFormBuilder)

`src/pages/patients/PatientFormBuilder.tsx`

All three flows now share a single form component. Pass the `mode` prop to control which steps and fields are shown:
- `mode="staff"` – all 4 steps (personal, address, guardian, notes)
- `mode="onboarding"` – personal only + password fields
- `mode="pre-cadastro"` – personal, address, guardian (3 steps)

See [MIGRATION_GUIDES.md](../MIGRATION_GUIDES.md#form-migration) to migrate existing forms.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `pacientes` | Core patient record |
| `clinic_pacientes` | Many-to-many: links patients to clinics |
| `pre_cadastros` | Pending anonymous registrations |
| `solicitacoes_alteracao` | Patient-requested data changes awaiting staff approval |

---

## Key Relationships

- A patient (`pacientes`) may belong to multiple clinics via `clinic_pacientes`.
- `pacientes` has no `clinic_id` column; clinic scope is always resolved through `clinic_pacientes`.
- After onboarding, `pacientes.user_id` is set to the Supabase Auth UID.

---

## Permissions

| Action | Roles |
|--------|-------|
| Create/edit patient | admin, gestor, secretario |
| View patient list | admin, gestor, secretario, profissional |
| View patient details | admin, gestor, secretario, profissional |
| Approve pre-registration | admin, gestor, secretario, master |
| Submit data-change request | paciente |
| Approve data-change request | admin, gestor, secretario, master |
