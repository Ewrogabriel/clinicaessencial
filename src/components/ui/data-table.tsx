/**
 * DataTable – generic, reusable table with sorting, column filtering,
 * global search, and client-side pagination.
 *
 * Usage:
 *   const columns: DataTableColumn<MyRow>[] = [
 *     { key: "nome", header: "Nome", sortable: true },
 *     { key: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
 *   ];
 *   <DataTable data={rows} columns={columns} searchable />
 */

import { useState, useMemo, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/modules/shared/hooks/useI18n";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<TRow> {
  /** Key in the row object used for default sorting / value access */
  key: keyof TRow & string;
  /** Column header label */
  header: string;
  /** Optional custom cell renderer */
  cell?: (row: TRow, index: number) => ReactNode;
  /** Whether the column is sortable (default: false) */
  sortable?: boolean;
  /** Optional className for the header th */
  headerClassName?: string;
  /** Optional className for every td in this column */
  cellClassName?: string;
}

export interface DataTableProps<TRow> {
  data: TRow[];
  columns: DataTableColumn<TRow>[];
  /** Show a global search input */
  searchable?: boolean;
  /** Placeholder text for the search box */
  searchPlaceholder?: string;
  /** Keys to include in global search (defaults to all column keys) */
  searchKeys?: (keyof TRow & string)[];
  /** Rows per page options (default: [10, 25, 50]) */
  pageSizeOptions?: number[];
  /** Default rows per page (default: 10) */
  defaultPageSize?: number;
  /** Message shown when no rows match */
  emptyMessage?: string;
  /** Optional className for the wrapping div */
  className?: string;
  /** Optional row click handler */
  onRowClick?: (row: TRow, index: number) => void;
  /**
   * Optional function to derive a stable unique key for each row.
   * Falls back to the row's array index when omitted.
   */
  getRowKey?: (row: TRow, index: number) => string | number;
}

type SortDirection = "asc" | "desc" | null;

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<TRow extends object>({
  data,
  columns,
  searchable = false,
  searchPlaceholder,
  searchKeys,
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 10,
  emptyMessage,
  className,
  onRowClick,
  getRowKey,
}: DataTableProps<TRow>) {
  const { t } = useI18n();
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const effectiveSearchKeys = searchKeys ?? columns.map((c) => c.key);
  const resolvedEmptyMessage = emptyMessage ?? t("common.no_data");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("common.search_placeholder");

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!globalFilter.trim()) return data;
    const q = globalFilter.toLowerCase();
    return data.filter((row) =>
      effectiveSearchKeys.some((k) => {
        const val = row[k as keyof TRow];
        return val != null && String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, globalFilter, effectiveSearchKeys]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof TRow];
      const bv = b[sortKey as keyof TRow];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // ── Paginate ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  // ── Sort toggle ─────────────────────────────────────────────────────────────
  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />;
    if (sortDir === "asc") return <ChevronUp className="ml-1 h-3.5 w-3.5" />;
    return <ChevronDown className="ml-1 h-3.5 w-3.5" />;
  };

  const rowKey = (row: TRow, idx: number) =>
    getRowKey ? getRowKey(row, idx) : idx;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search bar */}
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.sortable && "cursor-pointer select-none", col.headerClassName)}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => (
                <TableRow
                  key={rowKey(row, idx)}
                  onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.cellClassName}>
                      {col.cell
                        ? col.cell(row, idx)
                        : (row[col.key as keyof TRow] as ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{t("table.rows_per_page")}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span>
          {sorted.length === 0
            ? t("table.no_results")
            : t("table.showing_range")
                .replace("{from}", String((safePage - 1) * pageSize + 1))
                .replace("{to}", String(Math.min(safePage * pageSize, sorted.length)))
                .replace("{total}", String(sorted.length))}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5ch] text-center">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
