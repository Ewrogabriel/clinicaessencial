import { useState } from "react";
import DisponibilidadeProfissional from "./DisponibilidadeProfissional";
import { CommissionRules } from "@/components/profissionais/CommissionRules";
import { FormacoesManager } from "@/components/profissionais/FormacoesManager";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, Shield, UserCheck, Search, KeyRound, Eye, PenLine, Calculator, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { maskPhone, maskCPF, maskRG, maskCEP, isValidCPF, unmask } from "@/lib/masks";
import { ALL_RESOURCES, DEFAULT_PERMISSIONS } from "@/lib/resources";
import { generateProfessionalContractPDF } from "@/lib/generateProfessionalContractPDF";

interface PermissionEntry {
  resource: string;
  access_level: "view" | "edit";
}

interface UserRecord {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  role: string;
  especialidade?: string | null;
  commission_rate?: number;
  commission_fixed?: number;
  cor_agenda?: string | null;
  tipo_contratacao?: string | null;
  cnpj?: string | null;
  registro_profissional?: string | null;
  cpf?: string | null;
  rg?: string | null;
  data_nascimento?: string | null;
  estado_civil?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  permissions: PermissionEntry[];
}

const toPermEntries = (keys: string[], level: "view" | "edit" = "edit"): PermissionEntry[] =>
  keys.map(k => ({ resource: k, access_level: level }));

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  profissional: "Profissional",
  secretario: "Secretário(a)",
  gestor: "Gestor",
  paciente: "Paciente",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "default",
  gestor: "default",
  profissional: "secondary",
  secretario: "outline",
  paciente: "outline",
};

const ACCESS_LABELS = { view: "Visualizar", edit: "Editar" };

