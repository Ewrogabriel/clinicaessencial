# Guia Prático de Refatoração

Passo a passo para eliminar `as any` e melhorar type-safety.

---

## 1. Padrão: Eliminar `as any` em Queries

### Problema Comum
```typescript
// ❌ Sem tipo, sem segurança
const { data } = await supabase.from("clinicas").select("*") as any;
console.log(data.nome);  // Sem autocomplete!
console.log(data.invalid_field);  // Sem erro de compile!
```

### Solução: Use Tipos Explícitos
```typescript
// ✅ Com tipo, com segurança
import { Clinic } from "@/types/supabase-models";

const { data, error } = await supabase
  .from("clinicas")
  .select("id, nome, email, telefone, ativo, created_at");

if (error) throw error;

const clinics: Clinic[] = data || [];
clinics[0].nome;  // ✓ Autocomplete funciona!
clinics[0].invalid_field;  // ✗ Erro em compile-time!
```

---

## 2. Padrão: Type Guards

### Para Validação de Runtime
```typescript
// ❌ Casting inseguro
const clinic = data as Clinic;

// ✅ Com type guard
if (isClinic(data)) {
  // Agora data é type-safe como Clinic
  console.log(data.nome);
}

// Type guard definido em supabase-models.ts:
export function isClinic(obj: any): obj is Clinic {
  return obj && typeof obj === 'object' && 'id' in obj && 'nome' in obj;
}
```

---

## 3. Padrão: Funções com Genéricos

### Para Operações Genéricas
```typescript
// ❌ Sem tipo
async function query(table: string, columns: string) {
  const { data } = await supabase.from(table).select(columns) as any;
  return data;
}

// ✅ Com genérico
async function query<T>(table: string, columns: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns);
  
  if (error) throw error;
  return (data || []) as T[];
}

// Uso:
const clinics = await query<Clinic>("clinicas", "id, nome, email");
```

---

## 4. Padrão: Service Methods Tipados

### Exemplo Real: Refatorar MasterPanel.tsx

**Antes (ruim):**
```typescript
// src/pages/MasterPanel.tsx
async function loadClinics() {
  const { data } = await supabase
    .from("clinicas")
    .select("*")
    .order("nome") as any;
  
  setClinics(data || []);
  console.log(data[0].invalid_field);  // Sem erro!
}
```

**Depois (bom):**
```typescript
// src/modules/master/services/masterService.ts
import { Clinic, ClinicSubscription, PlatformPlan } from "@/types/supabase-models";

export const masterService = {
  async getClinics(): Promise<Clinic[]> {
    const { data, error } = await supabase
      .from("clinicas")
      .select("id, nome, cnpj, email, telefone, endereco, ativo, created_at")
      .order("nome");
    
    if (error) throw error;
    return data || [];
  },

  async getSubscriptions(): Promise<(ClinicSubscription & { platform_plans: PlatformPlan; clinicas: Clinic })[]> {
    const { data, error } = await supabase
      .from("clinic_subscriptions")
      .select("*, platform_plans(id, nome, valor_mensal, cor), clinicas(id, nome)")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async createClinic(clinic: Clinic): Promise<Clinic> {
    const { data, error } = await supabase
      .from("clinicas")
      .insert(clinic)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// src/pages/MasterPanel.tsx
import { masterService } from "@/modules/master/services/masterService";

async function loadClinics() {
  try {
    const clinics = await masterService.getClinics();
    setClinics(clinics);
    
    // Agora com autocomplete!
    console.log(clinics[0].nome);
    // console.log(clinics[0].invalid_field);  // ✗ Erro!
  } catch (error) {
    toast.error("Erro ao carregar clínicas");
  }
}
```

---

## 5. Padrão: React Query com Types

