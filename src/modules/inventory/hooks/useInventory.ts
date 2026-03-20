import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../services/inventoryService";
import { toast } from "sonner";

export function useProducts() {
    return useQuery({
        queryKey: ["products"],
        queryFn: () => inventoryService.getProducts(),
    });
}

export function useUpdateStock() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, newStock }: { id: string; newStock: number }) =>
            inventoryService.updateStock(id, newStock),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            toast.success("Estoque atualizado!");
        },
    });
}