const Profissionais = () => {
  const { user, isAdmin, isGestor } = useAuth();
  const { activeClinicId } = useClinic();
  const canManage = isAdmin || isGestor;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [permUserName, setPermUserName] = useState("");
  const [permChecked, setPermChecked] = useState<PermissionEntry[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
  const [selectedRole, setSelectedRole] = useState("profissional");
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionEntry[]>([]);
  const [especialidade, setEspecialidade] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState("0");
  const [commissionFixed, setCommissionFixed] = useState("0");
  const [corAgenda, setCorAgenda] = useState("#3b82f6");
  const [registroProfissional, setRegistroProfissional] = useState("");
  const [tipoContratacao, setTipoContratacao] = useState<string | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [estadoCivil, setEstadoCivil] = useState<string | null>(null);
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["staff-users", activeClinicId],
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const staffRoles = roleData?.filter(r => r.role !== "paciente") ?? [];
      let userIds = [...new Set(staffRoles.map(r => r.user_id))];
      if (userIds.length === 0) return [];

      // Filter by active clinic
      if (activeClinicId) {
        const { data: clinicUsers } = await supabase.from("clinic_users")
          .select("user_id")
          .eq("clinic_id", activeClinicId);
        const clinicUserIds = new Set(clinicUsers?.map((cu) => cu.user_id) ?? []);
        userIds = userIds.filter(id => clinicUserIds.has(id));
        if (userIds.length === 0) return [];
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
        .order("nome");

      const { data: permsData } = await supabase
        .from("user_permissions")
        .select("*")
        .in("user_id", userIds)
        .eq("enabled", true);

      return (profiles ?? []).map(p => ({
        ...p,
        role: staffRoles.find(r => r.user_id === p.user_id)?.role || "profissional",
        permissions: (permsData ?? [])
          .filter((perm) => perm.user_id === p.user_id)
          .map((perm) => ({
            resource: perm.resource,
            access_level: (perm.access_level || "edit") as "view" | "edit",
          })),
      })) as UserRecord[];
    },
  });

  const filtered = users.filter(u => {
    const matchSearch = u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const resetForm = () => {
    setEditingId(null);
    setIsCreating(false);
    setNome(""); setEmail(""); setTelefone("");
    setCreateEmail(""); setCreatePassword(""); setCreatePasswordConfirm("");
    setSelectedRole("profissional");
    setSelectedPermissions(toPermEntries(DEFAULT_PERMISSIONS.profissional || []));
    setEspecialidade(null); setCommissionRate("0"); setCommissionFixed("0");
    setCorAgenda("#3b82f6"); setRegistroProfissional("");
    setTipoContratacao(null); setCnpj(""); setCpf(""); setRg("");
    setDataNascimento(""); setEstadoCivil(null);
    setEndereco(""); setNumero(""); setBairro(""); setCidade(""); setEstado(""); setCep("");
  };

  const openCreate = () => {
    resetForm();
    setIsCreating(true);
    setSelectedPermissions(toPermEntries(DEFAULT_PERMISSIONS.profissional || []));
    setDialogOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    resetForm();
    setEditingId(u.id);
    setNome(u.nome); setEmail(u.email || ""); setTelefone(u.telefone || "");
    setSelectedRole(u.role);
    setEspecialidade(u.especialidade || null);
    setCommissionRate(String(u.commission_rate || 0));
    setCommissionFixed(String(u.commission_fixed || 0));
    setCorAgenda(u.cor_agenda || "#3b82f6");
    setRegistroProfissional(u.registro_profissional || "");
    setTipoContratacao(u.tipo_contratacao || null);
    setCnpj(u.cnpj || ""); setCpf(u.cpf || ""); setRg(u.rg || "");
    setDataNascimento(u.data_nascimento || ""); setEstadoCivil(u.estado_civil || null);
    setEndereco(u.endereco || ""); setNumero(u.numero || "");
    setBairro(u.bairro || ""); setCidade(u.cidade || "");
    setEstado(u.estado || ""); setCep(u.cep || "");
    setDialogOpen(true);
  };

  const openPermissions = (u: UserRecord) => {
    setPermUserId(u.user_id);
    setPermUserName(u.nome);
    setPermChecked([...u.permissions]);
    setPermDialogOpen(true);
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    if (role === "admin") {
      setSelectedPermissions(toPermEntries(ALL_RESOURCES.map(r => r.key)));
    } else {
      setSelectedPermissions(toPermEntries(DEFAULT_PERMISSIONS[role] || []));
    }
  };

  // Permission helpers for PermissionEntry[]
  const findPerm = (list: PermissionEntry[], key: string) => list.find(p => p.resource === key);
  const hasPerm = (list: PermissionEntry[], key: string) => !!findPerm(list, key);
  const getAccessLevel = (list: PermissionEntry[], key: string) => findPerm(list, key)?.access_level || "edit";

  const togglePermEntry = (
    setter: React.Dispatch<React.SetStateAction<PermissionEntry[]>>,
    key: string
  ) => {
    setter(prev => {
      if (hasPerm(prev, key)) {
        return prev.filter(p => p.resource !== key);
      }
      return [...prev, { resource: key, access_level: "edit" as const }];
    });
  };

  const setPermAccessLevel = (
    setter: React.Dispatch<React.SetStateAction<PermissionEntry[]>>,
    key: string,
    level: "view" | "edit"
  ) => {
    setter(prev => prev.map(p => p.resource === key ? { ...p, access_level: level } : p));
  };

  const validateCpf = async (currentUserId?: string): Promise<boolean> => {
    const rawCpf = unmask(cpf);
    if (rawCpf.length > 0) {
      if (!isValidCPF(rawCpf)) {
        toast({ title: "CPF inválido", description: "O CPF informado não é válido. Verifique os dígitos.", variant: "destructive" });
        return false;
      }
      // Check duplicate in profiles
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("cpf", cpf);
      const duplicates = (existing ?? []).filter(p => !currentUserId || p.id !== currentUserId);
      if (duplicates.length > 0) {
        toast({ title: "CPF já cadastrado", description: `Este CPF já pertence a: ${duplicates[0].nome}`, variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleCreate = async () => {
    if (!nome.trim() || !createEmail.trim() || !createPassword.trim()) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (createPassword !== createPasswordConfirm) {
      toast({ title: "Erro", description: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (!(await validateCpf())) return;
    setLoading(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("create-professional", {
        body: {
          email: createEmail.trim(),
          password: createPassword.trim(),
          nome: nome.trim(),
          telefone: telefone || null,
          especialidade,
          commission_rate: parseFloat(commissionRate) || 0,
          commission_fixed: parseFloat(commissionFixed) || 0,
          cor_agenda: corAgenda,
          registro_profissional: registroProfissional || null,
          tipo_contratacao: tipoContratacao || null,
          cnpj: cnpj || null, cpf: cpf || null, rg: rg || null,
          data_nascimento: dataNascimento || null,
          estado_civil: estadoCivil || null,
          endereco: endereco || null, numero: numero || null,
          bairro: bairro || null, cidade: cidade || null,
          estado: estado || null, cep: cep || null,
          role: selectedRole,
          permissions: selectedRole === "admin" ? [] : selectedPermissions,
        },
      });

      if (fnError) {
        const errorMsg = result?.error || fnError.message || "Erro ao criar usuário";
        throw new Error(errorMsg);
      }
      if (result?.error) throw new Error(result.error);

      toast({ title: "Usuário criado com sucesso!" });
      await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingId || !nome.trim()) return;
    if (!(await validateCpf(editingId))) return;
    setLoading(true);
    try {
      const editedUser = users.find(u => u.id === editingId);
      if (!editedUser) throw new Error("Usuário não encontrado");

      const { error } = await supabase
        .from("profiles")
        .update({
          nome: nome.trim(), email: email || null, telefone: telefone || null,
          especialidade, commission_rate: parseFloat(commissionRate) || 0,
          commission_fixed: parseFloat(commissionFixed) || 0,
          cor_agenda: corAgenda, registro_profissional: registroProfissional || null,
          tipo_contratacao: tipoContratacao || null,
          cnpj: cnpj || null, cpf: cpf || null, rg: rg || null,
          data_nascimento: dataNascimento || null, estado_civil: estadoCivil || null,
          endereco: endereco || null, numero: numero || null,
          bairro: bairro || null, cidade: cidade || null,
          estado: estado || null, cep: cep || null,
        } as any)
        .eq("id", editingId);
      if (error) throw error;

      if (selectedRole !== editedUser.role) {
        await supabase.from("user_roles").delete().eq("user_id", editedUser.user_id);
        await supabase.from("user_roles").insert({ user_id: editedUser.user_id, role: selectedRole as any });
      }

      toast({ title: "Dados atualizados!" });
      await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permUserId) return;
    setLoading(true);
    try {
      await supabase.from("user_permissions").delete().eq("user_id", permUserId);
      if (permChecked.length > 0) {
        const rows = permChecked.map(p => ({
          user_id: permUserId,
          resource: p.resource,
          access_level: p.access_level,
          enabled: true,
        }));
        const { error } = await supabase.from("user_permissions").insert(rows as any);
        if (error) throw error;
      }
      toast({ title: "Permissões atualizadas!" });
      await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setPermDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAddressFor = async (cepCode: string) => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setEndereco(data.logradouro || ""); setBairro(data.bairro || "");
      setCidade(data.localidade || ""); setEstado(data.uf || "");
    } catch {}
  };

  // Render permission row with view/edit toggle
  const renderPermissionRow = (
    r: { key: string; label: string; description: string },
    list: PermissionEntry[],
    setter: React.Dispatch<React.SetStateAction<PermissionEntry[]>>,
    disabled = false
  ) => {
    const enabled = disabled || hasPerm(list, r.key);
    const level = getAccessLevel(list, r.key);

    return (
      <div key={r.key} className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 border-b last:border-b-0">
        <div className="flex items-start gap-2 flex-1">
          <Checkbox
            checked={enabled}
            disabled={disabled}
            onCheckedChange={() => togglePermEntry(setter, r.key)}
          />
          <div>
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-xs text-muted-foreground">{r.description}</div>
          </div>
        </div>
        {enabled && !disabled && (
          <div className="flex items-center gap-1 ml-2">
            <Button
              type="button"
              variant={level === "view" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setPermAccessLevel(setter, r.key, "view")}
            >
              <Eye className="h-3 w-3" /> Visualizar
            </Button>
            <Button
              type="button"
              variant={level === "edit" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setPermAccessLevel(setter, r.key, "edit")}
            >
              <PenLine className="h-3 w-3" /> Editar
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Equipe</h1>
        <p className="text-muted-foreground">Cadastre, configure acessos, disponibilidade e comissões dos profissionais</p>
      </div>

      <Tabs defaultValue="equipe" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="equipe">Membros</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-2">
            <Calculator className="h-4 w-4" /> Regras de Comissão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipe" className="space-y-4">

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="gestor">Gestor</SelectItem>
            <SelectItem value="profissional">Profissional</SelectItem>
            <SelectItem value="secretario">Secretário(a)</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Membro
          </Button>
        )}
      </div>

      {/* List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum membro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Permissões</TableHead>
                  <TableHead className="hidden sm:table-cell">Contato</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: u.cor_agenda || '#3b82f6' }} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{u.nome}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_COLORS[u.role] as any || "outline"}>
                        {u.role === "admin" && <Shield className="h-3 w-3 mr-1 inline" />}
                        {u.role === "profissional" && <UserCheck className="h-3 w-3 mr-1 inline" />}
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.role === "admin" ? (
                        <span className="text-xs text-muted-foreground">Acesso total</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.permissions.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {u.permissions.length} recursos
                              {" "}({u.permissions.filter(p => p.access_level === "edit").length} editar, {u.permissions.filter(p => p.access_level === "view").length} visualizar)
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Nenhum configurado</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {u.telefone || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {u.role !== "admin" && (
                              <Button variant="ghost" size="icon" onClick={() => openPermissions(u)} title="Permissões">
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            )}
                          </>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Novo Membro" : "Editar Membro"}</DialogTitle>
            <DialogDescription>
              {isCreating ? "Cadastre um novo membro da equipe" : "Atualize os dados do membro"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className={`grid w-full mb-4 ${isCreating ? 'grid-cols-5' : 'grid-cols-4'}`}>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="profissional">Profissional</TabsTrigger>
                <TabsTrigger value="formacoes" className="gap-1">
                  <GraduationCap className="h-3 w-3" /> Formações
                </TabsTrigger>
                {isCreating && <TabsTrigger value="acesso">Acesso</TabsTrigger>}
              </TabsList>

              <TabsContent value="dados" className="space-y-4">
                {isCreating && (
                  <>
                    <div className="space-y-2">
                      <Label>Cargo *</Label>
                      <Select value={selectedRole} onValueChange={handleRoleChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="profissional">Profissional</SelectItem>
                          <SelectItem value="secretario">Secretário(a)</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Email de login *</Label>
                      <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Senha *</Label>
                        <Input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="••••••••" />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar Senha *</Label>
                        <Input type="password" value={createPasswordConfirm} onChange={e => setCreatePasswordConfirm(e.target.value)} placeholder="••••••••" />
                      </div>
                    </div>
                  </>
                )}
                {!isCreating && (
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="secretario">Secretário(a)</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input value={rg} onChange={e => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                {!isCreating && (
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="endereco" className="space-y-4">
                <div className="space-y-2 max-w-[200px]">
                  <Label>CEP</Label>
                  <Input value={cep} onChange={e => { const v = maskCEP(e.target.value); setCep(v); fetchAddressFor(v); }} placeholder="00000-000" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Endereço</Label>
                    <Input value={endereco} onChange={e => setEndereco(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input value={numero} onChange={e => setNumero(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Bairro</Label><Input value={bairro} onChange={e => setBairro(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Cidade</Label><Input value={cidade} onChange={e => setCidade(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Estado</Label><Input value={estado} onChange={e => setEstado(e.target.value)} maxLength={2} /></div>
                </div>
              </TabsContent>

              <TabsContent value="profissional" className="space-y-4">
                <div className="space-y-2">
                  <Label>Especialidade</Label>
                  <Select value={especialidade || "none"} onValueChange={v => setEspecialidade(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                      <SelectItem value="pilates">Pilates</SelectItem>
                      <SelectItem value="rpg">RPG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Registro Profissional (CREFITO)</Label>
                  <Input value={registroProfissional} onChange={e => setRegistroProfissional(e.target.value)} placeholder="Ex: CREFITO-3/12345-F" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input type="number" step="0.01" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Fixo (R$)</Label>
                    <Input type="number" step="0.01" value={commissionFixed} onChange={e => setCommissionFixed(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Contratação</Label>
                  <Select value={tipoContratacao || "none"} onValueChange={v => setTipoContratacao(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="autonomo">Autônomo</SelectItem>
                      <SelectItem value="mei">MEI</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tipoContratacao === "pj" && (
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Cor na Agenda</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={corAgenda} onChange={e => setCorAgenda(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                    <span className="text-sm text-muted-foreground">{corAgenda}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="formacoes" className="space-y-4">
                {editingId ? (
                  <FormacoesManager 
                    profissionalId={users.find(u => u.id === editingId)?.user_id || ""} 
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve o cadastro primeiro para adicionar formações</p>
                  </div>
                )}
              </TabsContent>

              {isCreating && (
                <TabsContent value="acesso" className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-1">Recursos disponíveis</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      {selectedRole === "admin"
                        ? "Administradores têm acesso total a todos os recursos."
                        : "Selecione quais recursos e o nível de acesso (visualizar ou editar)."}
                    </p>
                    <div className="space-y-0.5">
                      {ALL_RESOURCES.map(r =>
                        renderPermissionRow(r, selectedPermissions, setSelectedPermissions, selectedRole === "admin")
                      )}
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={isCreating ? handleCreate : handleSave} disabled={loading || !nome.trim()}>
                {loading ? "Salvando..." : isCreating ? "Criar Membro" : "Salvar"}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Permissões — {permUserName}
            </DialogTitle>
            <DialogDescription>Configure quais recursos e o nível de acesso (visualizar ou editar)</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-2">
            <div className="space-y-0.5">
              {ALL_RESOURCES.map(r => renderPermissionRow(r, permChecked, setPermChecked))}
            </div>
          </ScrollArea>
          <div className="flex justify-between pt-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPermChecked(toPermEntries(ALL_RESOURCES.map(r => r.key)))}>
                Marcar todos (editar)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPermChecked(toPermEntries(ALL_RESOURCES.map(r => r.key), "view"))}>
                Marcar todos (visualizar)
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPermDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSavePermissions} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Permissões"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="disponibilidade">
          <DisponibilidadeProfissional />
        </TabsContent>

        <TabsContent value="comissoes">
          <CommissionRules />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profissionais;
