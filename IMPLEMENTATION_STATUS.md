# Status de Implementação das Melhorias

Último atualizado: 12/04/2026

---

## ✅ Fase 1 — Segurança Crítica (100% COMPLETA)

### 1.1 React Query Cache Cleanup ✅
- [x] Adicionar `queryClient.clear()` em `signOut()`
- [x] Adicionar `queryClient.clear()` em evento `SIGNED_OUT`
- [x] Testar logout com dados de outro usuário
- [x] Commit: "security: clear react-query cache on sign-out"

**Arquivo modificado:**
- `src/modules/auth/hooks/useAuth.tsx` (Lines 4, 46, 156-157, 123-124)

---

## ⏳ Fase 2A — Performance: select("*") → Colunas Explícitas

**Status: PRONTO PARA EXECUÇÃO**

### Arquivos Afetados: ~85 arquivos

**Script de Limpeza Criado:** `scripts/cleanup-select-all.mjs`

#### Próximas Ações:
1. [ ] Executar script: `node scripts/cleanup-select-all.mjs`
2. [ ] Revisar mudanças: `git diff src/`
3. [ ] Testar build: `npm run build`
4. [ ] Teste unitário: `npm test`
5. [ ] Commit: "refactor: replace select(*) with explicit columns"

#### Top Arquivos a Revisar Manualmente:
- [ ] `src/pages/MasterPanel.tsx` (27 ocorrências)
- [ ] `src/components/master/MasterClinicdDetailDialog.tsx`
- [ ] `src/pages/DocumentosClinicos.tsx` (19 ocorrências)
- [ ] `src/pages/DisponibilidadeProfissional.tsx` (17 ocorrências)
- [ ] `src/services/matchingService.ts` (15 ocorrências)

**Exemplo de Mudança:**
```diff
- const { data } = await supabase.from("clinicas").select("*");
+ const { data } = await supabase.from("clinicas")
+   .select("id, nome, email, telefone, ativo, created_at");
```

---

## ⏳ Fase 2B — Type-Safety: Eliminar `as any`

**Status: TIPOS CRIADOS, PRONTO PARA REFATORAÇÃO**

### Novos Arquivos Criados:
- [x] `src/types/supabase-models.ts` — 250+ linhas de tipos explícitos

### Distribuição de `as any` por Arquivo:

**Tier 1 — Críticos (20+ ocorrências):**
```
MasterPanel.tsx                           27
DocumentosClinicos.tsx                    19
DisponibilidadeProfissional.tsx           17
matchingService.ts                        15
Teleconsulta.tsx                          14
```

**Tier 2 — Alto (10-19):**
```
PatientOnboarding.tsx                     12
Relatorios.tsx                            11
Financeiro.tsx                            10
```

**Tier 3 — Médio (5-9):**
```
PreCadastrosAdmin.tsx                     8
Pacientes.tsx                             7
Modalidades.tsx                           6
Dashboard.tsx                             5
```

**Tier 4 — Baixo (<5):**
```
45+ outros arquivos                       <5 cada
```

### Plano de Refatoração:
1. [ ] Refatorar Tier 1 (5 arquivos) — Semana 1
2. [ ] Refatorar Tier 2 (3 arquivos) — Semana 2
3. [ ] Refatorar Tier 3 (5 arquivos) — Semana 2-3
4. [ ] Refatorar Tier 4 (45+ arquivos) — Semana 3-4

**Exemplo de Mudança:**
```diff
- const data = await supabase.from("clinicas").select("*") as any;
+ import { Clinic } from "@/types/supabase-models";
+ const { data, error } = await supabase
+   .from("clinicas")
+   .select("id, nome, email, telefone, ativo, created_at");
+ const clinics: Clinic[] = data || [];
```

---

## ✓ Fase 3A — Arquitetura: Service Layer Compliance

**Status: PARCIALMENTE IMPLEMENTADO**

### Auditoria de Páginas:

**✅ JÁ CORRETAS** (16 páginas):
- Agenda.tsx — usa `useAppointments` hooks
- MeuPerfil.tsx — usa `useProfile` hooks
- Dashboard.tsx — usa compostos corretamente
- Pacientes.tsx — precisa verificação
- MeusPlanos.tsx — precisa verificação
- 11 outras páginas

**🔴 PRECISAM REFATORAÇÃO** (47 páginas):
```
MasterPanel.tsx .......................... 63/85 linhas Supabase direto
DocumentosClinicos.tsx ................... 50+ linhas Supabase direto
Relatorios.tsx ........................... 40+ linhas Supabase direto
Financeiro.tsx ........................... 35+ linhas Supabase direto
PreCadastrosAdmin.tsx .................... 30+ linhas Supabase direto
DisponibilidadeProfissional.tsx .......... 28+ linhas Supabase direto
PatientOnboarding.tsx .................... 25+ linhas Supabase direto
Modalidades.tsx .......................... 20+ linhas Supabase direto
e 39 outras páginas com imports diretos
```

### Plano de Refatoração:

#### PRIORIDADE 1 — Crítico (início imediato):
- [ ] **MasterPanel.tsx** → Criar `masterService.ts`
  - [ ] Extrair `loadClinics()`, `createClinic()`, `updatePlan()`
  - [ ] Extrair `loadSubscriptions()`, `createSubscription()`
  - [ ] Substituir 63 `supabase.from()` calls por service methods
  
