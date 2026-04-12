# Guia de Refatoração para Service Layer

Este documento orienta como refatorar páginas que acessam Supabase diretamente para usar um service layer apropriado.

## Problema

Muitas páginas importam diretamente:
```typescript
import { supabase } from "@/integrations/supabase/client";
```

E fazem queries diretamente:
```typescript
const { data } = await supabase.from("pacientes").select("*");
```

## Solução: Padrão Service Layer

### 1. Criar o Service (se não existir)

Arquivo: `src/modules/pacientes/services/patientService.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { Paciente } from "@/types/helpers";

export const patientService = {
  // Listar pacientes
  async listPacientes(clinicId: string): Promise<Paciente[]> {
    const { data, error } = await supabase
      .from("pacientes")
      .select("id,nome,cpf,email,telefone,ativo,created_at")
      .eq("clinic_id", clinicId)
      .order("nome");
    
    if (error) throw error;
    return data || [];
  },

  // Buscar paciente por ID
  async getPaciente(pacienteId: string): Promise<Paciente> {
    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", pacienteId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Criar paciente
  async createPaciente(paciente: Partial<Paciente>): Promise<Paciente> {
    const { data, error } = await supabase
      .from("pacientes")
      .insert([paciente])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Atualizar paciente
  async updatePaciente(id: string, updates: Partial<Paciente>): Promise<Paciente> {
    const { data, error } = await supabase
      .from("pacientes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Deletar paciente
  async deletePaciente(id: string): Promise<void> {
    const { error } = await supabase
      .from("pacientes")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  },
};
```

### 2. Criar Hooks de Uso (se aplicável)

Arquivo: `src/modules/pacientes/hooks/usePacientes.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientService } from "../services/patientService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

export function usePacientes() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const pacientesQuery = useQuery({
    queryKey: ["pacientes", activeClinicId],
    queryFn: () => patientService.listPacientes(activeClinicId || ""),
    enabled: !!activeClinicId,
  });

  const createMutation = useMutation({
    mutationFn: patientService.createPaciente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial }) =>
      patientService.updatePaciente(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: patientService.deletePaciente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    },
  });

  return {
    pacientes: pacientesQuery.data,
    isLoading: pacientesQuery.isLoading,
    error: pacientesQuery.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
```

### 3. Usar na Página

Arquivo: `src/pages/Pacientes.tsx`

```typescript
// ❌ Antes (acesso direto)
import { supabase } from "@/integrations/supabase/client";

const PacientesPage = () => {
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState([]);

  useEffect(() => {
    const fetchPacientes = async () => {
      const { data } = await supabase.from("pacientes").select("*");
      setPacientes(data);
    };
    fetchPacientes();
  }, []);
};

// ✅ Depois (via service layer)
import { usePacientes } from "@/modules/pacientes/hooks/usePacientes";

const PacientesPage = () => {
  const { pacientes, isLoading, create, update, delete: deletePaciente } = usePacientes();

  return (
    <div>
      {isLoading ? <Spinner /> : pacientes?.map(p => <PacienteCard key={p.id} paciente={p} />)}
    </div>
  );
};
```

## Checklist de Refatoração

- [ ] Criar `src/modules/[feature]/services/[feature]Service.ts`
- [ ] Exportar funções CRUD do serviço
- [ ] Criar `src/modules/[feature]/hooks/use[Feature].ts` se usar React Query
- [ ] Atualizar página para importar do hook em vez do Supabase
- [ ] Remover import de `supabase` da página
- [ ] Testar funcionalidade
- [ ] Validar erro é tratado corretamente

## Benefícios

1. **Centralizado**: Toda lógica de dados em um único lugar
2. **Testável**: Services podem ser mockados em testes
3. **Reutilizável**: Múltiplas páginas podem usar o mesmo service
4. **Seguro**: Validação e transformação de dados em um lugar
5. **Performante**: React Query gerencia cache e sincronização

## Módulos Existentes para Referenciar

- `src/modules/auth/services/authService.ts` - Exemplo de service bem estruturado
- `src/modules/patients/services/patientService.ts` - Serviço de pacientes
- `src/modules/appointments/services/appointmentService.ts` - Serviço de agendamentos
- `src/modules/finance/services/financeService.ts` - Serviço de finanças

Use esses como referência ao criar novos services.
