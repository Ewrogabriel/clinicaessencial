import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";

const PacienteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const isEditing = !!id;

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tipoAtendimento, setTipoAtendimento] = useState<Enums<"tipo_atendimento">>("fisioterapia");
  const [status, setStatus] = useState<Enums<"status_paciente">>("ativo");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (id) {
      setLoadingData(true);
      supabase
        .from("pacientes")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            toast({ title: "Paciente não encontrado", variant: "destructive" });
            navigate("/pacientes");
            return;
          }
          setNome(data.nome);
          setCpf(data.cpf || "");
          setTelefone(data.telefone);
          setEmail(data.email || "");
          setDataNascimento(data.data_nascimento || "");
          setEndereco(data.endereco || "");
          setTipoAtendimento(data.tipo_atendimento);
          setStatus(data.status);
          setObservacoes(data.observacoes || "");
          setLoadingData(false);
        });
    }
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const payload = {
      nome,
      cpf: cpf || null,
      telefone,
      email: email || null,
      data_nascimento: dataNascimento || null,
      endereco: endereco || null,
      tipo_atendimento: tipoAtendimento,
      status,
      observacoes: observacoes || null,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("pacientes").update(payload).eq("id", id));
    } else {
      ({ error } = await supabase.from("pacientes").insert({
        ...payload,
        created_by: user.id,
        profissional_id: user.id,
      }));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: isEditing ? "Paciente atualizado!" : "Paciente cadastrado!",
        description: `${nome} foi ${isEditing ? "atualizado(a)" : "cadastrado(a)"} com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      navigate("/pacientes");
    }

    setLoading(false);
  };

  if (loadingData) {
    return <p className="text-center py-12 text-muted-foreground animate-pulse">Carregando dados...</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
            {isEditing ? "Editar Paciente" : "Novo Paciente"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Atualize os dados do paciente" : "Preencha os dados do paciente"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
            <CardDescription>Informações básicas do paciente</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input id="nome" placeholder="Nome completo do paciente" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input id="data_nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
              <Input id="telefone" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço Completo</Label>
              <Input id="endereco" placeholder="Rua, número, bairro, cidade - UF" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Clínicos</CardTitle>
            <CardDescription>Informações sobre o atendimento</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Atendimento *</Label>
              <Select value={tipoAtendimento} onValueChange={(v) => setTipoAtendimento(v as Enums<"tipo_atendimento">)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="pilates">Pilates</SelectItem>
                  <SelectItem value="rpg">RPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Enums<"status_paciente">)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="observacoes">Observações Clínicas</Label>
              <Textarea id="observacoes" placeholder="Anotações sobre o paciente, histórico clínico, restrições..." rows={4} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/pacientes")}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : isEditing ? "Atualizar Paciente" : "Salvar Paciente"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