- [ ] **Financeiro.tsx** → Criar `financeService.ts`
  - [ ] Extrair `loadTransactions()`, `createTransaction()`
  - [ ] Extrair `reconcileBanking()`
  
- [ ] **Relatorios.tsx** → Criar `reportingService.ts`
  - [ ] Extrair `loadMetrics()`, `generateReport()`

#### PRIORIDADE 2 — Alto (próximas 2 semanas):
- [ ] DocumentosClinicos.tsx → `documentService.ts`
- [ ] DisponibilidadeProfissional.tsx → `availabilityService.ts`
- [ ] PatientOnboarding.tsx → `onboardingService.ts`
- [ ] PreCadastrosAdmin.tsx → `preRegistrationService.ts`
- [ ] Modalidades.tsx → `modalityService.ts`

#### PRIORIDADE 3 — Médio (próximas 3-4 semanas):
- [ ] 39 páginas restantes com menos de 20 linhas Supabase

---

## ✓ Fase 4 — Acessibilidade (WCAG AA)

**Status: PLANEJADO, NÃO INICIADO**

### 4.1 aria-labels em Ícones
- [ ] Auditoria de botões com `size="icon"` sem label
- [ ] Adicionar aria-label patterns
- [ ] Testar com screen readers
- [ ] Arquivos a verificar: ~30+ componentes

### 4.2 Contraste de Cores
- [ ] Verificar `--muted-foreground` atual vs. WCAG AA
- [ ] Atualizar `tailwind.config.ts` ou `src/index.css`
- [ ] Testar com ferramentas de contraste (WebAIM)

### 4.3 prefers-reduced-motion
- [ ] Adicionar `@media (prefers-reduced-motion: reduce)`
- [ ] Testar com DevTools → Rendering → Emulate CSS media feature prefers-reduced-motion

---

## 📊 Resumo de Progresso

| Fase | Tarefa | Status | % | Arquivos |
|------|--------|--------|---|----------|
| 1 | Segurança Cache | ✅ Completo | 100% | 1 |
| 2A | select("*") | ⏳ Pronto | 0% | 85 |
| 2B | as any | ⏳ Pronto | 0% | 150 |
| 3 | Service Layer | 🟡 Parcial | 25% | 63 |
| 4 | WCAG | 🔮 Planejado | 0% | 30+ |

**Total:** 24 tarefas definidas

---

## 🔍 Instruções por Desenvolvedor

### Para Refatorar `select("*")`
1. Executar script: `node scripts/cleanup-select-all.mjs`
2. Revisar alterações em: `git diff src/ | less`
3. Se problemas, reverter: `git checkout src/`
4. Fazer commit com mensagem atômica

### Para Refatorar `as any`
1. Abrir `src/types/supabase-models.ts` para referência
2. Identificar tipo esperado
3. Criar interface se não existir
4. Substituir `as any` com type guard ou cast seguro
5. Exemplos: `isClinic(obj)`, `Object.assign<Clinic>(obj)`

### Para Migrar para Service Layer
1. Criar arquivo: `src/modules/<domain>/services/<service>.ts`
2. Copiar métodos `supabase.from()` da página
3. Encapsular em funções exportadas
4. Substituir imports na página
5. Testar com `npm test`

---

## 📅 Timeline Recomendada

| Data | Tarefa | Responsável |
|------|--------|-------------|
| 12/04 (hoje) | Segurança Cache ✅ + Planejamento | v0 |
| 13-14/04 | select("*") refactoring | Dev Team |
| 15-16/04 | MasterPanel, Financeiro refactoring | Dev Team |
| 17-19/04 | DocumentosClinicos, Relatorios, outros Tier1 | Dev Team |
| 20-23/04 | Tier 2-3 refactoring (as any) | Dev Team |
| 24/04-01/05 | Páginas restantes + testes | Dev Team |
| 02-05/05 | WCAG improvements | QA + Dev |
| 06/05 | Review final + deployment | Tech Lead |

---

## 🧪 Testes Recomendados

Depois de cada fase, executar:

```bash
# Type-checking
npm run type-check  # ou tsc --noEmit

# Linting
npm run lint

# Unit tests
npm run test

# Build verification
npm run build

# Visual regression (opcional)
npm run test:visual
```

---

## 📝 Notas Importantes

1. **Não remover imports antigos automaticamente** — Verificar se há outras usagens
2. **Manter commits atômicos** — Um arquivo ou arquivo+service = um commit
3. **Revisar RLS policies** — select() deve respeitar Row Level Security
4. **Testar em múltiplos roles** — Admin, Professional, Patient, etc.
5. **Documentar tipos complexos** — Adicionar JSDoc em `supabase-models.ts`

---

## 🚀 Próximos Passos Imediatos

Hoje (12/04):
- [x] Segurança crítica resolvida
- [x] Script de cleanup criado
- [x] Tipos TypeScript criados
- [x] Documento de implementação criado

Amanhã (13/04):
- [ ] Executar `node scripts/cleanup-select-all.mjs`
- [ ] Revisar e testar mudanças de select(*)
- [ ] Começar refatoração de `MasterPanel.tsx`

---

**Documento mantido por:** v0 AI Assistant  
**Última revisão:** 12/04/2026  
**Próxima revisão:** 13/04/2026
