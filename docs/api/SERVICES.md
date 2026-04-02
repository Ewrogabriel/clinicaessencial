# Services API Reference

Public service functions available across `src/modules/`.

---

## Patient Services (`src/modules/patients/`)

### `usePatientForm` hook

Located in `src/modules/patients/hooks/usePatientForm.ts`

Used by `PacienteForm.tsx` to manage the staff patient create/edit form.

**Returns:**
- `id`, `isEditing` – current route params
- `basic`, `setBasicField` – personal data state
- `address`, `setAddressField` – address state
- `guardian`, `setGuardian`, `setGuardianField` – guardian state
- `invoice`, `setInvoiceField` – invoice data state
- `clinical`, `setClinicalField` – clinical notes state
- `lgpdConsentimento`, `setLgpdConsentimento`
- `codigoAcesso` – generated patient access code
- `loading`, `loadingData`, `uploadingPhoto`
- `fileInputRef`
- `modalidades`, `convenios` – lookup data
- `handleSubmit`, `handlePhotoUpload`, `fetchAddressFor`
- `copyAddressToGuardian`, `generateInviteLink`
- `maskCPF`, `maskPhone`, `maskCEP`, `maskRG` – input masks

---

## Professional Services (`src/modules/professionals/`)

### `getProfessionalsBasic()`

Returns all clinic professionals ordered by name.

```typescript
import { getProfessionalsBasic } from "@/modules/professionals/services/professionalService";

const professionals = await getProfessionalsBasic();
// Returns: { user_id, nome, cor_agenda }[]
```

**Notes:**
- Returns ALL profiles with no `cor_agenda` filter.
- Used by agenda views to build the professional color map.

---

## Shared Services (`src/modules/shared/`)

### `useToast` / `toast`

```typescript
import { toast } from "@/modules/shared/hooks/use-toast";

toast({ title: "Sucesso", description: "Operação concluída." });
toast({ title: "Erro", variant: "destructive" });
```

### `useI18n`

```typescript
import { useI18n } from "@/modules/shared/hooks/useI18n";

const { t, currentLanguage, changeLanguage } = useI18n();
t("common.save"); // → "Salvar"
```

---

## Auth Services (`src/modules/auth/`)

### `useAuth`

```typescript
import { useAuth } from "@/modules/auth/hooks/useAuth";

const {
  user,           // Supabase User | null
  session,        // Supabase Session | null
  loading,        // boolean
  isAdmin,        // boolean
  isGestor,       // boolean
  isSecretario,   // boolean
  isProfissional, // boolean
  isMaster,       // boolean
  isPatient,      // boolean (derived)
  patientId,      // string | null
  signIn,         // (email, password) => Promise<void>
  signOut,        // () => Promise<void>
} = useAuth();
```

---

## Clinic Services (`src/modules/clinic/`)

### `useClinic`

```typescript
import { useClinic } from "@/modules/clinic/hooks/useClinic";

const {
  activeClinicId,   // string | null
  clinics,          // Clinic[]
  setActiveClinic,  // (id: string) => void
} = useClinic();
```

---

## Utility Functions (`src/lib/`)

### Input masks (`src/lib/masks.ts`)

```typescript
import { maskCPF, maskPhone, maskCEP, maskRG } from "@/lib/masks";

maskCPF("12345678901");   // "123.456.789-01"
maskPhone("11999999999"); // "(11) 99999-9999"
maskCEP("01310100");      // "01310-100"
maskRG("123456789");      // "12.345.678-9"
```

### Date utilities (`src/lib/dateUtils.ts`)

Common date helpers for the Brazilian locale.

```typescript
import { formatDateBR, parseLocalDate } from "@/lib/dateUtils";

formatDateBR("2024-06-15");   // "15/06/2024"
parseLocalDate("2024-06-15"); // Date object in local time (avoids UTC shift)
```

### `cn` utility (`src/lib/utils.ts`)

```typescript
import { cn } from "@/lib/utils";

cn("rounded-md p-4", isActive && "bg-primary/10");
```
