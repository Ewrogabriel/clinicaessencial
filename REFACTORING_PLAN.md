# Plano de Refatoração Essencial Clínicas v2

## Status Atual (12/04/2026)

Este documento lista todas as melhorias críticas identificadas na análise de arquitetura, com plano de execução faseado.

---

## ✅ Fase 1 — Segurança Crítica (CONCLUÍDA)

### 1.1 React Query Cache Cleanup no Sign-out ✅
**Status:** RESOLVIDO  
**Arquivo:** `src/modules/auth/hooks/useAuth.tsx`  
**Mudança:** Adicionado `queryClient.clear()` em ambos os eventos:
- `signOut()` handler
- `onAuthStateChange` -> `SIGNED_OUT` event

**Impacto:** Previne vazamento de dados entre usuários quando um faz logout.

---

## ⏳ Fase 2 — Type-Safety e Performance

### 2.1 Substituir `select("*")` por Colunas Explícitas
**Status:** PENDENTE  
**Afetados:** 85+ arquivos  
**Script:** `scripts/cleanup-select-all.mjs`

**Benefícios:**
- ✓ Melhor performance (menos dados em rede)
- ✓ Type-narrowing funciona corretamente
- ✓ Evita problemas RLS silenciosos

**Padrão Atual:**
```typescript
const { data } = await supabase.from("clinicas").select("*");
```

**Padrão Esperado:**
```typescript
const { data } = await supabase
  .from("clinicas")
  .select("id, nome, email, telefone, ativo, created_at");
```

**Execução:**
```bash
node scripts/cleanup-select-all.mjs  # Verifica mudanças
# Depois revisar manualmente e fazer commit
```

### 2.2 Eliminar `as any` Excessivos
**Status:** PENDENTE  
**Afetados:** ~600 ocorrências em 150+ arquivos  
**Top 5 piores:**
1. `MasterPanel.tsx` - 27 instâncias
2. `DocumentosClinicos.tsx` - 19 instâncias
3. `DisponibilidadeProfissional.tsx` - 17 instâncias
4. `matchingService.ts` - 15 instâncias
5. `Teleconsulta.tsx` - 14 instâncias

**Abordagem:**
- [ ] Criar tipos explícitos para respostas do Supabase
- [ ] Usar type guards em vez de `as any`
- [ ] Adicionar JSDoc para tipos complexos

**Exemplo de Correção:**
```typescript
// ❌ Antes
const data = await supabase.from("clinicas").select("*") as any;

// ✅ Depois
interface ClinicRow {
  id: string;
  nome: string;
  email: string;
  // ... outros campos
}

const { data } = await supabase
  .from("clinicas")
  .select("id, nome, email, ...");
  
const clinics: ClinicRow[] = data || [];
```

---

## 🔄 Fase 3 — Refatoração Arquitetural

### 3.1 Migrar Páginas para Service Layer
**Status:** PENDENTE  
**Afetados:** 63 páginas que importam diretamente `@/integrations/supabase/client`  
**Problema:** Viola a separação de camadas (domain → application → infrastructure)

**Padrão Esperado:**

**Página (não deve acessar Supabase):**
```typescript
// src/pages/Agenda.tsx
import { agendaService } from "@/modules/agenda/services/agendaService";

export default function AgendaPage() {
  const { data: appointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => agendaService.getAppointments(),
  });
  // ...
}
```

**Service (centraliza lógica):**
```typescript
// src/modules/agenda/services/agendaService.ts
import { supabase } from "@/integrations/supabase/client";

export const agendaService = {
  async getAppointments(clinicId: string) {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, patient_id, professional_id, data, horario, status")
      .eq("clinic_id", clinicId);
    
    if (error) throw error;
    return data;
  },
  
  async createAppointment(payload: AppointmentPayload) {
    const { data, error } = await supabase
      .from("sessions")
      .insert(payload)
      .select();
    
    if (error) throw error;
    return data[0];
  },
};
```

**Prioridade (começar por aqui):**
1. **Agenda.tsx** - Crítico, usado por todos
2. **Pacientes.tsx** - Crítico, base de dados
3. **Financeiro.tsx** - Crítico, movimentação de dados
4. **Dashboard.tsx** - Carrega muitos dados
5. Depois os 58 restantes

### 3.2 Criar Service Layer para Operações Comuns
**Status:** PENDENTE

