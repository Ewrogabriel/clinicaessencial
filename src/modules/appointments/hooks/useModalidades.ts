import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Modalidade } from "@/types/entities";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

interface UseModalidadesOptions {
    ativo?: boolean;
    enabled?: boolean;
}

/**
 * Hook to fetch modalities
 */
export function useModalidades(options: UseModalidadesOptions = {}) {
    const { ativo, enabled = true } = options;
    const { activeClinicId } = useClinic();

    return useQuery({
        queryKey: ["modalidades", ativo, activeClinicId],
        queryFn: async () => {
            let query = supabase
                .from("modalidades")
                .select("id, nome, descricao, ativo, created_by, clinic_id")
                .order("nome");

            if (ativo !== undefined) {
                query = query.eq("ativo", ativo);
            }

            if (activeClinicId) {
                query = query.eq("clinic_id", activeClinicId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as Modalidade[];
        },
        enabled,
        staleTime: 15 * 60 * 1000, // 15 min — modalities rarely change
    });
}

/**
 * Hook to fetch only active modalities (for dropdowns)
 */
export function useModalidadesAtivas() {
    return useModalidades({ ativo: true });
}

/**
 * Hook to create a modality
 */
export function useCreateModalidade() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ nome, descricao, ativo, userId, clinicId }: { nome: string; descricao?: string; ativo: boolean; userId: string; clinicId?: string | null }) => {
            const { error } = await supabase
                .from("modalidades")
                .insert({ nome: nome.trim(), descricao: descricao || null, ativo, created_by: userId, clinic_id: clinicId } as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["modalidades"] });
            toast({ title: "Modalidade criada!" });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        },
    });
}

/**
 * Hook to update a modality
 */
export function useUpdateModalidade() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, nome, descricao, ativo }: { id: string; nome: string; descricao?: string; ativo: boolean }) => {
            const { error } = await supabase
                .from("modalidades")
                .update({ nome: nome.trim(), descricao: descricao || null, ativo })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["modalidades"] });
            toast({ title: "Modalidade atualizada!" });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        },
    });
}

/**
 * Hook to delete a modality
 */
export function useDeleteModalidade() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("modalidades").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["modalidades"] });
            toast({ title: "Modalidade excluída!" });
        },
        onError: (error: Error) => {
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        },
    });
}
