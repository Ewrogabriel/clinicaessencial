import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Activity, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { maskCPF, maskPhone, maskCEP, maskRG } from "@/lib/masks";
import { toast } from "@/modules/shared/hooks/use-toast";

const PreCadastro = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [temResponsavel, setTemResponsavel] = useState(false);
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [respParentesco, setRespParentesco] = useState("");

  const fetchAddress = async (cepCode: string) => {
    const clean = cepCode.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase.from("pre_cadastros") as any).insert({
        nome, cpf: cpf || null, rg: rg || null, telefone, email: email || null,
        data_nascimento: dataNascimento || null,
        cep: cep || null, rua: rua || null, numero: numero || null,
        complemento: complemento || null, bairro: bairro || null,
        cidade: cidade || null, estado: estado || null,
        observacoes: observacoes || null,
        tem_responsavel_legal: temResponsavel,
        responsavel_nome: temResponsavel ? respNome || null : null,
        responsavel_cpf: temResponsavel ? respCpf || null : null,
        responsavel_telefone: temResponsavel ? respTelefone || null : null,
        responsavel_email: temResponsavel ? respEmail || null : null,
        responsavel_parentesco: temResponsavel ? respParentesco || null : null,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro Enviado!</h2>
            <p className="text-muted-foreground">
              Seus dados foram recebidos com sucesso. A equipe da clínica irá revisar e entrar em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Activity className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-[Plus_Jakarta_Sans]">Pré-Cadastro de Paciente</h1>
          <p className="text-muted-foreground">Preencha seus dados para agilizar seu cadastro na clínica</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <Input value={rg} onChange={(e) => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp *</Label>
                <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" required />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereço</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={cep} onChange={(e) => { const v = maskCEP(e.target.value); setCep(v); fetchAddress(v); }} placeholder="00000-000" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Rua</Label>
                <Input value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Nome da rua" />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto, Bloco" />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} placeholder="SP" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Responsável Legal</CardTitle>
                <Switch checked={temResponsavel} onCheckedChange={setTemResponsavel} />
              </div>
              <CardDescription>Ative se for menor de idade ou necessitar de responsável</CardDescription>
            </CardHeader>
            {temResponsavel && (
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Nome do Responsável</Label>
                  <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CPF do Responsável</Label>
                  <Input value={respCpf} onChange={(e) => setRespCpf(maskCPF(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={respTelefone} onChange={(e) => setRespTelefone(maskPhone(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Parentesco</Label>
                  <Input value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} placeholder="Ex: Mãe, Pai, Tutor" />
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Alguma informação adicional que queira compartilhar..." />
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Enviando..." : "Enviar Pré-Cadastro"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PreCadastro;