### Com Type-Safe Hooks
```typescript
// ❌ Sem tipo
const { data } = useQuery({
  queryKey: ["clinics"],
  queryFn: async () => {
    const { data } = await supabase
      .from("clinicas")
      .select("*") as any;
    return data;
  },
});

// ✅ Com tipo
import { Clinic } from "@/types/supabase-models";
import { masterService } from "@/modules/master/services/masterService";

const { data: clinics = [] } = useQuery<Clinic[]>({
  queryKey: ["clinics"],
  queryFn: () => masterService.getClinics(),
});
```

---

## 6. Padrão: Eliminar `as any` em JSX

### Variantes de Componentes
```typescript
// ❌ Sem tipo
<Badge variant={STATUS_COLORS[status] as any}>{status}</Badge>

// ✅ Com tipo
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  ativa: "default",
  suspensa: "secondary",
  cancelada: "destructive",
  trial: "outline",
};

<Badge variant={STATUS_BADGE_VARIANTS[status] ?? "default"}>
  {status}
</Badge>
```

---

## 7. Padrão: Objetos Complexos

### Para Dados Aninhados
```typescript
// ❌ Sem segurança
const user = response.data as any;
const clinics = user?.clinics?.map(c => c.name);

// ✅ Com type guards
interface UserWithClinics {
  id: string;
  name: string;
  clinics: Clinic[];
}

function isUserWithClinics(obj: any): obj is UserWithClinics {
  return (
    obj &&
    typeof obj === 'object' &&
    'id' in obj &&
    'clinics' in obj &&
    Array.isArray(obj.clinics)
  );
}

if (isUserWithClinics(response.data)) {
  const clinics = response.data.clinics.map(c => c.nome);
}
```

---

## 8. Checklist de Refatoração

### Por Arquivo:
- [ ] Identificar todos `as any`
- [ ] Encontrar o tipo esperado da query
- [ ] Checar se tipo já existe em `supabase-models.ts`
- [ ] Criar tipo se não existir
- [ ] Substituir `as any` com tipo explícito
- [ ] Adicionar type guards se necessário
- [ ] Verificar que `select()` tem colunas explícitas
- [ ] Testar com `npm test`
- [ ] Fazer commit

### Comando para Encontrar:
```bash
# Listar todos as any em um arquivo
grep -n "as any" src/pages/MasterPanel.tsx

# Contar total
grep -r "as any" src/ | wc -l

# Por arquivo (ordenado)
grep -r "as any" src/ | cut -d: -f1 | sort | uniq -c | sort -rn | head -20
```

---

## 9. Exemplo Completo: MasterPanel.tsx

### Status Quo (27 `as any`)
```typescript
const { data } = await (supabase.from("clinicas") as any).select("*");
const { data: plans } = await (supabase.from("platform_plans") as any).select("*");
// ... 25 mais
```

### Refactored (0 `as any`)
```typescript
// Novo arquivo: src/modules/master/services/masterService.ts
import { supabase } from "@/integrations/supabase/client";
import { Clinic, PlatformPlan, ClinicSubscription } from "@/types/supabase-models";

export const masterService = {
  async getClinics(): Promise<Clinic[]> { /* ... */ },
  async getPlans(): Promise<PlatformPlan[]> { /* ... */ },
  async getSubscriptions(): Promise<ClinicSubscription[]> { /* ... */ },
  async createClinic(data: Clinic): Promise<Clinic> { /* ... */ },
  // ... mais métodos
};

// Página atualizada: src/pages/MasterPanel.tsx
import { masterService } from "@/modules/master/services/masterService";

// Substituir todos os await supabase.from() com masterService.method()
const clinics = await masterService.getClinics();
```

---

## 10. Testes Após Refatoração

```bash
# Type checking
npm run type-check

# Linting
npm run lint -- --fix

# Unit tests
npm run test

# Build
npm run build

# Se tudo passar, fazer commit!
git add -A
git commit -m "refactor: eliminate as any in MasterPanel.tsx"
```

---

## Recursos Úteis

- [TypeScript Handbook - Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Supabase Type Safety](https://supabase.com/docs/guides/api/rest/generating-types)
- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Never Type `any` Again - Article](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

---

**Created:** 12/04/2026  
**Last Updated:** 12/04/2026
