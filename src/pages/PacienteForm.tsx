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
import { ArrowLeft, Link as LinkIcon, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";

const PacienteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const isEditing = !!id;

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  
  // Separated address fields
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

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
          setTelefone(data.telefone || "");
          setEmail(data.email || "");
          setDataNascimento(data.data_nascimento || "");
          setCep((data as any).cep || "");
          setRua((data as any).rua || "");
          setNumero((data as any).numero || "");
          setComplemento((data as any).complemento || "");
          setBairro((data as any).bairro || "");
          setCidade((data as any).cidade || "");
          setEstado((data as any).estado || "");
          setTipoAtendimento(data.tipo_atendimento);
          setStatus(data.status);
          setObservacoes(data.observacoes || "");
          setLoadingData(false);
        });
    }
  }, [id, navigate]);

  const fetchAddress = async (cepCode: string) => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
      }
    } catch (err) {
      console.error("Erro ao buscar CEP", err);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = e.target.value;
    setCep(newCep);
    fetchAddress(newCep);
  };

  const generateInviteLink = () => {
    if (!id) return;
    const link = `${window.location.origin}/onboarding/${id}`;
    const text = `Olá ${nome.split(' ')[0]}! Complete seu cadastro no Essencial FisioPilates através deste link: ${link}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ 
        title: "Link Copiado! 🔗", 
        description: "Enviaremos o link pelo WhatsApp para o paciente." 
      });
    }).catch(() => {
        toast({ title: "Erro ao copiar o link.", variant: "destructive" });
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const payload = {
      nome,
      cpf: cpf || null,
      telefone: telefone || null,
      email: email || null,
      data_nascimento: dataNascimento || null,
      cep: cep || null,
      rua: rua || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      tipo_atendimento: tipoAtendimento,
      status,
      observacoes: observacoes || null,
    };

    let error;
    let savedPatientId = id;

    if (isEditing) {
      ({ error } = await supabase.from("pacientes").update(payload).eq("id", id));
    } else {
      const insertData = {
        ...payload,
        created_by: user.id,
        profissional_id: user.id,
      };
      
      if (clinicId) {
        Object.assign(insertData, { clinic_id: clinicId });
      }

      const { data, error: insertError } = await supabase.from("pacientes").insert(insertData).select("id").single();
      
      error = insertError;
      if (data) savedPatientId = data.id;
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      
      if (!isEditing && savedPatientId) {
          toast({
            title: "Paciente cadastrado! 🎉",
            description: "Clique no botão para copiar o link de convite.",
            action: (
              <Button variant="outline" size="sm" onClick={() => {
                const link = `${window.location.origin}/onboarding/${savedPatientId}`;
                const text = `Olá ${nome.split(' ')[0]}! Complete seu cadastro neste link: ${link}`;
                navigator.clipboard.writeText(text);
                toast({ title: "Copiado!" });
              }}>
                <Copy className="h-4 w-4 mr-2" /> Copiar Convite
              </Button>
            ),
          });
      } else {
          toast({ title: "Paciente atualizado com sucesso!" });
      }
      
      navigate("/pacientes");
    }

    setLoading(false);
  };

  if (loadingData) {
    return <p className="text-center py-12 text-muted-foreground animate-pulse">Carregando dados...</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
              {isEditing ? "Editar Paciente" : "Novo Paciente"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? "Atualize os dados do paciente" : "Preencha os dados básicos e convide o paciente"}
            </p>
          </div>
        </div>
        {isEditing && (
          <Button variant="outline" className="gap-2" onClick={generateInviteLink}>
            <LinkIcon className="h-4 w-4" /> Enviar Convite
          </Button>
        )}
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
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input id="telefone" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
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
            <CardDescription>O endereço é autocompletado ao digitar o CEP.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" placeholder="00000-000" value={cep} onChange={handleCepChange} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rua">Rua / Logradouro</Label>
              <Input id="rua" placeholder="Nome da rua" value={rua} onChange={(e) => setRua(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input id="complemento" placeholder="Apto, Bloco, etc." value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" placeholder="SP" value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} />
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

        <div className="flex gap-3 justify-end pb-12">
          <Button type="button" variant="outline" onClick={() => navigate("/pacientes")}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : isEditing ? "Atualizar Paciente" : "Salvar e Gerar Convite"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
