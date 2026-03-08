import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Edit, Users, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/masks";
import { useNavigate } from "react-router-dom";

interface ClinicaForm {
  nome: string;
  cnpj: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  ativo: boolean;
}

const emptyForm: ClinicaForm = {
  nome: "", cnpj: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
  telefone: "", whatsapp: "", email: "", instagram: "", ativo: true,
};

const GestaoClinicas = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [form, setForm] = useState<ClinicaForm>(emptyForm);
  const [addUserId, setAddUserId] = useState("");

  const { data: clinicas = [], isLoading } = useQuery({
    queryKey: ["gestao-clinicas"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("clinicas") as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome, email").order("nome");
      return data || [];
    },
  });

  const { data: clinicUsers = [] } = useQuery({
    queryKey: ["clinic-users", selectedClinicId],
    queryFn: async () => {
      if (!selectedClinicId) return [];
      const { data } = await (supabase.from("clinic_users") as any)
        .select("id, user_id, role, created_at")
        .eq("clinic_id", selectedClinicId);
      return data || [];
    },
    enabled: !!selectedClinicId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ClinicaForm & { id?: string }) => {
      const { id, ...rest } = data;
      if (id) {
        const { error } = await (supabase.from("clinicas") as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("clinicas") as any).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestao-clinicas"] });
      queryClient.invalidateQueries({ queryKey: ["user-clinics"] });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Clínica atualizada!" : "Clínica criada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addUserMutation = useMutation({
    mutationFn: async ({ clinicId, userId }: { clinicId: string; userId: string }) => {
      const { error } = await (supabase.from("clinic_users") as any)
        .insert({ clinic_id: clinicId, user_id: userId, role: "member" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-users"] });
      setAddUserId("");
      toast({ title: "Usuário vinculado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("clinic_users") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-users"] });
      toast({ title: "Usuário desvinculado!" });
    },
  });

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome || "", cnpj: c.cnpj || "", endereco: c.endereco || "",
      numero: c.numero || "", bairro: c.bairro || "", cidade: c.cidade || "",
      estado: c.estado || "", cep: c.cep || "", telefone: c.telefone || "",
      whatsapp: c.whatsapp || "", email: c.email || "", instagram: c.instagram || "",
      ativo: c.ativo ?? true,
    });
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const linkedUserIds = new Set(clinicUsers.map((cu: any) => cu.user_id));
  const availableProfiles = allProfiles.filter((p: any) => !linkedUserIds.has(p.user_id));

  const getUserName = (userId: string) => {
    const p = allProfiles.find((pr: any) => pr.user_id === userId);
    return p ? `${p.nome} (${p.email})` : userId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans] flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> Gestão de Clínicas
            </h1>
            <p className="text-muted-foreground">Gerencie as unidades da sua rede</p>
          </div>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova Clínica
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : clinicas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma clínica cadastrada</TableCell></TableRow>
              ) : (
                clinicas.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.cnpj || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ""}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.ativo ? "default" : "secondary"}>
                        {c.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(c)}>
                          <Edit className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedClinicId(c.id); setUsersOpen(true); }}>
                          <Users className="h-3 w-3 mr-1" /> Equipe
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Clínica" : "Nova Clínica"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@clinica" />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Clínica ativa</Label>
              </div>
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate({ ...form, id: editingId || undefined })} disabled={saveMutation.isPending || !form.nome.trim()}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users Dialog */}
      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Equipe da Clínica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar profissional..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.nome} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!addUserId || !selectedClinicId || addUserMutation.isPending}
                onClick={() => addUserMutation.mutate({ clinicId: selectedClinicId!, userId: addUserId })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {clinicUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro vinculado</p>
              ) : (
                clinicUsers.map((cu: any) => (
                  <div key={cu.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <span className="text-sm">{getUserName(cu.user_id)}</span>
                    <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => removeUserMutation.mutate(cu.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestaoClinicas;
