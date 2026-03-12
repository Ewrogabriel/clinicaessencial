import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Eye, UserPlus, Search } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";
import { format } from "date-fns";

const PreCadastrosAdmin = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const { data: preCadastros = [], isLoading } = useQuery({
    queryKey: ["pre-cadastros"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("pre_cadastros") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("pre_cadastros") as any)
        .update({ status, revisado_por: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pre-cadastros"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const approveAndCreate = async (preCadastro: any) => {
    if (!user) return;
    try {
      // Generate access code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const { data: newPatient, error } = await (supabase.from("pacientes") as any).insert({
        nome: preCadastro.nome,
        cpf: preCadastro.cpf || null,
        rg: preCadastro.rg || null,
        telefone: preCadastro.telefone,
        email: preCadastro.email || null,
        data_nascimento: preCadastro.data_nascimento || null,
        cep: preCadastro.cep || null,
        rua: preCadastro.rua || null,
        numero: preCadastro.numero || null,
        complemento: preCadastro.complemento || null,
        bairro: preCadastro.bairro || null,
        cidade: preCadastro.cidade || null,
        estado: preCadastro.estado || null,
        tipo_atendimento: preCadastro.tipo_atendimento || "fisioterapia",
        observacoes: preCadastro.observacoes || null,
        tem_responsavel_legal: preCadastro.tem_responsavel_legal || false,
        responsavel_nome: preCadastro.responsavel_nome || null,
        responsavel_cpf: preCadastro.responsavel_cpf || null,
        responsavel_telefone: preCadastro.responsavel_telefone || null,
        responsavel_email: preCadastro.responsavel_email || null,
        responsavel_parentesco: preCadastro.responsavel_parentesco || null,
        created_by: user.id,
        profissional_id: user.id,
        codigo_acesso: code,
        clinic_id: activeClinicId,
      }).select().single();
      if (error) throw error;

      // Link patient to clinic
      if (activeClinicId && newPatient?.id) {
        await supabase.from("clinic_pacientes").insert({
          clinic_id: activeClinicId,
          paciente_id: newPatient.id,
        });
      }

      await (supabase.from("pre_cadastros") as any)
        .update({ status: "aprovado", revisado_por: user.id })
        .eq("id", preCadastro.id);

      queryClient.invalidateQueries({ queryKey: ["pre-cadastros"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setDetailOpen(false);
      toast({ title: "Paciente cadastrado com sucesso!", description: `Código de acesso: ${code}` });
    } catch (err: any) {
      toast({ title: "Erro ao criar paciente", description: err.message, variant: "destructive" });
    }
  };

  const filtered = preCadastros.filter((p: any) =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.telefone?.includes(search)
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "pendente": return <Badge variant="secondary">Pendente</Badge>;
      case "aprovado": return <Badge className="bg-emerald-100 text-emerald-700">Aprovado</Badge>;
      case "rejeitado": return <Badge variant="destructive">Rejeitado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Pré-Cadastros</h1>
        <p className="text-muted-foreground">Revise e aprove os pré-cadastros recebidos</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pré-cadastro encontrado</TableCell></TableRow>
              ) : (
                filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.telefone}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                          <Eye className="h-3 w-3 mr-1" /> Ver
                        </Button>
                        {p.status === "pendente" && (
                          <>
                            <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => updateStatus.mutate({ id: p.id, status: "rejeitado" })}>
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Pré-Cadastro</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-muted-foreground">Nome</Label><p className="font-medium">{selected.nome}</p></div>
                <div><Label className="text-muted-foreground">Telefone</Label><p className="font-medium">{selected.telefone}</p></div>
                <div><Label className="text-muted-foreground">CPF</Label><p>{selected.cpf || "—"}</p></div>
                <div><Label className="text-muted-foreground">RG</Label><p>{selected.rg || "—"}</p></div>
                <div><Label className="text-muted-foreground">E-mail</Label><p>{selected.email || "—"}</p></div>
                <div><Label className="text-muted-foreground">Nascimento</Label><p>{selected.data_nascimento || "—"}</p></div>
                {selected.cep && <div className="col-span-2"><Label className="text-muted-foreground">Endereço</Label><p>{[selected.rua, selected.numero, selected.bairro, selected.cidade, selected.estado].filter(Boolean).join(", ")}</p></div>}
                {selected.observacoes && <div className="col-span-2"><Label className="text-muted-foreground">Observações</Label><p>{selected.observacoes}</p></div>}
                {selected.tem_responsavel_legal && (
                  <div className="col-span-2 border-t pt-3">
                    <Label className="text-muted-foreground font-semibold">Responsável Legal</Label>
                    <p>{selected.responsavel_nome} ({selected.responsavel_parentesco}) - {selected.responsavel_telefone}</p>
                  </div>
                )}
              </div>
              {selected.status === "pendente" && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button className="flex-1 gap-2" onClick={() => approveAndCreate(selected)}>
                    <UserPlus className="h-4 w-4" /> Aprovar e Cadastrar Paciente
                  </Button>
                  <Button variant="destructive" onClick={() => { updateStatus.mutate({ id: selected.id, status: "rejeitado" }); setDetailOpen(false); }}>
                    Rejeitar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreCadastrosAdmin;
