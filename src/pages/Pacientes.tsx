import { useState, useDeferredValue, useMemo, useCallback, memo } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Users, UserX, Download, FileSpreadsheet, MessageCircle, Copy } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { PlanLimitBanner, usePlanLimitCheck } from "@/components/plan/PlanLimitBanner";
import { toast } from "@/modules/shared/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Paciente = Tables<"pacientes">;

type RowItemData = {
  items: Paciente[];
  onNavigate: (id: string) => void;
  onInactivate: (id: string) => void;
  onCopyInvite: (p: Paciente) => void;
  onWhatsApp: (phone: string) => void;
};

/** Rendered outside the parent component so the reference is stable across renders. */
const PacienteRow = memo(function PacienteRow({
  index,
  style,
  data,
}: ListChildComponentProps<RowItemData>) {
  const { items, onNavigate, onInactivate, onCopyInvite, onWhatsApp } = data;
  const p = items[index];
  if (!p) return null;
  return (
    <div style={style} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
      <div
        className="flex items-center h-full px-4 cursor-pointer"
        onClick={() => onNavigate(p.id)}
      >
        <div className="flex-1 font-medium truncate pr-4">{p.nome}</div>
        <div className="hidden sm:block w-[150px] text-sm truncate pr-4">{p.telefone}</div>
        <div className="hidden md:block w-[140px] text-sm truncate pr-4">{p.cpf || "—"}</div>
        <div className="w-[120px] pr-4">
          <Badge variant="secondary" className="truncate max-w-full">
            {p.tipo_atendimento}
          </Badge>
        </div>
        <div className="w-[100px] pr-4">
          <Badge variant={p.status === "ativo" ? "default" : "outline"}>
            {p.status === "ativo" ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onCopyInvite(p)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => onWhatsApp(p.telefone)}>
            <MessageCircle className="h-4 w-4" />
          </Button>
          {p.status === "ativo" && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onInactivate(p.id)}>
              <UserX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

const Pacientes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeClinicId } = useClinic();
  const { isProfissional } = useAuth();
  const { isAtLimit: pacienteLimitReached } = usePlanLimitCheck("pacientes");
  const [busca, setBusca] = useState("");
  const deferredBusca = useDeferredValue(busca);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroProfissional, setFiltroProfissional] = useState("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["pacientes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("clinic_pacientes")
        .select(`
          paciente_id,
          pacientes (
            id, nome, telefone, cpf, email, status, tipo_atendimento, profissional_id
          )
        `)
        .eq("clinic_id", activeClinicId);

      if (error) throw error;
      return (data || []).map((item: any) => item.pacientes).filter(Boolean) as Paciente[];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-filter"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids).order("nome");
      return data ?? [];
    },
  });

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    return pacientes.filter((p) => {
      const matchBusca =
        !deferredBusca ||
        p.nome.toLowerCase().includes(deferredBusca.toLowerCase()) ||
        p.cpf?.includes(deferredBusca) ||
        p.telefone.includes(deferredBusca) ||
        p.email?.toLowerCase().includes(deferredBusca.toLowerCase());
      const matchTipo = filtroTipo === "todos" || p.tipo_atendimento === filtroTipo;
      const matchStatus = filtroStatus === "todos" || p.status === filtroStatus;
      const matchProf = filtroProfissional === "todos" || p.profissional_id === filtroProfissional;
      return matchBusca && matchTipo && matchStatus && matchProf;
    });
  }, [pacientes, deferredBusca, filtroTipo, filtroStatus, filtroProfissional]);

  const handleInativar = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("pacientes").update({ status: "inativo" }).eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao inativar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paciente inativado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    }
    setDeleteId(null);
  };

  const handleNavigate = useCallback((id: string) => navigate(`/pacientes/${id}/detalhes`), [navigate]);
  const handleInactivate = useCallback((id: string) => setDeleteId(id), []);
  const handleCopyInvite = useCallback((p: Paciente) => {
    const codes = JSON.parse(localStorage.getItem('paciente_codes') || '{}');
    const accessCode = codes[p.id] || (p as any).codigo_acesso;
    if (!accessCode) { toast({ title: "Código não disponível", variant: "destructive" }); return; }
    const invite = `Olá ${p.nome.split(' ')[0]}! 👋\n\nCódigo: ${accessCode}\nLink: ${window.location.origin}/paciente-access`;
    navigator.clipboard.writeText(invite);
    toast({ title: "Convite copiado!" });
  }, []);
  const handleWhatsApp = useCallback((phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone}`, "_blank");
  }, []);

  const rowData = useMemo<RowItemData>(() => ({
    items: filtrados,
    onNavigate: handleNavigate,
    onInactivate: handleInactivate,
    onCopyInvite: handleCopyInvite,
    onWhatsApp: handleWhatsApp,
  }), [filtrados, handleNavigate, handleInactivate, handleCopyInvite, handleWhatsApp]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PlanLimitBanner resource="pacientes" label="Pacientes" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie os pacientes da clínica</p>
        </div>
        <div className="flex gap-2">
          {!isProfissional && (
            <Button size="sm" onClick={() => navigate("/pacientes/novo")} disabled={pacienteLimitReached}>
              <Plus className="h-4 w-4 mr-1" /> Novo Paciente
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Filtros Simplificados para este exemplo de virtualização */}
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Nenhum paciente encontrado.</div>
          ) : (
            <div className="w-full">
              {/* Header da Tabela fixo */}
              <div className="flex items-center px-4 py-2 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="flex-1">Nome</div>
                <div className="hidden sm:block w-[150px]">Telefone</div>
                <div className="hidden md:block w-[140px]">CPF</div>
                <div className="w-[120px]">Tipo</div>
                <div className="w-[100px]">Status</div>
                <div className="w-[84px] text-right">Ações</div>
              </div>
              <div className="w-full h-[500px] overflow-auto">
                <FixedSizeList
                  height={500}
                  width="100%"
                  itemCount={filtrados.length}
                  itemSize={56}
                  itemData={rowData}
                >
                  {PacienteRow}
                </FixedSizeList>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar paciente?</AlertDialogTitle>
            <AlertDialogDescription>O paciente será marcado como inativo e não aparecerá nas listas ativas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleInativar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
};

export default Pacientes;
