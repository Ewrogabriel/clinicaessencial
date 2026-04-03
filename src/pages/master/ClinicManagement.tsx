import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, XCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClinicTable } from "@/components/master/ClinicTable";
import { ClinicDetailDialog } from "@/components/master/ClinicDetailDialog";
import { useClinics, useActivateClinic, useDeactivateClinic } from "@/modules/master/hooks/useMasterAdmin";
import { toast } from "sonner";
type StatusFilter = "all" | "ativa" | "trial" | "suspensa" | "cancelada";

export default function ClinicManagement() {
  const { data: clinics = [], isLoading } = useClinics();
  const activateMutation = useActivateClinic();
  const deactivateMutation = useDeactivateClinic();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailClinic, setDetailClinic] = useState<any>(null);

  const filtered = useMemo(() => {
    return clinics.filter((c: any) => {
      const matchesSearch =
        !search ||
        c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.cnpj?.includes(search);
      const status = c.status ?? (c.ativo ? "ativa" : "suspensa");
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clinics, search, statusFilter]);

  const metrics = useMemo(() => {
    const total = clinics.length;
    const active = clinics.filter((c: any) => c.ativo && (c.status ?? "ativa") === "ativa").length;
    const trial = clinics.filter((c: any) => c.status === "trial").length;
    const suspended = clinics.filter(
      (c: any) => !c.ativo || c.status === "suspensa" || c.status === "cancelada",
    ).length;
    return { total, active, trial, suspended };
  }, [clinics]);

  const allSelected = filtered.length > 0 && filtered.every((c: any) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c: any) => c.id)));
    }
  };

  const handleBulkActivate = async () => {
    for (const id of selectedIds) {
      await activateMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
    toast({ title: `${selectedIds.size} clínica(s) ativada(s) ✅` });
    queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
  };

  const handleBulkDeactivate = async () => {
    for (const id of selectedIds) {
      await deactivateMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
    toast({ title: `${selectedIds.size} clínica(s) desativada(s)` });
    queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gestão de Clínicas</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie todas as clínicas da plataforma
          </p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{metrics.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{metrics.active}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{metrics.trial}</p>
              <p className="text-xs text-muted-foreground">Trial</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive shrink-0" />
            <div>
              <p className="text-2xl font-bold">{metrics.suspended}</p>
              <p className="text-xs text-muted-foreground">Suspensas/Canceladas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + bulk actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Clínicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Buscar por nome ou CNPJ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspensa">Suspensa</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <span className="text-sm font-medium">
                {selectedIds.size} selecionada(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkActivate}
                disabled={activateMutation.isPending}
              >
                Ativar selecionadas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDeactivate}
                disabled={deactivateMutation.isPending}
              >
                Desativar selecionadas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-1">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
              Selecionar tudo ({filtered.length})
            </label>
          </div>

          <ClinicTable
            clinics={filtered}
            isLoading={isLoading}
            onActivate={(id) => activateMutation.mutate(id)}
            onDeactivate={(id) => deactivateMutation.mutate(id)}
            onViewDetails={(clinic) => setDetailClinic(clinic)}
          />
        </CardContent>
      </Card>

      <ClinicDetailDialog
        open={!!detailClinic}
        onOpenChange={(open) => {
          if (!open) setDetailClinic(null);
        }}
        clinic={detailClinic}
      />
    </div>
  );
}
