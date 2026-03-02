import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, UserCog, UserCheck, Shield, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import UserRoleManager from "@/components/profissionais/UserRoleManager";
import { generateProfessionalContractPDF } from "@/lib/generateProfessionalContractPDF";
import { maskPhone } from "@/lib/masks";

interface Profissional {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  role?: string;
  especialidade?: string | null;
  commission_rate?: number;
  commission_fixed?: number;
  cor_agenda?: string | null;
  tipo_contratacao?: string | null;
  cnpj?: string | null;
  registro_profissional?: string | null;
}

const Profissionais = () => {
  const { user, isAdmin, isGestor } = useAuth();
  const canManage = isAdmin || isGestor;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState("0");
  const [commissionFixed, setCommissionFixed] = useState("0");
  const [corAgenda, setCorAgenda] = useState("#3b82f6");
  const [registroProfissional, setRegistroProfissional] = useState("");
  const [tipoContratacao, setTipoContratacao] = useState<string | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ["profissionais"],
    queryFn: async () => {
      // Fetch user IDs with professional or admin roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["profissional", "admin"]);

      const userIds = roleData?.map(r => r.user_id) ?? [];

      if (userIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
        .order("nome");

      if (error) throw error;

      // Attach roles to profiles
      return (data as any[]).map(p => ({
        ...p,
        role: roleData?.find(r => r.user_id === p.user_id)?.role || 'profissional'
      })) as Profissional[];
    },
  });

  const openEdit = (p: Profissional) => {
    setEditingId(p.id);
    setNome(p.nome);
    setEmail(p.email || "");
    setTelefone(p.telefone || "");
    setEspecialidade(p.especialidade || null);
    setCommissionRate(String(p.commission_rate || 0));
    setCommissionFixed(String(p.commission_fixed || 0));
    setCorAgenda(p.cor_agenda || "#3b82f6");
    setRegistroProfissional((p as any).registro_profissional || "");
    setTipoContratacao((p as any).tipo_contratacao || null);
    setCnpj((p as any).cnpj || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingId || !nome.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: nome.trim(),
          email: email || null,
          telefone: telefone || null,
          especialidade: especialidade,
          commission_rate: parseFloat(commissionRate) || 0,
          commission_fixed: parseFloat(commissionFixed) || 0,
          cor_agenda: corAgenda,
          registro_profissional: registroProfissional || null,
          tipo_contratacao: tipoContratacao || null,
          cnpj: cnpj || null,
        } as any)
        .eq("id", editingId);
      if (error) throw error;
      toast({ title: "Profissional atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["profissionais"] });
      setDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Profissionais</h1>
        <p className="text-muted-foreground">Visualize e edite os dados dos profissionais</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
          ) : profissionais.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <UserCog className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum profissional cadastrado</p>
              <p className="text-sm mt-1">Profissionais são criados automaticamente ao se registrar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">Cor</TableHead>
                   <TableHead>Nome</TableHead>
                   <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                   <TableHead className="hidden sm:table-cell">Vínculo</TableHead>
                   <TableHead className="hidden sm:table-cell">Especialidade</TableHead>
                   <TableHead className="hidden md:table-cell">CREFITO</TableHead>
                   <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profissionais.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: p.cor_agenda || '#3b82f6' }} />
                    </TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={p.role === 'admin' ? 'default' : 'secondary'}>
                        {p.role === 'admin' ? <Shield className="h-3 w-3 mr-1 inline" /> : <UserCheck className="h-3 w-3 mr-1 inline" />}
                        {p.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(p as any).tipo_contratacao ? (
                        <Badge variant="outline" className="capitalize">
                          {(p as any).tipo_contratacao === 'pj' ? `PJ` : (p as any).tipo_contratacao}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.especialidade ? (
                        <Badge variant="outline" className="capitalize">
                          {p.especialidade}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {(p as any).registro_profissional || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" title="Gerar Contrato" onClick={() => {
                            const doc = generateProfessionalContractPDF({
                              profissionalNome: p.nome,
                              registroProfissional: (p as any).registro_profissional || "",
                              tipoContratacao: (p as any).tipo_contratacao || "autonomo",
                              cnpj: (p as any).cnpj || "",
                              commissionRate: p.commission_rate || 0,
                            });
                            doc.save(`contrato-profissional-${p.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
                            toast({ title: "Contrato gerado!", description: "O PDF do contrato foi baixado." });
                          }}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="mt-12 space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Gestão de Usuários</h2>
            <p className="text-muted-foreground text-sm">Apenas administradores podem ver esta seção</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center py-8 text-center space-y-4">
                <UserCog className="h-10 w-10 text-primary opacity-80" />
                <div>
                  <h3 className="font-semibold">Gerenciar Acessos Internos</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Para criar um novo Profissional ou Gestor, peça que ele se cadastre normalmente como Paciente e depois utilize a ferramenta abaixo para elevar o cargo dele.
                  </p>
                </div>
                <div className="flex gap-4">
                  <UserRoleManager />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Especialidade / Tipo de Atendimento</Label>
              <Select value={especialidade || "none"} onValueChange={(val) => setEspecialidade(val === "none" ? null : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione uma opção</SelectItem>
                  <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="pilates">Pilates</SelectItem>
                  <SelectItem value="rpg">RPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input type="number" step="0.01" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Valor Fixo (R$)</Label>
                <Input type="number" step="0.01" value={commissionFixed} onChange={(e) => setCommissionFixed(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Contratação</Label>
              <Select value={tipoContratacao || "none"} onValueChange={(val) => setTipoContratacao(val === "none" ? null : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione uma opção</SelectItem>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                  <SelectItem value="mei">MEI</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica (CNPJ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoContratacao === "pj" && (
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Registro Profissional (CREFITO)</Label>
              <Input value={registroProfissional} onChange={(e) => setRegistroProfissional(e.target.value)} placeholder="Ex: CREFITO-3/12345-F" />
            </div>
            <div className="space-y-2">
              <Label>Cor na Agenda</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={corAgenda}
                  onChange={(e) => setCorAgenda(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-sm text-muted-foreground">{corAgenda}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={loading || !nome.trim()}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profissionais;
