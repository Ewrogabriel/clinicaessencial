import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Link as LinkIcon, Copy, Camera, Upload, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { maskCPF, maskPhone, maskCEP, maskRG } from "@/lib/masks";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const PacienteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const isEditing = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Address
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Clinical
  const [tipoAtendimento, setTipoAtendimento] = useState("fisioterapia");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [observacoes, setObservacoes] = useState("");

  // Legal guardian
  const [temResponsavel, setTemResponsavel] = useState(false);
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respRg, setRespRg] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [respParentesco, setRespParentesco] = useState("");
  const [respEndereco, setRespEndereco] = useState("");
  const [respCep, setRespCep] = useState("");
  const [respRua, setRespRua] = useState("");
  const [respNumero, setRespNumero] = useState("");
  const [respComplemento, setRespComplemento] = useState("");
  const [respBairro, setRespBairro] = useState("");
  const [respCidade, setRespCidade] = useState("");
  const [respEstado, setRespEstado] = useState("");

  const [rg, setRg] = useState("");
  const [codigoAcesso, setCodigoAcesso] = useState<string | null>(null);

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-ativas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("modalidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (id) {
      setLoadingData(true);
      (supabase.from("pacientes") as any)
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data, error }: any) => {
          if (error || !data) {
            toast({ title: "Paciente não encontrado", variant: "destructive" });
            navigate("/pacientes");
            return;
          }
          setNome(data.nome);
          setCpf(data.cpf || "");
          setRg(data.rg || "");
          setTelefone(data.telefone || "");
          setEmail(data.email || "");
          setDataNascimento(data.data_nascimento || "");
          setFotoUrl(data.foto_url || "");
          setCep(data.cep || "");
          setRua(data.rua || "");
          setNumero(data.numero || "");
          setComplemento(data.complemento || "");
          setBairro(data.bairro || "");
          setCidade(data.cidade || "");
          setEstado(data.estado || "");
          setTipoAtendimento(data.tipo_atendimento);
          setStatus(data.status);
          setObservacoes(data.observacoes || "");
          setTemResponsavel(data.tem_responsavel_legal || false);
          setRespNome(data.responsavel_nome || "");
          setRespCpf(data.responsavel_cpf || "");
          setRespRg(data.responsavel_rg || "");
          setRespTelefone(data.responsavel_telefone || "");
          setRespEmail(data.responsavel_email || "");
          setRespParentesco(data.responsavel_parentesco || "");
          setRespEndereco(data.responsavel_endereco || "");
          setRespCep(data.responsavel_cep || "");
          setRespRua(data.responsavel_rua || "");
          setRespNumero(data.responsavel_numero || "");
          setRespComplemento(data.responsavel_complemento || "");
          setRespBairro(data.responsavel_bairro || "");
          setRespCidade(data.responsavel_cidade || "");
          setRespEstado(data.responsavel_estado || "");
          setLoadingData(false);
        });
    }
  }, [id, navigate]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `pacientes/${id || crypto.randomUUID()}/foto.${ext}`;
    const { error } = await supabase.storage
      .from("patient-documents")
      .upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("patient-documents").getPublicUrl(path);
      setFotoUrl(urlData.publicUrl);
      toast({ title: "Foto enviada! 📸" });
    }
    setUploadingPhoto(false);
  };

  const fetchAddressFor = async (cepCode: string, target: "paciente" | "responsavel") => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }
      if (target === "paciente") {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
      } else {
        setRespRua(data.logradouro || "");
        setRespBairro(data.bairro || "");
        setRespCidade(data.localidade || "");
        setRespEstado(data.uf || "");
      }
    } catch (err) {
      console.error("Erro ao buscar CEP", err);
      toast({ title: "Erro ao buscar endereço", variant: "destructive" });
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = e.target.value;
    setCep(newCep);
    fetchAddressFor(newCep, "paciente");
  };

  const handleRespCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = e.target.value;
    setRespCep(newCep);
    fetchAddressFor(newCep, "responsavel");
  };

  const copyAddressToGuardian = () => {
    setRespCep(cep);
    setRespRua(rua);
    setRespNumero(numero);
    setRespComplemento(complemento);
    setRespBairro(bairro);
    setRespCidade(cidade);
    setRespEstado(estado);
    toast({ title: "Endereço copiado! 📋" });
  };

  const generateInviteLink = () => {
    if (!id) return;
    const link = `${window.location.origin}/onboarding/${id}`;
    const text = `Olá ${nome.split(' ')[0]}! Complete seu cadastro no Essencial FisioPilates através deste link: ${link}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Link Copiado! 🔗", description: "Enviaremos o link pelo WhatsApp para o paciente." });
    }).catch(() => {
      toast({ title: "Erro ao copiar o link.", variant: "destructive" });
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const payload: any = {
      nome,
      cpf: cpf || null,
      rg: rg || null,
      telefone: telefone || null,
      email: email || null,
      data_nascimento: dataNascimento || null,
      foto_url: fotoUrl || null,
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
      tem_responsavel_legal: temResponsavel,
      responsavel_nome: temResponsavel ? respNome || null : null,
      responsavel_cpf: temResponsavel ? respCpf || null : null,
      responsavel_rg: temResponsavel ? respRg || null : null,
      responsavel_telefone: temResponsavel ? respTelefone || null : null,
      responsavel_email: temResponsavel ? respEmail || null : null,
      responsavel_parentesco: temResponsavel ? respParentesco || null : null,
      responsavel_endereco: temResponsavel ? respEndereco || null : null,
      responsavel_cep: temResponsavel ? respCep || null : null,
      responsavel_rua: temResponsavel ? respRua || null : null,
      responsavel_numero: temResponsavel ? respNumero || null : null,
      responsavel_complemento: temResponsavel ? respComplemento || null : null,
      responsavel_bairro: temResponsavel ? respBairro || null : null,
      responsavel_cidade: temResponsavel ? respCidade || null : null,
      responsavel_estado: temResponsavel ? respEstado || null : null,
    };

    let error;
    let savedPatientId = id;

    if (isEditing) {
      ({ error } = await (supabase.from("pacientes") as any).update(payload).eq("id", id));
    } else {
      const insertData = {
        ...payload,
        created_by: user.id,
        profissional_id: user.id,
      };
      const { data, error: insertError } = await (supabase.from("pacientes") as any).insert(insertData).select("id").single();
      error = insertError;
      if (data) savedPatientId = data.id;
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      
      // Generate access code for new patients
      let accessCode = null;
      if (!isEditing && savedPatientId) {
        accessCode = crypto.randomUUID();
        const { error: codeError } = await (supabase.from("pacientes") as any)
          .update({ codigo_acesso: accessCode })
          .eq("id", savedPatientId);
        
        if (!codeError) {
          setCodigoAcesso(accessCode);
        }
      }
      
      if (cpf && cpf.replace(/\D/g, "").length === 11) {
        try {
          await supabase.functions.invoke("create-patient-account", {
            body: { cpf, nome, paciente_id: savedPatientId },
          });
        } catch (err) {
          console.error("Erro ao criar conta do paciente:", err);
        }
      }
      
      if (!isEditing && savedPatientId && accessCode) {
        const inviteMessage = `Olá ${nome.split(' ')[0]}! 👋\n\nVocê foi cadastrado(a) em nosso sistema. Para acessar sua área de atendimento, use o código:\n\n📱 CÓDIGO: ${accessCode}\n\nAcesse: ${window.location.origin}/paciente-access\n\nQualquer dúvida, entre em contato conosco!`;
        
        toast({
          title: "Paciente cadastrado! 🎉",
          description: "Clique no botão para copiar o convite com código.",
          action: (
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(inviteMessage);
              toast({ title: "Convite copiado! ✓" });
            }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar Convite
            </Button>
          ),
        });
      } else if (!isEditing && savedPatientId) {
        toast({
          title: "Paciente cadastrado!",
          description: "Aguarde, gerando código de acesso...",
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
        {/* Photo + Personal Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
            <CardDescription>Informações básicas do paciente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photo Upload */}
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto do paciente" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground/50" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingPhoto ? "Enviando..." : "Carregar Foto"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou WEBP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input id="nome" placeholder="Nome completo do paciente" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" placeholder="00.000.000-0" value={rg} onChange={(e) => setRg(maskRG(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input id="data_nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Input id="telefone" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Guardian */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Responsável Legal</CardTitle>
                <CardDescription>Ative para cadastrar os dados do responsável legal (menores de idade ou incapazes)</CardDescription>
              </div>
              <Switch checked={temResponsavel} onCheckedChange={setTemResponsavel} />
            </div>
          </CardHeader>
          {temResponsavel && (
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Nome do Responsável *</Label>
                <Input placeholder="Nome completo do responsável" value={respNome} onChange={(e) => setRespNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF do Responsável</Label>
                <Input placeholder="000.000.000-00" value={respCpf} onChange={(e) => setRespCpf(maskCPF(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>RG do Responsável</Label>
                <Input placeholder="00.000.000-0" value={respRg} onChange={(e) => setRespRg(maskRG(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Parentesco</Label>
                <Select value={respParentesco || "none"} onValueChange={(v) => setRespParentesco(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    <SelectItem value="pai">Pai</SelectItem>
                    <SelectItem value="mae">Mãe</SelectItem>
                    <SelectItem value="avo">Avô/Avó</SelectItem>
                    <SelectItem value="tio">Tio/Tia</SelectItem>
                    <SelectItem value="tutor">Tutor Legal</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefone do Responsável</Label>
                <Input placeholder="(00) 00000-0000" value={respTelefone} onChange={(e) => setRespTelefone(maskPhone(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail do Responsável</Label>
                <Input type="email" placeholder="email@exemplo.com" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
              </div>

              {/* Guardian Address */}
              <div className="sm:col-span-2 pt-2 border-t">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Endereço do Responsável</Label>
                  <Button type="button" variant="outline" size="sm" onClick={copyAddressToGuardian}>
                    <Copy className="h-4 w-4 mr-1" /> Mesmo endereço do paciente
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input placeholder="00000-000" value={respCep} onChange={(e) => { const v = maskCEP(e.target.value); setRespCep(v); fetchAddressFor(v, "responsavel"); }} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input placeholder="Nome da rua" value={respRua} onChange={(e) => setRespRua(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input placeholder="123" value={respNumero} onChange={(e) => setRespNumero(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input placeholder="Apto, Bloco, etc." value={respComplemento} onChange={(e) => setRespComplemento(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input placeholder="Bairro" value={respBairro} onChange={(e) => setRespBairro(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input placeholder="Cidade" value={respCidade} onChange={(e) => setRespCidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input placeholder="SP" value={respEstado} onChange={(e) => setRespEstado(e.target.value)} maxLength={2} />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço</CardTitle>
            <CardDescription>O endereço é autocompletado ao digitar o CEP.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" placeholder="00000-000" value={cep} onChange={(e) => { const v = maskCEP(e.target.value); setCep(v); fetchAddressFor(v, "paciente"); }} />
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

        {/* Clinical */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Clínicos</CardTitle>
            <CardDescription>Informações sobre o atendimento</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Modalidade *</Label>
              <Select value={tipoAtendimento} onValueChange={(v) => setTipoAtendimento(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {(modalidades || []).map((mod: any) => (
                    <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "ativo" | "inativo")}>
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
          <Button type="submit" disabled={loading || !nome.trim() || !telefone.trim()}>
            {loading ? "Salvando..." : isEditing ? "Atualizar Paciente" : "Salvar e Gerar Convite"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
