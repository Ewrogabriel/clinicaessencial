/**
 * Generic CRUD hook using React Query.
 *
 * Eliminates boilerplate across feature hooks by providing a consistent
 * pattern for create / list / detail / update / delete operations with
 * automatic query invalidation and toast notifications.
 *
 * Usage:
 *   const { items, isLoading, create, update, remove } = useCRUD({
 *     queryKey: queryKeys.patients.list(clinicId),
 *     fetchFn: () => patientService.getPatients(clinicId),
 *     createFn: (data) => patientService.createPatient(data),
 *     updateFn: ({ id, data }) => patientService.updatePatient(id, data),
 *     deleteFn: (id) => patientService.deletePatient(id),
 *     invalidateKeys: [queryKeys.patients.all],
 *     messages: {
 *       createSuccess: "Paciente criado!",
 *       updateSuccess: "Paciente atualizado!",
 *       deleteSuccess: "Paciente removido!",
 *     },
 *   });
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CRUDMessages {
  createSuccess?: string;
  updateSuccess?: string;
  deleteSuccess?: string;
  createError?: string;
  updateError?: string;
  deleteError?: string;
}

export interface UseCRUDOptions<TItem, TCreateInput, TUpdateInput> {
  /** React Query key for the list/fetch query */
  queryKey: QueryKey;
  /** Function that fetches the list of items */
  fetchFn: () => Promise<TItem[]>;
  /** Optional: function to create a new item */
  createFn?: (data: TCreateInput) => Promise<TItem>;
  /** Optional: function to update an existing item */
  updateFn?: (args: { id: string; data: TUpdateInput }) => Promise<TItem>;
  /** Optional: function to delete an item by id */
  deleteFn?: (id: string) => Promise<void>;
  /**
   * Additional query keys to invalidate after any mutation.
   * The `queryKey` itself is always invalidated automatically.
   */
  invalidateKeys?: QueryKey[];
  /** Custom toast messages for each operation */
  messages?: CRUDMessages;
  /** Extra options forwarded to `useQuery` */
  queryOptions?: Partial<UseQueryOptions<TItem[]>>;
}

export interface UseCRUDResult<TItem, TCreateInput, TUpdateInput> {
  items: TItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Create mutation – call with the DTO for the new item */
  create: (data: TCreateInput) => Promise<TItem | undefined>;
  isCreating: boolean;
  /** Update mutation – call with `{ id, data }` */
  update: (args: { id: string; data: TUpdateInput }) => Promise<TItem | undefined>;
  isUpdating: boolean;
  /** Delete mutation – call with the item id */
  remove: (id: string) => Promise<void>;
  isDeleting: boolean;
  /** Manually trigger a refetch of the list */
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCRUD<
  TItem,
  TCreateInput = Partial<TItem>,
  TUpdateInput = Partial<TItem>,
>({
  queryKey,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  invalidateKeys = [],
  messages = {},
  queryOptions,
}: UseCRUDOptions<TItem, TCreateInput, TUpdateInput>): UseCRUDResult<
  TItem,
  TCreateInput,
  TUpdateInput
> {
  const queryClient = useQueryClient();

  // ── Helpers ────────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey });
    invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  };

  // ── List query ─────────────────────────────────────────────────────────────

  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TItem[]>({
    queryKey,
    queryFn: fetchFn,
    ...(queryOptions as object),
  });

  // ── Create mutation ────────────────────────────────────────────────────────

  const createMutation = useMutation<TItem, Error, TCreateInput>({
    mutationFn: (data: TCreateInput) => {
      if (!createFn) return Promise.reject(new Error("createFn not provided"));
      return createFn(data);
    },
    onSuccess: () => {
      invalidateAll();
      if (messages.createSuccess) toast.success(messages.createSuccess);
    },
    onError: (err) => {
      const msg = messages.createError ?? err.message ?? "Erro ao criar.";
      toast.error(msg);
    },
  });

  // ── Update mutation ────────────────────────────────────────────────────────

  const updateMutation = useMutation<TItem, Error, { id: string; data: TUpdateInput }>({
    mutationFn: (args) => {
      if (!updateFn) return Promise.reject(new Error("updateFn not provided"));
      return updateFn(args);
    },
    onSuccess: () => {
      invalidateAll();
      if (messages.updateSuccess) toast.success(messages.updateSuccess);
    },
    onError: (err) => {
      const msg = messages.updateError ?? err.message ?? "Erro ao atualizar.";
      toast.error(msg);
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────────

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => {
      if (!deleteFn) return Promise.reject(new Error("deleteFn not provided"));
      return deleteFn(id);
    },
    onSuccess: () => {
      invalidateAll();
      if (messages.deleteSuccess) toast.success(messages.deleteSuccess);
    },
    onError: (err) => {
      const msg = messages.deleteError ?? err.message ?? "Erro ao remover.";
      toast.error(msg);
    },
  });

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    items: data,
    isLoading,
    isError,
    error: error as Error | null,
    create: (data) => createMutation.mutateAsync(data).catch(() => undefined),
    isCreating: createMutation.isPending,
    update: (args) => updateMutation.mutateAsync(args).catch(() => undefined),
    isUpdating: updateMutation.isPending,
    remove: (id) => deleteMutation.mutateAsync(id).catch(() => {}),
    isDeleting: deleteMutation.isPending,
    refetch: () => void refetch(),
  };
}
