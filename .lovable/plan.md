

# Plan: Fix Build Errors and Verify Feature Status

## Summary of Issues Found

There are **7 build errors** to fix, stemming from missing database tables, incorrect enum values, and type mismatches.

## Fixes Required

### 1. Database Migration: Create `produtos` table and add `suspenso` to `status_plano` enum
- The `produtos` table doesn't exist yet but `Produtos.tsx` references it
- The `status_plano` enum lacks `suspenso` — needed by Matriculas
- Add FK from `planos.profissional_id` to `profiles` (via `auth.users`) so the join `profiles(nome)` works in MeusPlanos and Planos pages

### 2. Fix `CheckInProfissional.tsx` (line 47)
- Change `"faltou"` to `"falta"` to match the `status_agendamento` enum

### 3. Fix `Indicadores.tsx` — references non-existent `matriculas` table
- Replace all `supabase.from("matriculas")` calls with `supabase.from("planos")` since matriculas are stored in the `planos` table
- Cast queries with `as any` where needed to resolve deep type instantiation errors

### 4. Fix `Matriculas.tsx`
- Line 65: Cast `filterStatus` properly for the enum type
- Line 130: Change `forma_pagamento: "pendente"` to `null` (it's not a valid enum value)
- Line 173: `"suspenso"` will work after the enum migration

### 5. Fix `MeusPlanos.tsx` (line 85) and `Planos.tsx` (line 58)
- The join `profiles(nome)` fails because there's no FK from `planos.profissional_id` to `profiles`
- After adding the FK via migration, this will resolve
- As a fallback, use manual profile lookup (same pattern used elsewhere)

### 6. Fix `Produtos.tsx` — will work after `produtos` table is created

### 7. Fix `ai-insights/index.ts` (line 90)
- Cast `error` as `Error`: `(error as Error).message`

## Feature Status Review

Most features from the original list have already been implemented. The remaining build errors are blocking deployment. Once fixed, the key pending items are:
- CEP auto-fill (partially done)
- File upload fixes (bucket exists but UI may have issues)
- Some UI polish items

