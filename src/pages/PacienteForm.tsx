import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Link as LinkIcon, Copy, Camera, Upload, ShieldCheck } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";
import defaultAvatarImg from "@/assets/default-avatar.png";
import defaultAvatarMale from "@/assets/default-avatar-male.png";
import defaultAvatarFemale from "@/assets/default-avatar-female.png";
import { usePatientForm } from "@/modules/patients/hooks/usePatientForm";

const PacienteForm = () => {
  const navigate = useNavigate();
  const {
    id, isEditing,
    basic, setBasicField,
    address, setAddressField,
    guardian, setGuardian, setGuardianField,
    invoice, setInvoiceField,
    clinical, setClinicalField,
    lgpdConsentimento, setLgpdConsentimento,
    codigoAcesso,
    loading, loadingData, uploadingPhoto,
    fileInputRef,
    modalidades, convenios,
    handleSubmit, handlePhotoUpload, fetchAddressFor,
    copyAddressToGuardian, generateInviteLink,
    maskCPF, maskPhone, maskCEP, maskRG,
  } = usePatientForm();

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
          <div className="flex gap-2 items-center">
            <Button variant="outline" className="gap-2" onClick={generateInviteLink}>
              <LinkIcon className="h-4 w-4" /> Enviar Convite
            </Button>
          </div>
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
                {basic.fotoUrl ? (
                  <img src={basic.fotoUrl} alt="Foto do paciente" className="w-full h-full object-cover" />
                ) : (
                  <img 
                    src={basic.sexo === "masculino" ? defaultAvatarMale : basic.sexo === "feminino" ? defaultAvatarFemale : defaultAvatarImg} 
                    alt="Avatar padrão" 
                    className="w-full h-full object-cover opacity-60" 
                  />
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
                <Input id="nome" placeholder="Nome completo do paciente" value={basic.nome} onChange={(e) => setBasicField("nome", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={basic.cpf} onChange={(e) => setBasicField("cpf", maskCPF(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" placeholder="00.000.000-0" value={basic.rg} onChange={(e) => setBasicField("rg", maskRG(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input id="data_nascimento" type="date" value={basic.dataNascimento} onChange={(e) => setBasicField("dataNascimento", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Input id="telefone" placeholder="(00) 00000-0000" value={basic.telefone} onChange={(e) => setBasicField("telefone", maskPhone(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="email@exemplo.com" value={basic.email} onChange={(e) => setBasicField("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_social">Nome Social</Label>
                <Input id="nome_social" placeholder="Nome social (opcional)" value={basic.nomeSocial} onChange={(e) => setBasicField("nomeSocial", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo</Label>
                <Select value={basic.sexo} onValueChange={(v) => setBasicField("sexo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="intersexo">Intersexo</SelectItem>
                    <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="identidade_genero">Identidade de Gênero</Label>
                <Select value={basic.identidadeGenero} onValueChange={(v) => setBasicField("identidadeGenero", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cisgênero">Cisgênero</SelectItem>
                    <SelectItem value="transgênero">Transgênero</SelectItem>
                    <SelectItem value="não-binário">Não-binário</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Code */}
        {isEditing && codigoAcesso && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">🔐</span> Código de Acesso do Paciente
              </CardTitle>
              <CardDescription>Compartilhe este código com o paciente para que ele acesse sua área</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white border-2 border-blue-300 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Código de Acesso</p>
                  <p className="text-2xl font-bold font-mono text-blue-600 tracking-widest">{codigoAcesso}</p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(codigoAcesso);
                    toast({ title: "Código copiado! ✓" });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copiar
                </Button>
              </div>
              <div className="bg-white p-3 rounded border text-sm text-muted-foreground">
                <p className="font-semibold mb-2">Link de Acesso:</p>
                <p className="font-mono text-xs break-all text-blue-600">{window.location.origin}/paciente-access</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legal Guardian */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Responsável Legal</CardTitle>
                <CardDescription>Ative para cadastrar os dados do responsável legal (menores de idade ou incapazes)</CardDescription>
              </div>
              <Switch checked={guardian.temResponsavel} onCheckedChange={(v) => setGuardian((prev) => ({ ...prev, temResponsavel: v }))} />
            </div>
          </CardHeader>
          {guardian.temResponsavel && (
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Nome do Responsável *</Label>
                <Input placeholder="Nome completo do responsável" value={guardian.nome} onChange={(e) => setGuardianField("nome", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF do Responsável</Label>
                <Input placeholder="000.000.000-00" value={guardian.cpf} onChange={(e) => setGuardianField("cpf", maskCPF(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>RG do Responsável</Label>
                <Input placeholder="00.000.000-0" value={guardian.rg} onChange={(e) => setGuardianField("rg", maskRG(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Parentesco</Label>
                <Select value={guardian.parentesco || "none"} onValueChange={(v) => setGuardianField("parentesco", v === "none" ? "" : v)}>
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
                <Input placeholder="(00) 00000-0000" value={guardian.telefone} onChange={(e) => setGuardianField("telefone", maskPhone(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail do Responsável</Label>
                <Input type="email" placeholder="email@exemplo.com" value={guardian.email} onChange={(e) => setGuardianField("email", e.target.value)} />
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
                <Input placeholder="00000-000" value={guardian.cep} onChange={(e) => { const v = maskCEP(e.target.value); setGuardianField("cep", v); fetchAddressFor(v, "responsavel"); }} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input placeholder="Nome da rua" value={guardian.rua} onChange={(e) => setGuardianField("rua", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input placeholder="123" value={guardian.numero} onChange={(e) => setGuardianField("numero", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input placeholder="Apto, Bloco, etc." value={guardian.complemento} onChange={(e) => setGuardianField("complemento", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input placeholder="Bairro" value={guardian.bairro} onChange={(e) => setGuardianField("bairro", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input placeholder="Cidade" value={guardian.cidade} onChange={(e) => setGuardianField("cidade", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input placeholder="SP" value={guardian.estado} onChange={(e) => setGuardianField("estado", e.target.value)} maxLength={2} />
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
              <Input id="cep" placeholder="00000-000" value={address.cep} onChange={(e) => { const v = maskCEP(e.target.value); setAddressField("cep", v); fetchAddressFor(v, "paciente"); }} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rua">Rua / Logradouro</Label>
              <Input id="rua" placeholder="Nome da rua" value={address.rua} onChange={(e) => setAddressField("rua", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" placeholder="123" value={address.numero} onChange={(e) => setAddressField("numero", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input id="complemento" placeholder="Apto, Bloco, etc." value={address.complemento} onChange={(e) => setAddressField("complemento", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" placeholder="Bairro" value={address.bairro} onChange={(e) => setAddressField("bairro", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" placeholder="Cidade" value={address.cidade} onChange={(e) => setAddressField("cidade", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" placeholder="SP" value={address.estado} onChange={(e) => setAddressField("estado", e.target.value)} maxLength={2} />
            </div>
          </CardContent>
        </Card>

        {/* Nota Fiscal */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Nota Fiscal</CardTitle>
                <CardDescription>Dados para emissão de nota fiscal quando solicitada pelo paciente</CardDescription>
              </div>
              <Switch checked={invoice.solicitaNf} onCheckedChange={(v) => setInvoiceField("solicitaNf", v)} />
            </div>
          </CardHeader>
          {invoice.solicitaNf && (
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Razão Social / Nome</Label>
                <Input value={invoice.razaoSocial} onChange={(e) => setInvoiceField("razaoSocial", e.target.value)} placeholder="Nome ou Razão Social para NF" />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ para NF</Label>
                <Input value={invoice.cnpjCpf} onChange={(e) => setInvoiceField("cnpjCpf", e.target.value)} placeholder="CPF ou CNPJ" />
              </div>
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input value={invoice.inscricaoEstadual} onChange={(e) => setInvoiceField("inscricaoEstadual", e.target.value)} placeholder="Inscrição estadual (se houver)" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Endereço para NF</Label>
                <Input value={invoice.endereco} onChange={(e) => setInvoiceField("endereco", e.target.value)} placeholder="Endereço completo para a nota fiscal" />
              </div>
              <div className="space-y-2">
                <Label>E-mail para envio da NF</Label>
                <Input type="email" value={invoice.email} onChange={(e) => setInvoiceField("email", e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </CardContent>
          )}
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
              <Select value={clinical.tipoAtendimento} onValueChange={(v) => setClinicalField("tipoAtendimento", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {(modalidades || []).map((mod: { id: string; nome: string }) => (
                    <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select value={clinical.convenioId || "none"} onValueChange={(v) => setClinicalField("convenioId", v === "none" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um convênio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(convenios || []).map((conv: { id: string; nome: string }) => (
                    <SelectItem key={conv.id} value={conv.id}>{conv.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={clinical.status} onValueChange={(v) => setClinicalField("status", v as "ativo" | "inativo")}>
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
              <Textarea id="observacoes" placeholder="Anotações sobre o paciente, histórico clínico, restrições..." rows={4} value={clinical.observacoes} onChange={(e) => setClinicalField("observacoes", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* LGPD Consent */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Consentimento LGPD</CardTitle>
                  <CardDescription>Lei Geral de Proteção de Dados Pessoais</CardDescription>
                </div>
              </div>
              <Switch checked={lgpdConsentimento} onCheckedChange={setLgpdConsentimento} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ao ativar, o paciente declara que autoriza a coleta, armazenamento e processamento
              de seus dados pessoais e de saúde para fins de atendimento clínico, conforme a
              Lei nº 13.709/2018 (LGPD). Os dados serão utilizados exclusivamente para
              prontuário eletrônico, agendamentos e comunicação relacionada ao tratamento.
            </p>
            {lgpdConsentimento && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                ✓ Consentimento registrado
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end pb-12">
          <Button type="button" variant="outline" onClick={() => navigate("/pacientes")}>Cancelar</Button>
          <Button type="submit" disabled={loading || !basic.nome.trim() || !basic.telefone.trim()}>
            {loading ? "Salvando..." : isEditing ? "Atualizar Paciente" : "Salvar e Gerar Convite"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
