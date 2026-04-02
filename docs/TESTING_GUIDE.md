# Testing Guide

How to write, run and maintain tests for Clínica Essencial.

## Test Stack

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev) | Test runner (Vite-native, very fast) |
| [React Testing Library](https://testing-library.com) | Component rendering + querying |
| [@testing-library/user-event](https://testing-library.com/docs/user-event/intro) | Realistic user interactions |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | Custom DOM matchers |
| jsdom | Browser-like environment for Node |

## Running Tests

```bash
npm test                   # run once
npm run test:watch         # watch mode (re-runs on save)
npm run test:coverage      # with coverage report (opens in coverage/)
```

## Coverage Targets

| Metric | Threshold |
|--------|-----------|
| Lines | ≥ 75 % |
| Functions | ≥ 80 % |
| Branches | ≥ 70 % |
| Statements | ≥ 75 % |

## Test Types

### Unit Tests

- Location: co-located with the source file, e.g. `src/lib/__tests__/utils.test.ts`
- Scope: a single function, hook, or component in isolation
- Dependencies: mocked

```typescript
import { describe, it, expect } from "vitest";
import { maskCPF } from "@/lib/masks";

describe("maskCPF", () => {
  it("formats 11 digits as CPF", () => {
    expect(maskCPF("12345678901")).toBe("123.456.789-01");
  });
});
```

### Integration Tests

- Location: `src/test/integration/`
- Scope: a full feature workflow (auth, patients, financial, appointments)
- Supabase: mocked at the module boundary with `vi.mock`

```typescript
// src/test/integration/auth.test.ts
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: vi.fn(), ... } },
}));
```

### Component Tests

- Location: `src/components/__tests__/` or co-located
- Use `render` + `screen` from React Testing Library
- Use `userEvent` for interactions

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientCard } from "../PatientCard";

it("shows patient name", () => {
  render(<PatientCard patient={{ id: "1", nome: "Ana Lima" }} />);
  expect(screen.getByText("Ana Lima")).toBeInTheDocument();
});
```

## Mocking Supabase

Use this pattern to mock Supabase in any test file:

```typescript
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));
```

Build chain responses with the `chainMock` helper pattern used in `src/test/integration/`:

```typescript
const chainMock = (resolvedValue) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(resolvedValue),
});

mockFrom.mockReturnValue(chainMock({ data: { id: "1" }, error: null }));
```

## Test Data Factories

Define small factory functions at the top of integration test files to create realistic test objects:

```typescript
const makePaciente = (overrides = {}) => ({
  id: "pac-1",
  nome: "Ana Lima",
  cpf: "12345678901",
  status: "ativo",
  ...overrides,
});
```

## Global Setup

`src/test/setup.ts` runs before every test suite. It:

- Imports `@testing-library/jest-dom` matchers
- Mocks `window.matchMedia` (required by many UI components)

Add new global mocks here if they are needed by most tests.

## Naming Conventions

| Kind | Pattern | Example |
|------|---------|---------|
| Test file | `*.test.ts(x)` | `masks.test.ts` |
| Test suite | `describe("subject", ...)` | `describe("maskCPF", ...)` |
| Test case | `it("should ...", ...)` | `it("should format 11 digits")` |

## What NOT to test

- `src/components/ui/` (shadcn/ui primitives – third-party, not our logic)
- `src/integrations/` (generated Supabase types)
- Render snapshots (brittle; prefer behaviour assertions)
