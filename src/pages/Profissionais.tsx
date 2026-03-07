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
import { Pencil, UserCog, UserCheck, Shield, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import UserRoleManager from "@/components/profissionais/UserRoleManager";
import { generateProfessionalContractPDF } from "@/lib/generateProfessionalContractPDF";
import { maskPhone, maskCPF, maskRG, maskCEP } from "@/lib/masks";

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
  const [isCreating, setIsCreating] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ["profissionais"],
    queryFn: async () => {
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

      return (data as any[]).map(p => ({
        ...p,
        role: roleData?.find(r => r.user_id === p.user_id)?.role || 'profissional'
      })) as Profissional[];
    },
  });

  const openEdit = (p: Profissional) => {
    setIsCreating(false);
    setEditingId(p.id);
    setNome(p.nome);
    setEmail(p.email || "");
    setTelefone(p.telefone || "");
    setEspecialidade(p.especialidade || null);
    setCommissionRate(String(p.commission_rate || 0));
    setCommissionFixed(String(p.commission_fixed || 0));
    setCorAgenda(p.cor_agenda || "#3b82f6");
    setRegistroProfissional(p.registro_profissional || "");
    setTipoContratacao(p.tipo_contratacao || null);
    setCnpj(p.cnpj || "");
    setCpf(p.cpf || "");
    setRg(p.rg || "");
    setDataNascimento(p.data_nascimento || "");
    setEstadoCivil(p.estado_civil || null);
    setEndereco(p.endereco || "");
    setNumero(p.numero || "");
    setBairro(p.bairro || "");
    setCidade(p.cidade || "");
    setEstado(p.estado || "");
    setCep(p.cep || "");
    setDialogOpen(true);
  };

  const openCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setNome("");
    setEmail("");
    setCreateEmail("");
    setCreatePassword("");
    setCreatePasswordConfirm("");
    setTelefone("");
    setEspecialidade(null);
    setCommissionRate("0");
    setCommissionFixed("0");
    setCorAgenda("#3b82f6");
    setRegistroProfissional("");
    setTipoContratacao(null);
    setCnpj("");
    setCpf("");
    setRg("");
    setDataNascimento("");
    setEstadoCivil(null);
    setEndereco("");
    setNumero("");
    setBairro("");
    setCidade("");
    setEstado("");
    setCep("");
    setDialogOpen(true);
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
    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createEmail.trim(),
        password: createPassword.trim(),
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: authData.user.id,
          nome: nome.trim(),
          email: createEmail.trim(),
          telefone: telefone || null,
          especialidade: especialidade,
          commission_rate: parseFloat(commissionRate) || 0,
          commission_fixed: parseFloat(commissionFixed) || 0,
          cor_agenda: corAgenda,
          registro_profissional: registroProfissional || null,
          tipo_contratacao: tipoContratacao || null,
          cnpj: cnpj || null,
          cpf: cpf || null,
          rg: rg || null,
          data_nascimento: dataNascimento || null,
          estado_civil: estadoCivil || null,
          endereco: endereco || null,
          numero: numero || null,
          bairro: bairro || null,
          cidade: cidade || null,
          estado: estado || null,
          cep: cep || null,
        } as any);
      if (profileError) throw profileError;

      // Set user role as profissional
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "profissional",
        });
      if (roleError) throw roleError;

      toast({ title: "Profissional criado com sucesso!", description: "Um email de confirmação foi enviado." });
      await queryClient.invalidateQueries({ queryKey: ["profissionais"] });
      setDialogOpen(false);
      setNome("");
      setCreateEmail("");
      setCreatePassword("");
      setCreatePasswordConfirm("");
      setTelefone("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
          cpf: cpf || null,
          rg: rg || null,
          data_nascimento: dataNascimento || null,
          estado_civil: estadoCivil || null,
          endereco: endereco || null,
          numero: numero || null,
          bairro: bairro || null,
          cidade: cidade || null,
          estado: estado || null,
          cep: cep || null,
        } as any)
        .eq("id", editingId);
      if (error) throw error;
      toast({ title: "Profissional atualizado!" });
      await queryClient.invalidateQueries({ queryKey: ["profissionais"] });
      setDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContract = (p: Profissional) => {
    const doc = generateProfessionalContractPDF({
      profissionalNome: p.nome,
      registroProfissional: p.registro_profissional || "",
      tipoContratacao: p.tipo_contratacao || "autonomo",
      cnpj: p.cnpj || "",
      commissionRate: p.commission_rate || 0,
      cpf: p.cpf || "",
      rg: p.rg || "",
      endereco: p.endereco ? `${p.endereco}${p.numero ? `, nº ${p.numero}` : ""}${p.bairro ? ` – ${p.bairro}` : ""}${p.cidade ? ` – ${p.cidade}` : ""}${p.estado ? `/${p.estado}` : ""}` : "",
      estadoCivil: p.estado_civil || "",
      telefone: p.telefone || "",
    });
    doc.save(`contrato-profissional-${p.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast({ title: "Contrato gerado!", description: "O PDF do contrato foi baixado." });
  };

  const fetchAddressFor = async (cepCode: string) => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }
      setEndereco(data.logradouro || "");
      setBairro(data.bairro || "");
      setCidade(data.localidade || "");
      setEstado(data.uf || "");
    } catch (err) {
      console.error("Erro ao buscar CEP", err);
      toast({ title: "Erro ao buscar endereço", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Profissionais</h1>
        <p className="text-muted-foreground">Visualize e edite os dados dos profissionais</p>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Profissional
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
          ) : profissionais.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <UserCog className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum profissional cadastrado</p>
              <p className="text-sm mt-1">{canManage ? "Clique em 'Novo Profissional' para criar um" : "Aguarde a criação de profissionais"}</p>
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
                      {p.tipo_contratacao ? (
                        <Badge variant="outline" className="capitalize">
                          {p.tipo_contratacao === 'pj' ? 'PJ' : p.tipo_contratacao}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.especialidade ? (
                        <Badge variant="outline" className="capitalize">{p.especialidade}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {p.registro_profissional || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" title="Gerar Contrato" onClick={() => handleGenerateContract(p)}>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Novo Profissional" : "Editar Profissional"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {isCreating && (
                <>
                  <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Autenticação</h4>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Senha *</Label>
                      <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Senha *</Label>
                      <Input type="password" value={createPasswordConfirm} onChange={(e) => setCreatePasswordConfirm(e.target.value)} placeholder="••••••••" />
                    </div>
                  </div>
                </>
              )}
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Dados Pessoais</h4>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={rg} onChange={(e) => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado Civil</Label>
                  <Select value={estadoCivil || "none"} onValueChange={(v) => setEstadoCivil(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione</SelectItem>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      <SelectItem value="uniao_estavel">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                </div>
              </div>

              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Endereço</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Endereço</Label>
                  <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua / Avenida" />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="UF" maxLength={2} />
                </div>
              </div>
              <div className="space-y-2 max-w-[200px]">
                <Label>CEP</Label>
                <Input value={cep} onChange={(e) => { const v = maskCEP(e.target.value); setCep(v); fetchAddressFor(v); }} placeholder="00000-000" />
              </div>

              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Dados Profissionais</h4>
              <div className="space-y-2">
                <Label>Especialidade / Tipo de Atendimento</Label>
                <Select value={especialidade || "none"} onValueChange={(val) => setEspecialidade(val === "none" ? null : val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a especialidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione uma opção</SelectItem>
                    <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                    <SelectItem value="pilates">Pilates</SelectItem>
                    <SelectItem value="rpg">RPG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registro Profissional (CREFITO)</Label>
                <Input value={registroProfissional} onChange={(e) => setRegistroProfissional(e.target.value)} placeholder="Ex: CREFITO-3/12345-F" />
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

              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Contrato</h4>
              <div className="space-y-2">
                <Label>Tipo de Contratação</Label>
                <Select value={tipoContratacao || "none"} onValueChange={(val) => setTipoContratacao(val === "none" ? null : val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o vínculo" /></SelectTrigger>
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
                <Label>Cor na Agenda</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={corAgenda} onChange={(e) => setCorAgenda(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                  <span className="text-sm text-muted-foreground">{corAgenda}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={isCreating ? handleCreate : handleSave} 
                  disabled={loading || !nome.trim() || (isCreating && (!createEmail.trim() || !createPassword.trim()))}
                >
                  {loading ? (isCreating ? "Criando..." : "Salvando...") : (isCreating ? "Criar Profissional" : "Salvar")}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profissionais;
