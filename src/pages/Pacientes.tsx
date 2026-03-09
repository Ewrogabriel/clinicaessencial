import { useState } from "react";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, Users, Trash2, UserX, Download, FileSpreadsheet, MessageCircle, Copy } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { PlanLimitBanner, usePlanLimitCheck } from "@/components/plan/PlanLimitBanner";
import { toast } from "@/hooks/use-toast";
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

const Pacientes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeClinicId } = useClinic();
  const { isAtLimit: pacienteLimitReached } = usePlanLimitCheck("pacientes");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroProfissional, setFiltroProfissional] = useState("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleInativar = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("pacientes")
      .update({ status: "inativo" })
      .eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao inativar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paciente inativado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    }
    setDeleteId(null);
  };

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["pacientes", activeClinicId],
    queryFn: async () => {
      if (activeClinicId) {
        // Get patient IDs linked to this clinic
        const { data: cpData } = await (supabase.from("clinic_pacientes") as any)
          .select("paciente_id")
          .eq("clinic_id", activeClinicId);
        const ids = cpData?.map((cp: any) => cp.paciente_id) ?? [];
        if (!ids.length) return [];
        const { data, error } = await (supabase.from("pacientes") as any)
          .select("*")
          .in("id", ids)
          .order("nome");
        if (error) throw error;
        return data as Paciente[];
      }
      const { data, error } = await (supabase.from("pacientes") as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Paciente[];
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

  const filtrados = pacientes.filter((p) => {
    const matchBusca =
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.cpf?.includes(busca) ||
      p.telefone.includes(busca) ||
      p.email?.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === "todos" || p.tipo_atendimento === filtroTipo;
    const matchStatus = filtroStatus === "todos" || p.status === filtroStatus;
    const matchProf = filtroProfissional === "todos" || p.profissional_id === filtroProfissional;
    return matchBusca && matchTipo && matchStatus && matchProf;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Lista de Pacientes", 14, 15);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Nome", "Telefone", "CPF", "Tipo", "Status"]],
      body: filtrados.map(p => [p.nome, p.telefone, p.cpf || "—", p.tipo_atendimento, p.status]),
      styles: { fontSize: 8 },
    });
    doc.save("pacientes.pdf");
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(filtrados.map(p => ({
      Nome: p.nome, Telefone: p.telefone, CPF: p.cpf || "", Email: p.email || "",
      Tipo: p.tipo_atendimento, Status: p.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pacientes");
    XLSX.writeFile(wb, "pacientes.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PlanLimitBanner resource="pacientes" label="Pacientes" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
            Pacientes
          </h1>
          <p className="text-muted-foreground">
            Gerencie os pacientes da clínica
          </p>
        </div>
        <Button onClick={() => navigate("/pacientes/novo")} disabled={pacienteLimitReached}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Paciente
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
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
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas modalidades</SelectItem>
                {modalidades.map((m: any) => (
                  <SelectItem key={m.id} value={m.nome.toLowerCase()}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos profissionais</SelectItem>
                {profissionais.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                    <TableHead className="hidden md:table-cell">CPF</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
                </TableBody>
              </Table>
            </div>
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-muted-foreground/50" />}
              title="Nenhum paciente encontrado"
              description={pacientes.length === 0 ? 'Clique em "Novo Paciente" para cadastrar o primeiro' : "Tente ajustar os filtros de busca"}
              action={pacientes.length === 0 ? <Button onClick={() => navigate("/pacientes/novo")}><Plus className="h-4 w-4 mr-2" /> Novo Paciente</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                    <TableHead className="hidden md:table-cell">CPF</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((paciente) => (
                    <TableRow key={paciente.id} className="cursor-pointer" onClick={() => navigate(`/pacientes/${paciente.id}/detalhes`)}>
                      <TableCell className="font-medium">{paciente.nome}</TableCell>
                      <TableCell className="hidden sm:table-cell">{paciente.telefone}</TableCell>
                      <TableCell className="hidden md:table-cell">{paciente.cpf || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {paciente.tipo_atendimento.charAt(0).toUpperCase() + paciente.tipo_atendimento.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={paciente.status === "ativo" ? "default" : "outline"}
                        >
                          {paciente.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Copiar convite com código de acesso"
                            onClick={() => {
                              // Try to get from localStorage first
                              const codes = JSON.parse(localStorage.getItem('paciente_codes') || '{}');
                              let accessCode = codes[paciente.id] || (paciente as any).codigo_acesso;
                              
                              if (!accessCode) {
                                toast({ title: "Código não disponível", variant: "destructive" });
                                return;
                              }
                              const accessLink = `${window.location.origin}/paciente-access`;
                              const inviteMessage = `Olá ${paciente.nome.split(' ')[0]}! 👋\n\nVocê foi cadastrado(a) em nosso sistema Essencial FisioPilates. Para acessar sua área de atendimento, use o código abaixo:\n\n📱 CÓDIGO DE ACESSO: ${accessCode}\n\n🔗 Link: ${accessLink}\n\nSimplemente acesse o link acima e insira seu código de acesso.\n\nQualquer dúvida, entre em contato conosco! 😊`;
                              navigator.clipboard.writeText(inviteMessage);
                              toast({ title: "Convite copiado!", description: "Mensagem pronta para enviar via WhatsApp" });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Conversar no WhatsApp"
                            onClick={() => {
                              const cleanPhone = paciente.telefone.replace(/\D/g, "");
                              if (cleanPhone) {
                                const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                                window.open(`https://wa.me/${fullPhone}`, "_blank");
                              } else {
                                toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" });
                              }
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {paciente.status === "ativo" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-8 w-8"
                              title="Inativar paciente"
                              onClick={() => setDeleteId(paciente.id)}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              O paciente será marcado como inativo e não aparecerá nas listas ativas. Esta ação pode ser desfeita editando o paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleInativar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Pacientes;
