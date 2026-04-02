import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download } from "lucide-react";
import { toast } from "sonner";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { getLogs, getStats, retryMessage } from "@/modules/whatsapp/services/whatsappLogsService";
import { WhatsAppStatsCard } from "@/components/whatsapp/WhatsAppStatsCard";
import { WhatsAppLogsFilter } from "@/components/whatsapp/WhatsAppLogsFilter";
import { WhatsAppLogsTable } from "@/components/whatsapp/WhatsAppLogsTable";
import { WhatsAppLogDetail } from "@/components/whatsapp/WhatsAppLogDetail";
import { WhatsAppExport } from "@/components/whatsapp/WhatsAppExport";
import type { LogFilters, WhatsAppMessageLogWithPatient } from "@/modules/whatsapp/services/whatsappLogsService";

const DEFAULT_FILTERS: LogFilters = {
  messageType: "all",
  status: "all",
  patientSearch: "",
  errorsOnly: false,
};

const PAGE_SIZE = 20;

export default function WhatsAppLogs() {
  const { activeClinicId } = useClinic();
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [statsDays, setStatsDays] = useState(7);
  const [selectedLog, setSelectedLog] = useState<WhatsAppMessageLogWithPatient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // ── Logs query ────────────────────────────────────────────
  const logsQuery = useQuery({
    queryKey: ["whatsapp-logs", activeClinicId, filters, page],
    queryFn: () => getLogs(activeClinicId!, filters, page, PAGE_SIZE),
    enabled: !!activeClinicId,
  });

  // ── Stats query ───────────────────────────────────────────
  const statsQuery = useQuery({
    queryKey: ["whatsapp-stats", activeClinicId, statsDays],
    queryFn: () => getStats(activeClinicId!, statsDays),
    enabled: !!activeClinicId,
  });

  // ── Handlers ─────────────────────────────────────────────
  const handleFiltersChange = useCallback((newFilters: LogFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleView = useCallback((log: WhatsAppMessageLogWithPatient) => {
    setSelectedLog(log);
    setDetailOpen(true);
  }, []);

  const handleRetry = useCallback(
    async (log: WhatsAppMessageLogWithPatient) => {
      const newId = await retryMessage(log.id);
      if (newId) {
        toast.success("Mensagem re-enfileirada para envio.");
        logsQuery.refetch();
        statsQuery.refetch();
      }
    },
    [logsQuery, statsQuery]
  );

  const handleRetried = useCallback(() => {
    logsQuery.refetch();
    statsQuery.refetch();
  }, [logsQuery, statsQuery]);

  const handleStatsChange = useCallback(
    (days: number) => {
      setStatsDays(days);
    },
    []
  );

  const logsPage = logsQuery.data;
  const stats = statsQuery.data ?? {
    totalToday: 0,
    deliveryRate: 0,
    failed: 0,
    read: 0,
    totalPeriod: 0,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          <div>
            <h1 className="text-xl font-bold">Logs WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de mensagens enviadas via WhatsApp
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start sm:self-auto"
          onClick={() => setExportOpen(true)}
          disabled={!activeClinicId}
        >
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Stats */}
      <WhatsAppStatsCard
        stats={stats}
        days={statsDays}
        onDaysChange={handleStatsChange}
        isLoading={statsQuery.isLoading}
      />

      {/* Filters */}
      <WhatsAppLogsFilter filters={filters} onChange={handleFiltersChange} />

      {/* Table */}
      <WhatsAppLogsTable
        logs={logsPage?.data ?? []}
        total={logsPage?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={logsQuery.isLoading}
        onPageChange={setPage}
        onView={handleView}
        onRetry={handleRetry}
      />

      {/* Detail modal */}
      <WhatsAppLogDetail
        log={selectedLog}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRetried={handleRetried}
      />

      {/* Export modal */}
      {activeClinicId && (
        <WhatsAppExport
          clinicId={activeClinicId}
          filters={filters}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
