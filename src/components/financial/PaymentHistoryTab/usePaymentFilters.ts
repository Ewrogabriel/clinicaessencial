import { useState, useMemo } from "react";
import type { FilterState, PaymentEntry } from "./types";

const DEFAULT_FILTERS: FilterState = {
  searchText: "",
  filterForma: "todos",
  filterPeriodo: "ultimos3",
  filterStatus: "todos",
  filterTipo: "todos",
};

export function usePaymentFilters(payments: PaymentEntry[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    const now = new Date();
    return payments.filter((p) => {
      // Period filter
      if (filters.filterPeriodo !== "todos") {
        const refDate = p.data_pagamento || p.data_vencimento || p.created_at;
        if (refDate) {
          if (filters.filterPeriodo === "ultimos3") {
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            if (new Date(refDate) < cutoff) return false;
          } else {
            const month = refDate.substring(0, 7);
            if (month !== filters.filterPeriodo) return false;
          }
        }
      }

      // Status filter
      if (filters.filterStatus !== "todos" && p.status !== filters.filterStatus) return false;

      // Tipo filter
      if (filters.filterTipo !== "todos" && p.origem_tipo !== filters.filterTipo) return false;

      // Forma filter
      if (filters.filterForma !== "todos") {
        const forma = (p.forma_pagamento ?? "").toLowerCase();
        if (!forma.includes(filters.filterForma.toLowerCase())) return false;
      }

      // Text search
      if (filters.searchText.trim()) {
        const q = filters.searchText.toLowerCase();
        if (
          !p.descricao.toLowerCase().includes(q) &&
          !(p.observacoes ?? "").toLowerCase().includes(q) &&
          !(p.forma_pagamento ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [payments, filters]);

  const hasActiveFilters = useMemo(
    () =>
      !!filters.searchText ||
      filters.filterForma !== "todos" ||
      filters.filterPeriodo !== "ultimos3" ||
      filters.filterStatus !== "todos" ||
      filters.filterTipo !== "todos",
    [filters]
  );

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return {
    filters,
    setFilters,
    filtered,
    hasActiveFilters,
    clearFilters,
  };
}