**Serviços Necessários:**
```typescript
// src/modules/clinic/services/clinicService.ts
export const clinicService = {
  getClinic(id: string),
  listClinics(filters?: ClinicFilters),
  createClinic(data: CreateClinicPayload),
  updateClinic(id: string, data: UpdateClinicPayload),
};

// src/modules/patient/services/patientService.ts
export const patientService = {
  getPatient(id: string),
  listPatients(clinicId: string),
  createPatient(data: CreatePatientPayload),
};

// src/modules/finance/services/financeService.ts
export const financeService = {
  getTransactions(clinicId: string),
  createPayment(data: PaymentPayload),
  reconcileBankData(clinicId: string),
};
```

---

## ♿ Fase 4 — Acessibilidade (WCAG AA)

### 4.1 Adicionar aria-labels
**Status:** PENDENTE  
**Problema:** Botões com apenas ícones sem label

**Padrão Esperado:**
```typescript
// ❌ Antes
<Button size="icon">
  <Edit2 className="w-4 h-4" />
</Button>

// ✅ Depois
<Button size="icon" aria-label="Editar registro">
  <Edit2 className="w-4 h-4" />
</Button>
```

### 4.2 Ajustar Cores para WCAG AA
**Status:** PENDENTE  
**Problema:** `--muted-foreground` não tem suficiente contraste

**Mudança Necessária:**
```css
/* src/index.css ou tailwind.config.ts */
--muted-foreground: #404040;  /* De #737373 para mais escuro */
```

### 4.3 Respeitar `prefers-reduced-motion`
**Status:** PENDENTE

**Padrão:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🎯 Fase 5 — Melhorias Funcionais

### 5.1 Dashboard do Paciente
**Status:** PLANEJADO  
**Melhorias:**
- [ ] Lazy load seções (cards colapsáveis)
- [ ] Filtros dinâmicos por período
- [ ] Paginação em históricos

### 5.2 Integração de Pagamentos
**Status:** PLANEJADO  
**Necessário:**
- [ ] Stripe / MercadoPago API
- [ ] Validação automática de PIX
- [ ] Webhooks para status de pagamento

### 5.3 Notificações em Tempo Real
**Status:** PLANEJADO  
**Tecnologia:** WebSocket / Supabase Realtime

---

## 📊 Métricas de Progresso

| Fase | Tarefa | Status | Progresso | Data Esperada |
|------|--------|--------|-----------|--------------|
| 1 | Segurança Cache | ✅ Done | 100% | ✅ 12/04 |
| 2 | select("*") | ⏳ Pendente | 0% | 15/04 |
| 2 | as any | ⏳ Pendente | 0% | 20/04 |
| 3 | Service Layer | ⏳ Pendente | 0% | 30/04 |
| 4 | WCAG | ⏳ Pendente | 0% | 10/05 |
| 5 | Features | 🔮 Planejado | 0% | 30/05 |

---

## 📋 Checklist de Execução

### Hoje (12/04)
- [x] Corrigir cache cleanup no sign-out
- [x] Criar script de limpeza select(*)
- [x] Documentar plano de refatoração

### Próximos 3 dias
- [ ] Executar script select(*) e revisar
- [ ] Começar a eliminar `as any` em MasterPanel.tsx
- [ ] Criar tipos Supabase explícitos

### Próximas 2 semanas
- [ ] Refatorar Agenda.tsx para service layer
- [ ] Refatorar Pacientes.tsx para service layer
- [ ] Refatorar Financeiro.tsx para service layer
- [ ] Melhorias WCAG (aria-labels, cores)

### Próximo mês
- [ ] Refatorar todas as 63 páginas para service layer
- [ ] Eliminar todos os `as any` restantes
- [ ] Setup WebSocket para notificações em tempo real

---

## 🚀 Como Executar

### Script de Limpeza select(*)
```bash
# Simular mudanças
node scripts/cleanup-select-all.mjs

# Verificar diferenças
git diff src/

# Se tudo ok, fazer commit
git add -A
git commit -m "refactor: replace select(*) with explicit columns"
```

### Refatoração Manual
Para cada arquivo com `as any`:
1. Identificar tipos esperados
2. Criar interface TypeScript
3. Substituir casts com guards
4. Testar com `npm test`

---

## 📚 Referências

- [Supabase Type Safety Best Practices](https://supabase.com/docs/guides/api/rest/generating-types)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

---

## 👥 Responsáveis

- **Arquitetura:** v0 AI Assistant
- **Implementação:** Time de Desenvolvimento
- **Review:** Tech Lead
- **QA:** QA Team

---

**Última atualização:** 12/04/2026  
**Próxima review:** 19/04/2026
