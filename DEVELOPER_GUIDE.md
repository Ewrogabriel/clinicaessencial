# Fisio Flow Care — Developer Guide

> Step-by-step guide for installing, running, extending, and contributing to Fisio Flow Care.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Environment Configuration](#3-environment-configuration)
4. [Supabase Setup](#4-supabase-setup)
5. [Running Locally](#5-running-locally)
6. [Project Conventions](#6-project-conventions)
7. [Adding a New Module](#7-adding-a-new-module)
8. [Adding New Components](#8-adding-new-components)
9. [Adding New Database Tables](#9-adding-new-database-tables)
10. [Internationalisation (i18n)](#10-internationalisation-i18n)
11. [Testing](#11-testing)
12. [Code Quality](#12-code-quality)
13. [Deployment](#13-deployment)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 18.x | See `.nvmrc` |
| npm | 9.x | Comes with Node 18 |
| Git | Any | |
| Supabase account | — | Free tier is sufficient for development |

Use [`nvm`](https://github.com/nvm-sh/nvm) to manage Node versions:

```bash
nvm install   # reads .nvmrc
nvm use
```

---

## 2. Installation

```bash
# Clone the repository
git clone https://github.com/Ewrogabriel/app-essencial.git
cd app-essencial

# Install dependencies
npm install
```

---

## 3. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env
```

Open `.env` and fill in your Supabase project credentials:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are available in your Supabase project dashboard under
**Project Settings → API**.

> The anon key is safe to expose in the browser. Row Level Security policies
> are the authoritative data access boundary.

---

## 4. Supabase Setup

### 4.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy the project URL and anon key into `.env`.

### 4.2 Run migrations

All 104 migration files live in `supabase/migrations/`. Apply them in order
using the Supabase CLI or by pasting into the SQL editor:

```bash
# With Supabase CLI (recommended)
npx supabase db push

# Or run the helper script
bash run_migrations.sh
```

### 4.3 Seed data (optional)

Initial payment method data:

```bash
psql $DATABASE_URL -f SETUP_FORMAS_PAGAMENTO.sql
psql $DATABASE_URL -f SETUP_POLITICAS_CANCELAMENTO.sql
psql $DATABASE_URL -f SETUP_PRODUTOS_RESERVAS.sql
```

### 4.4 Regenerate Supabase types

After schema changes, regenerate the TypeScript types:

```bash
npx supabase gen types typescript --project-id <project-ref> \
  > src/integrations/supabase/types.ts
```

---

## 5. Running Locally

```bash
# Development server at http://localhost:8080
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

The dev server runs on port **8080** (configured in `vite.config.ts`).
Hot Module Replacement (HMR) overlay is disabled by default.

---

## 6. Project Conventions

### 6.1 Layered architecture

Always respect the layer boundaries:

```
Page (src/pages/)
  → Domain hook (src/modules/<domain>/hooks/)
    → Domain service (src/modules/<domain>/services/)
      → Supabase client (src/integrations/supabase/client.ts)
```

**Never** import `@/integrations/supabase/client` in pages, hooks, or components.

### 6.2 Service layer rules

- Use **named column-list constants** instead of `select("*")`:
  ```ts
  // ✅ Correct
  const PATIENT_COLUMNS = "id, nome, email, telefone, status, clinic_id";
  const { data } = await supabase.from("pacientes").select(PATIENT_COLUMNS);

  // ❌ Wrong
  const { data } = await supabase.from("pacientes").select("*");
  ```

- Add **explicit TypeScript return types** to every method:
  ```ts
  async getPatients(clinicId: string): Promise<Paciente[]> { ... }
  ```

### 6.3 React Query keys

Always use the centralised `queryKeys` factory from
`src/modules/shared/constants/queryKeys.ts`:

```ts
// ✅ Correct
import { queryKeys } from "@/modules/shared/constants/queryKeys";
useQuery({ queryKey: queryKeys.patients.list(activeClinicId) })

// ❌ Wrong
useQuery({ queryKey: ["pacientes", activeClinicId] })
```

### 6.4 Error handling

Use the centralised `handleError()` in every service catch block:

```ts
import { handleError } from "@/modules/shared/utils/errorHandler";

try {
  const { data, error } = await supabase.from(...).select(...);
  if (error) throw error;
  return data;
} catch (error) {
  handleError(error, "Mensagem amigável para o usuário");
  return [];
}
```

### 6.5 TypeScript

- All service methods must have explicit return types.
- Use types from `src/types/entities.ts` for core entities (not inline types).
- Use `Database["public"]["Tables"]["<table>"]["Insert"]` for insert operations.
- Use `isErrorWithCode()` type guard (not `as` cast) for error code extraction.

### 6.6 Naming conventions

| Artifact | Convention | Example |
|---|---|---|
| React component files | PascalCase | `PatientCard.tsx` |
| Hook files | camelCase with `use` prefix | `usePacientes.ts` |
| Service files | camelCase with `Service` suffix | `patientService.ts` |
| Page files | PascalCase | `Pacientes.tsx` |
| CSS classes | Tailwind utilities only | — |
| Constants | UPPER_SNAKE_CASE | `PATIENT_COLUMNS` |
| Test files | same name + `.test.ts` | `patientService.test.ts` |

---

## 7. Adding a New Module

Follow this checklist when creating a new domain module.

### Step 1 — Create folder structure

```bash
mkdir -p src/modules/<domain>/{services,hooks,components,utils}
touch src/modules/<domain>/services/<domain>Service.ts
touch src/modules/<domain>/hooks/use<Domain>.ts
touch src/modules/<domain>/utils/schemas.ts
```

### Step 2 — Create the service

```ts
// src/modules/<domain>/services/<domain>Service.ts
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { YourEntity } from "@/types/entities";

const YOUR_COLUMNS = "id, nome, clinic_id, created_at";

export const yourService = {
  async getItems(clinicId: string): Promise<YourEntity[]> {
    try {
      const { data, error } = await supabase
        .from("your_table")
        .select(YOUR_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as YourEntity[];
    } catch (error) {
      handleError(error, "Erro ao buscar items.");
      return [];
    }
  },

  async createItem(payload: Omit<YourEntity, "id" | "created_at">): Promise<YourEntity | null> {
    try {
      const { data, error } = await supabase
        .from("your_table")
        .insert(payload)
        .select(YOUR_COLUMNS)
        .single();
      if (error) throw error;
      return data as YourEntity;
    } catch (error) {
      handleError(error, "Erro ao criar item.");
      return null;
    }
  },
};
```

### Step 3 — Add query keys

Open `src/modules/shared/constants/queryKeys.ts` and add your keys:

```ts
yourDomain: {
  all: ["your_table"] as const,
  list: (clinicId: string | null) => ["your_table", clinicId] as const,
  detail: (id: string) => ["your_table", "detail", id] as const,
},
```

### Step 4 — Create the hook

```ts
// src/modules/<domain>/hooks/use<Domain>.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/modules/shared/constants/queryKeys";
import { yourService } from "../services/<domain>Service";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

export function useYourDomain() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.yourDomain.list(activeClinicId),
    queryFn: () => yourService.getItems(activeClinicId!),
    enabled: !!activeClinicId,
  });

  const createMutation = useMutation({
    mutationFn: yourService.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.yourDomain.all });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
```

### Step 5 — Add TypeScript types

If the entity is used across modules, add the interface to
`src/types/entities.ts`:

```ts
export interface YourEntity {
  id: string;
  nome: string;
  clinic_id: string;
  created_at: string;
}
```

### Step 6 — Create the page

```bash
touch src/pages/YourPage.tsx
```

Register the route in `src/App.tsx`:

```tsx
const YourPage = lazy(() => import("./pages/YourPage"));
// ...
<Route path="/your-path" element={<YourPage />} />
```

Add to the sidebar in `src/components/layout/AppSidebar.tsx` if needed.

### Step 7 — Add tests

```bash
mkdir -p src/modules/<domain>/services/__tests__
touch src/modules/<domain>/services/__tests__/<domain>Service.test.ts
```

See [Testing](#11-testing) for guidance on writing tests.

---

## 8. Adding New Components

### Shared UI primitives

Shared UI primitives live in `src/components/ui/` (shadcn/ui components).
To add a new shadcn component:

```bash
npx shadcn-ui@latest add <component-name>
```

This auto-generates the component in `src/components/ui/`.

### Feature components

Domain-specific components live in `src/components/<feature>/` or
`src/modules/<domain>/components/`.

Guidelines:
- Components should **not** call services directly — call hooks instead.
- Use `useI18n()` for any user-facing strings.
- Export as named exports (not default) in component files that contain multiple components.
- Use Tailwind CSS for all styling; avoid inline styles.

### Layout components

Changes to the main navigation should be made in:
- `src/components/layout/AppSidebar.tsx` — sidebar navigation groups
- `src/components/layout/AppLayout.tsx` — outer layout shell

The sidebar has **6 prescribed navigation groups** (admin view):
1. Pacientes
2. Agendamentos
3. Profissionais
4. Financeiro
5. Clínica
6. Configurações

---

## 9. Adding New Database Tables

### Step 1 — Create a migration file

Migration files are named with a timestamp prefix:

```bash
# Pattern: YYYYMMDDHHMMSS_<description>.sql
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_add_your_table.sql
```

### Step 2 — Write the migration SQL

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_your_table.sql

CREATE TABLE IF NOT EXISTS your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for clinic-based queries (almost always needed)
CREATE INDEX IF NOT EXISTS idx_your_table_clinic_id ON your_table(clinic_id);

-- Enable Row Level Security (always required)
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read within their clinic
CREATE POLICY "clinic members can read"
  ON your_table FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users WHERE user_id = auth.uid()
    )
  );

-- RLS: Admins and managers can insert
CREATE POLICY "admins can insert"
  ON your_table FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

-- RLS: Admins and managers can update
CREATE POLICY "admins can update"
  ON your_table FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );
```

### Step 3 — Apply the migration

```bash
npx supabase db push
```

### Step 4 — Regenerate TypeScript types

```bash
npx supabase gen types typescript --project-id <project-ref> \
  > src/integrations/supabase/types.ts
```

### Step 5 — Add TypeScript entity type

Add the interface to `src/types/entities.ts` so all modules can use it.

---

## 10. Internationalisation (i18n)

The platform supports **Portuguese** (default), **English**, and **Spanish**.

### Adding a new translation key

1. Add the key to all three locale files:

```json
// src/i18n/locales/pt/common.json
{
  "yourModule": {
    "newKey": "Texto em Português"
  }
}
```

```json
// src/i18n/locales/en/common.json
{
  "yourModule": {
    "newKey": "Text in English"
  }
}
```

```json
// src/i18n/locales/es/common.json
{
  "yourModule": {
    "newKey": "Texto en Español"
  }
}
```

2. Use in a component:

```tsx
import { useI18n } from "@/modules/shared/hooks/useI18n";

function MyComponent() {
  const { t } = useI18n();
  return <p>{t("yourModule.newKey")}</p>;
}
```

---

## 11. Testing

### Running tests

```bash
npm test                # All 372 tests, 34 files
npm run test:watch      # Watch mode (re-runs on file change)
npm run test:coverage   # V8 coverage report (outputs to ./coverage/)
npm run test:e2e        # End-to-end tests only
```

### Writing a service test

Service tests use a **Proxy-based thenable chain** to mock Supabase calls
without importing the real client:

```ts
// src/modules/<domain>/services/__tests__/<domain>Service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { yourService } from "../<domain>Service";

// Proxy-based thenable chain helper (matches existing test pattern)
const createChain = (resolveValue: unknown) => {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(resolveValue);
      }
      return () => proxy;
    },
  });
  return proxy;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => createChain({ data: [], error: null })),
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("yourService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getItems returns empty array on success", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createChain({ data: [], error: null }) as ReturnType<typeof supabase.from>
    );

    const result = await yourService.getItems("clinic-123");
    expect(result).toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith("your_table");
  });

  it("getItems returns empty array on error", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createChain({ data: null, error: new Error("DB error") }) as ReturnType<typeof supabase.from>
    );

    const result = await yourService.getItems("clinic-123");
    expect(result).toEqual([]);
  });
});
```

### Test file locations

Tests live in `__tests__/` subdirectories next to the code they test:
```
src/modules/<domain>/services/__tests__/<domain>Service.test.ts
src/modules/shared/constants/__tests__/queryKeys.test.ts
src/modules/shared/utils/__tests__/errorHandler.test.ts
src/test/navigation.test.ts         (integration / e2e tests)
```

### Coverage thresholds

Configured in `vitest.config.ts`:
- Lines: 60% · Functions: 60% · Branches: 50% · Statements: 60%

---

## 12. Code Quality

### Linting

```bash
npm run lint          # ESLint (config: eslint.config.js)
```

### Formatting

```bash
# Prettier (config: .prettierrc)
npx prettier --write src/
```

### TypeScript

```bash
npx tsc --noEmit      # Type-check without emitting files
```

---

## 13. Deployment

The project is configured for **Vercel** deployment (`vercel.json`).

### Vercel

1. Connect the repository to a Vercel project.
2. Set environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy via `git push` or the Vercel CLI.

`vercel.json` configures SPA rewrites so all routes return `index.html`.

### GitLab CI (`.gitlab-ci.yml`)

A basic CI pipeline is defined for GitLab users. It runs `npm install`,
`npm run lint`, and `npm test`.

### Manual build

```bash
npm run build         # Output → dist/
```

Serve `dist/` with any static file server (nginx, Caddy, etc.).
Configure the server to return `index.html` for all paths (SPA routing).

---

## 14. Troubleshooting

### `VITE_SUPABASE_*` environment variables not loaded

- Ensure your `.env` file is in the **project root** (not `src/`).
- Variable names must start with `VITE_` to be exposed by Vite.
- Restart the dev server after changing `.env`.

### Supabase RLS errors (`new row violates row-level security`)

- Check that the authenticated user has the correct role in `user_roles`.
- Verify that `clinic_users` contains a row linking the user to the clinic.
- Check the migration file for the affected table's RLS policies.

### TypeScript errors in `src/integrations/supabase/types.ts`

This file is auto-generated. **Do not edit it manually.**
Regenerate it with:
```bash
npx supabase gen types typescript --project-id <project-ref> \
  > src/integrations/supabase/types.ts
```

### Tests failing with "Cannot find module '@/...'"

The `@/` alias maps to `src/`. Ensure `vitest.config.ts` includes:
```ts
resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
```

### Hot reload not working

HMR overlay is disabled. Verify the dev server is running with `npm run dev`
and that port **8080** is not blocked by a firewall.
