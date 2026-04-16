import { useState, useMemo, useCallback } from "react";
import DisponibilidadeProfissional from "./DisponibilidadeProfissional";
import { FormacoesManager } from "@/components/profissionais/FormacoesManager";
import { ProfessionalForm } from "@/components/profissionais/ProfessionalForm";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useProfissionais } from "@/modules/shared/hooks/useProfissionais";
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
import { ImageUpload } from "@/components/ui/image-upload";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { maskPhone, maskCPF, maskRG, maskCEP, isValidCPF, unmask } from "@/lib/masks";
import { ALL_RESOURCES, DEFAULT_PERMISSIONS } from "@/lib/resources";
import { generateProfessionalContractPDF } from "@/lib/generateProfessionalContractPDF";
import { cleanSignatureImage } from "@/lib/imageUtils";
import { Loader2, Sparkles } from "lucide-react";
import { CouncilCombobox } from "@/components/ui/council-combobox";
import { toast } from "sonner";

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
  conselho_profissional?: string | null;
  registro_conselho?: string | null;
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

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { profissionais: users, isLoading } = useProfissionais();


  const filtered = useMemo(() => users.filter(u => {
    const matchSearch = u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  }), [users, searchTerm, filterRole]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setIsCreating(false);
  }, []);

  const openCreate = () => {
    resetForm();
    setIsCreating(true);
    setDialogOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    resetForm();
    setEditingId(u.id);
    setDialogOpen(true);
  };

  const openPermissions = (u: UserRecord) => {
    setPermUserId(u.user_id);
    setPermUserName(u.nome);
    setPermChecked([...u.permissions]);
    setPermDialogOpen(true);
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

  const validateCpf = async (cpf: string, currentUserId?: string): Promise<boolean> => {
    const rawCpf = unmask(cpf);
    if (rawCpf.length > 0) {
      if (!isValidCPF(rawCpf)) {
        toast.error("CPF inválido", { description: "O CPF informado não é válido. Verifique os dígitos." });
        return false;
      }
      const { data: existing } = await supabase.from("profiles").select("id, nome").eq("cpf", cpf);
      const duplicates = (existing ?? []).filter(p => !currentUserId || p.id !== currentUserId);
      if (duplicates.length > 0) {
        toast.error("CPF já cadastrado", { description: `Este CPF já pertence a: ${duplicates[0].nome}` });
        return false;
      }
    }
    return true;
  };

  const handleFormSubmit = async (data: any) => {
    if (isCreating) {
      if (!data.nome.trim() || !data.createEmail.trim() || !data.createPassword.trim()) {
        toast.error("Erro", { description: "Preencha todos os campos obrigatórios" });
        return;
      }
      if (data.createPassword !== data.createPasswordConfirm) {
        toast.error("Erro", { description: "As senhas não coincidem" });
        return;
      }
      if (!(await validateCpf(data.cpf))) return;
      setLoading(true);
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("create-professional", {
          body: {
            ...data,
            email: data.createEmail.trim(),
            password: data.createPassword.trim(),
            nome: data.nome.trim(),
            commission_rate: parseFloat(data.commission_rate) || 0,
            commission_fixed: parseFloat(data.commission_fixed) || 0,
            permissions: data.role === "admin" ? [] : toPermEntries(DEFAULT_PERMISSIONS[data.role] || []),
            clinic_id: activeClinicId || null,
          }
        });
        if (fnError) throw new Error(result?.error || fnError.message || "Erro ao criar usuário");
        toast.success("Usuário criado com sucesso!");
        await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
        setDialogOpen(false);
      } catch (error: any) {
        toast.error("Erro", { description: error.message });
      } finally {
        setLoading(false);
      }
    } else {
      if (!editingId || !data.nome.trim()) return;
      if (!(await validateCpf(data.cpf, editingId))) return;
      setLoading(true);
      try {
        const editedUser = users.find(u => u.id === editingId);
        if (!editedUser) throw new Error("Usuário não encontrado");

        const { error } = await supabase
          .from("profiles")
          .update({
            nome: data.nome.trim(), email: data.email || null, telefone: data.telefone || null,
            especialidade: data.especialidade, commission_rate: parseFloat(data.commission_rate) || 0,
            commission_fixed: parseFloat(data.commission_fixed) || 0,
            cor_agenda: data.cor_agenda, registro_profissional: data.registro_profissional || null,
            tipo_contratacao: data.tipo_contratacao || null,
            cnpj: data.cnpj || null, cpf: data.cpf || null, rg: data.rg || null,
            data_nascimento: data.data_nascimento || null, estado_civil: data.estado_civil || null,
            endereco: data.endereco || null, numero: data.numero || null,
            bairro: data.bairro || null, cidade: data.cidade || null,
            estado: data.estado || null, cep: data.cep || null,
            assinatura_url: data.assinatura_url || null,
            rubrica_url: data.rubrica_url || null,
            conselho_profissional: data.conselho_profissional || null,
            registro_conselho: data.registro_conselho || null,
            foto_url: data.foto_url || null,
          } as any)
          .eq("id", editingId);
        if (error) throw error;

        if (data.role !== editedUser.role) {
          await supabase.from("user_roles").delete().eq("user_id", editedUser.user_id);
          await supabase.from("user_roles").insert({ user_id: editedUser.user_id, role: data.role as any });
        }

        toast.success("Dados atualizados!");
        await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
        setDialogOpen(false);
      } catch (error: any) {
        toast.error("Erro", { description: error.message });
      } finally {
        setLoading(false);
      }
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
      toast.success("Permissões atualizadas!");
      await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setPermDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro", { description: error.message });
    } finally {
      setLoading(false);
    }
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
        <TabsList className="grid w-full grid-cols-1 lg:w-[200px]">
          <TabsTrigger value="equipe">Membros</TabsTrigger>
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
                      <div 
                        className="w-5 h-5 rounded-full border" 
                        {...{ style: { backgroundColor: u.cor_agenda || '#3b82f6' } }}
                        title={`Cor: ${u.cor_agenda || '#3b82f6'}`}
                      />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Novo Membro" : "Editar Membro"}</DialogTitle>
            <DialogDescription>
              {isCreating ? "Cadastre um novo membro da equipe" : "Atualize os dados do membro"}
            </DialogDescription>
          </DialogHeader>
          <ProfessionalForm 
            isCreating={isCreating}
            initialData={editingId ? users.find(u => u.id === editingId) : null}
            onSubmit={handleFormSubmit}
            loading={loading}
          />
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

      </Tabs>
    </div>
  );
};

export default Profissionais;
