import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Paciente = Tables<"pacientes">;

export const usePacientes = () => {
    const { activeClinicId } = useClinic();
    const queryClient = useQueryClient();

    const { data: pacientes = [], isLoading } = useQuery({
        queryKey: ["pacientes", activeClinicId],
        queryFn: async () => {
            if (activeClinicId) {
                const { data: cp } = await supabase.from("clinic_pacientes")
                    .select("paciente_id").eq("clinic_id", activeClinicId);
                const ids = (cp || []).map((c) => c.paciente_id);
                if (!ids.length) return [];
                
                const { data, error } = await supabase.from("pacientes")
                    .select("*")
                    .in("id", ids)
                    .order("nome", { ascending: true });
                
                if (error) throw error;
                return data as Paciente[];
            }
            
            const { data, error } = await supabase.from("pacientes")
                .select("*")
                .order("nome", { ascending: true });
            
            if (error) throw error;
            return data as Paciente[];
        },
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: "ativo" | "inativo" }) => {
            const { error } = await supabase
                .from("pacientes")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pacientes"] });
            toast({ title: "Status do paciente atualizado com sucesso" });
        },
        onError: (error: any) => {
            toast({ 
                title: "Erro ao atualizar status", 
                description: error.message, 
                variant: "destructive" 
            });
        }
    });

    return {
        pacientes,
        isLoading,
        updateStatus
    };
};
