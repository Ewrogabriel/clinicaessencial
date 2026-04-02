# Code Style Guide

Standards and conventions used throughout Clínica Essencial.

## TypeScript

- **Strict mode** is enabled. Do not use `any` unless absolutely unavoidable; prefer `unknown` + narrowing.
- Prefer `interface` for object shapes that can be extended; use `type` for unions, intersections and aliases.
- Always type function parameters and return values explicitly on public APIs.
- Use `as const` for static lookup objects instead of enums.

```typescript
// ✅ Good
interface Patient {
  id: string;
  nome: string;
  cpf: string | null;
}

function getPatient(id: string): Promise<Patient> { ... }

// ❌ Avoid
function getPatient(id: any) { ... }
```

## React Components

- One component per file. File name matches the exported component name (PascalCase).
- Prefer **named exports** so refactoring tools work reliably.
- Use `React.FC` only when you need `children` typing via `React.PropsWithChildren`; otherwise just type props inline.
- Keep components under ~250 lines. Extract sub-components or hooks if they grow larger.

```tsx
// ✅ Good
export function PatientCard({ patient }: { patient: Patient }) {
  return <div>{patient.nome}</div>;
}
```

## File Naming

| Kind | Convention | Example |
|------|-----------|---------|
| React component | PascalCase `.tsx` | `PatientCard.tsx` |
| Hook | camelCase prefixed `use` | `usePatientForm.ts` |
| Service | camelCase suffixed `Service` | `patientService.ts` |
| Utility | camelCase | `masks.ts` |
| Test | Same name + `.test.ts(x)` | `masks.test.ts` |
| Story | Same name + `.stories.tsx` | `PatientCard.stories.tsx` |

## Imports

Order imports as follows (enforced by ESLint):

1. React / React DOM
2. Third-party libraries
3. Internal aliases (`@/...`)
4. Relative imports (`./...`)

```typescript
import { useState } from "react";               // 1
import { useQuery } from "@tanstack/react-query"; // 2
import { Button } from "@/components/ui/button"; // 3
import { formatDate } from "./utils";             // 4
```

**Do not import `supabase` directly inside page or component files.** Call a service function or hook instead. See [MIGRATION_GUIDES.md](./MIGRATION_GUIDES.md).

## Hooks

- Data-fetching hooks must use TanStack Query (`useQuery` / `useMutation`).
- Always provide a `queryKey` that includes the clinic ID so data is scoped per clinic.
- Clean up subscriptions in the `useEffect` return function.

```typescript
// ✅ Good
const { data: patients } = useQuery({
  queryKey: ["patients", clinicId],
  queryFn: () => patientService.listPatients(clinicId),
  enabled: !!clinicId,
});
```

## State Management

- **Server state:** TanStack Query only.
- **Global UI state:** React Context (AuthProvider, ClinicProvider).
- **Local UI state:** `useState` / `useReducer` inside the component.
- **Form state:** `react-hook-form`.
- Do **not** introduce Redux, Zustand, or MobX without team agreement.

## Styling

- Use **Tailwind CSS** utility classes.
- For conditional classes use the `cn()` helper from `@/lib/utils`.
- Do not write raw CSS unless absolutely necessary (custom animations, third-party overrides).
- Follow the design token scale for spacing, colors, and typography.

```tsx
// ✅ Good
<div className={cn("rounded-md p-4", isActive && "bg-primary/10")}>
```

## Error Handling

- Wrap async operations in try/catch.
- Display user-facing errors using `toast()` from `sonner` or the `useToast` hook.
- Log technical errors to the console during development.

```typescript
try {
  await patientService.create(data);
  toast.success("Paciente criado com sucesso");
} catch (err) {
  console.error(err);
  toast.error("Erro ao criar paciente");
}
```

## Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for full conventions.

- Name test files `*.test.ts(x)`.
- Group related tests with `describe`.
- Use descriptive `it("should ...")` labels.
- Mock Supabase at the module level (see `src/test/integration/` for examples).

## Commits

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Keep commits atomic and focused.
