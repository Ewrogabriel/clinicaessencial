import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageUpload } from "@/components/ui/image-upload";
import { CouncilCombobox } from "@/components/ui/council-combobox";
import { FormacoesManager } from "@/components/profissionais/FormacoesManager";
import { maskPhone, maskCPF, maskRG, maskCEP } from "@/lib/masks";
import { cleanSignatureImage } from "@/lib/imageUtils";
import { Video, Home, GraduationCap, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProfessionalFormProps {
  initialData?: any;
  isCreating?: boolean;
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
  canChangeRole?: boolean;
}

export const ProfessionalForm = ({ 
  initialData, 
  isCreating = false, 
  onSubmit, 
  loading = false,
  canChangeRole = true 
}: ProfessionalFormProps) => {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    createEmail: "",
    createPassword: "",
    createPasswordConfirm: "",
    role: "profissional",
    especialidade: "",
    commission_rate: "0",
    commission_fixed: "0",
    cor_agenda: "#3b82f6",
    registro_profissional: "",
    tipo_contratacao: "autonomo",
    cnpj: "",
    cpf: "",
    rg: "",
    data_nascimento: "",
    estado_civil: "solteiro",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    assinatura_url: "",
    rubrica_url: "",
    conselho_profissional: "",
    registro_conselho: "",
    foto_url: "",
    bio: "",
    graduacao: "",
    cursos: "",
    aceita_teleconsulta: false,
    teleconsulta_plataforma: "",
    teleconsulta_link: "",
    aceita_domiciliar: false,
    domiciliar_raio_km: "",
    domiciliar_valor_adicional: "",
    domiciliar_observacoes: "",
  });

  const [cleaningAssinatura, setCleaningAssinatura] = useState(false);
  const [cleaningRubrica, setCleaningRubrica] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome || "",
        email: initialData.email || "",
        telefone: initialData.telefone || "",
        createEmail: "",
        createPassword: "",
        createPasswordConfirm: "",
        role: initialData.role || "profissional",
        especialidade: initialData.especialidade || "",
        commission_rate: String(initialData.commission_rate || 0),
        commission_fixed: String(initialData.commission_fixed || 0),
        cor_agenda: initialData.cor_agenda || "#3b82f6",
        registro_profissional: initialData.registro_profissional || "",
        tipo_contratacao: initialData.tipo_contratacao || "autonomo",
        cnpj: initialData.cnpj || "",
        cpf: initialData.cpf || "",
        rg: initialData.rg || "",
        data_nascimento: initialData.data_nascimento || "",
        estado_civil: initialData.estado_civil || "solteiro",
        endereco: initialData.endereco || "",
        numero: initialData.numero || "",
        bairro: initialData.bairro || "",
        cidade: initialData.cidade || "",
        estado: initialData.estado || "",
        cep: initialData.cep || "",
        assinatura_url: initialData.assinatura_url || "",
        rubrica_url: initialData.rubrica_url || "",
        conselho_profissional: initialData.conselho_profissional || "",
        registro_conselho: initialData.registro_conselho || "",
        foto_url: initialData.foto_url || "",
        bio: initialData.bio || "",
        graduacao: initialData.graduacao || "",
        cursos: Array.isArray(initialData.cursos) ? initialData.cursos.join(", ") : (initialData.cursos || ""),
        aceita_teleconsulta: initialData.aceita_teleconsulta || false,
        teleconsulta_plataforma: initialData.teleconsulta_plataforma || "",
        teleconsulta_link: initialData.teleconsulta_link || "",
        aceita_domiciliar: initialData.aceita_domiciliar || false,
        domiciliar_raio_km: initialData.domiciliar_raio_km ? String(initialData.domiciliar_raio_km) : "",
        domiciliar_valor_adicional: initialData.domiciliar_valor_adicional ? String(initialData.domiciliar_valor_adicional) : "",
        domiciliar_observacoes: initialData.domiciliar_observacoes || "",
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAssinaturaChange = async (url: string) => {
    handleChange("assinatura_url", url);
    if (url && url.startsWith("data:")) {
      setCleaningAssinatura(true);
      try {
        const cleaned = await cleanSignatureImage(url);
        handleChange("assinatura_url", cleaned);
        toast.success("Assinatura otimizada automaticamente! ✨");
      } catch { /* keep original */ }
      finally { setCleaningAssinatura(false); }
    }
  };

  const handleRubricaChange = async (url: string) => {
    handleChange("rubrica_url", url);
    if (url && url.startsWith("data:")) {
      setCleaningRubrica(true);
      try {
        const cleaned = await cleanSignatureImage(url);
        handleChange("rubrica_url", cleaned);
        toast.success("Rubrica otimizada automaticamente! ✨");
      } catch { /* keep original */ }
      finally { setCleaningRubrica(false); }
    }
  };

  const fetchAddressFor = async (cepCode: string) => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setFormData(prev => ({
        ...prev,
        endereco: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
      }));
    } catch { /* ignore */ }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label htmlFor="role-select">Cargo *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={v => handleChange("role", v)}
                    disabled={!canChangeRole}
                  >
                    <SelectTrigger id="role-select" aria-label="Selecionar Cargo">
                      <SelectValue />
                    </SelectTrigger>
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
                  <Input 
                    type="email" 
                    value={formData.createEmail} 
                    onChange={e => handleChange("createEmail", e.target.value)} 
                    placeholder="email@exemplo.com" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input 
                      type="password" 
                      value={formData.createPassword} 
                      onChange={e => handleChange("createPassword", e.target.value)} 
                      placeholder="••••••••" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha *</Label>
                    <Input 
                      type="password" 
                      value={formData.createPasswordConfirm} 
                      onChange={e => handleChange("createPasswordConfirm", e.target.value)} 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>
              </>
            )}
            {!isCreating && canChangeRole && (
              <div className="space-y-2">
                <Label htmlFor="role-select-edit">Cargo</Label>
                <Select value={formData.role} onValueChange={v => handleChange("role", v)}>
                  <SelectTrigger id="role-select-edit" aria-label="Editar Cargo">
                    <SelectValue />
                  </SelectTrigger>
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
              <Label>Foto de Perfil</Label>
              <ImageUpload
                value={formData.foto_url}
                onChange={v => handleChange("foto_url", v)}
                folder="profile-photos"
                className="w-24 h-24 rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input 
                value={formData.nome} 
                onChange={e => handleChange("nome", e.target.value)} 
                placeholder="Nome completo" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input 
                  value={formData.cpf} 
                  onChange={e => handleChange("cpf", maskCPF(e.target.value))} 
                  placeholder="000.000.000-00" 
                />
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <Input 
                  value={formData.rg} 
                  onChange={e => handleChange("rg", maskRG(e.target.value))} 
                  placeholder="00.000.000-0" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input 
                  type="date" 
                  value={formData.data_nascimento} 
                  onChange={e => handleChange("data_nascimento", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input 
                  value={formData.telefone} 
                  onChange={e => handleChange("telefone", maskPhone(e.target.value))} 
                  placeholder="(00) 00000-0000" 
                />
              </div>
            </div>
            {!isCreating && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={formData.email} 
                  onChange={e => handleChange("email", e.target.value)} 
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="endereco" className="space-y-4">
            <div className="space-y-2 max-w-[200px]">
              <Label>CEP</Label>
              <Input 
                value={formData.cep} 
                onChange={e => { 
                  const v = maskCEP(e.target.value); 
                  handleChange("cep", v); 
                  fetchAddressFor(v); 
                }} 
                placeholder="00000-000" 
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Endereço</Label>
                <Input 
                  value={formData.endereco} 
                  onChange={e => handleChange("endereco", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input 
                  value={formData.numero} 
                  onChange={e => handleChange("numero", e.target.value)} 
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={formData.bairro} onChange={e => handleChange("bairro", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={formData.cidade} onChange={e => handleChange("cidade", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input 
                  value={formData.estado} 
                  onChange={e => handleChange("estado", e.target.value.toUpperCase())} 
                  maxLength={2} 
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profissional" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="especialidade">Especialidade</Label>
              <Input
                id="especialidade"
                value={formData.especialidade}
                onChange={e => handleChange("especialidade", e.target.value)}
                placeholder="Ex: Fisioterapia, Psicologia, Nutrição, Pilates..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="conselho_profissional">Conselho Profissional</Label>
                <CouncilCombobox
                  value={formData.conselho_profissional}
                  onValueChange={v => handleChange("conselho_profissional", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registro_conselho">Nº Registro no Conselho</Label>
                <Input 
                  id="registro_conselho"
                  value={formData.registro_conselho} 
                  onChange={e => handleChange("registro_conselho", e.target.value)} 
                  placeholder="Ex: 123456-F" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="graduacao">Graduação</Label>
                <Input 
                  id="graduacao"
                  value={formData.graduacao} 
                  onChange={e => handleChange("graduacao", e.target.value)} 
                  placeholder="Ex: Fisioterapia — UFJF 2018" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registro_profissional">Registro Interno/Outros</Label>
                <Input 
                  id="registro_profissional"
                  value={formData.registro_profissional} 
                  onChange={e => handleChange("registro_profissional", e.target.value)} 
                  placeholder="Outros registros..." 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cursos">Cursos (Separados por vírgula)</Label>
              <Input 
                id="cursos"
                value={formData.cursos} 
                onChange={e => handleChange("cursos", e.target.value)} 
                placeholder="Pilates Clínico, RPG Souchard, Dry Needling" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Descrição Profissional</Label>
              <Textarea 
                id="bio"
                className="min-h-[80px]"
                value={formData.bio} 
                onChange={e => handleChange("bio", e.target.value)} 
                placeholder="Conte um pouco sobre sua trajetória profissional..." 
                title="Bio / Descrição Profissional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commission_rate">Comissão (%)</Label>
                <Input 
                  id="commission_rate"
                  type="number" 
                  step="0.01" 
                  value={formData.commission_rate} 
                  onChange={e => handleChange("commission_rate", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission_fixed">Valor Fixo (R$)</Label>
                <Input 
                  id="commission_fixed"
                  type="number" 
                  step="0.01" 
                  value={formData.commission_fixed} 
                  onChange={e => handleChange("commission_fixed", e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Video className="h-4 w-4" /> Teleconsulta
              </h4>
              <div className="flex items-center justify-between">
                <Label htmlFor="aceita_teleconsulta">Aceita Teleconsulta?</Label>
                <Checkbox 
                  id="aceita_teleconsulta"
                  checked={formData.aceita_teleconsulta} 
                  onCheckedChange={v => handleChange("aceita_teleconsulta", !!v)} 
                  title="Aceita Teleconsulta?"
                />
              </div>
              {formData.aceita_teleconsulta && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                  <div className="space-y-2">
                    <Label htmlFor="teleconsulta_plataforma">Plataforma</Label>
                    <Select value={formData.teleconsulta_plataforma} onValueChange={v => handleChange("teleconsulta_plataforma", v)}>
                      <SelectTrigger id="teleconsulta_plataforma" aria-label="Plataforma de Teleconsulta">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google_meet">Google Meet</SelectItem>
                        <SelectItem value="zoom">Zoom</SelectItem>
                        <SelectItem value="teams">Microsoft Teams</SelectItem>
                        <SelectItem value="whatsapp_video">WhatsApp Vídeo</SelectItem>
                        <SelectItem value="outro">Outra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teleconsulta_link">Link da Sala</Label>
                    <Input 
                      id="teleconsulta_link"
                      value={formData.teleconsulta_link} 
                      onChange={e => handleChange("teleconsulta_link", e.target.value)} 
                      placeholder="https://meet.google.com/..." 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Home className="h-4 w-4" /> Atendimento Domiciliar
              </h4>
              <div className="flex items-center justify-between">
                <Label htmlFor="aceita_domiciliar">Aceita Domiciliar?</Label>
                <Checkbox 
                  id="aceita_domiciliar"
                  checked={formData.aceita_domiciliar} 
                  onCheckedChange={v => handleChange("aceita_domiciliar", !!v)} 
                  title="Aceita Domiciliar?"
                />
              </div>
              {formData.aceita_domiciliar && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                  <div className="space-y-2">
                    <Label htmlFor="domiciliar_raio_km">Raio de Atendimento (km)</Label>
                    <Input 
                      id="domiciliar_raio_km"
                      type="number" 
                      value={formData.domiciliar_raio_km} 
                      onChange={e => handleChange("domiciliar_raio_km", e.target.value)} 
                      placeholder="Ex: 15" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domiciliar_valor_adicional">Taxa Adicional (R$)</Label>
                    <Input 
                      id="domiciliar_valor_adicional"
                      type="number" 
                      step="0.01" 
                      value={formData.domiciliar_valor_adicional} 
                      onChange={e => handleChange("domiciliar_valor_adicional", e.target.value)} 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="domiciliar_observacoes">Observações</Label>
                    <Input 
                      id="domiciliar_observacoes"
                      value={formData.domiciliar_observacoes} 
                      onChange={e => handleChange("domiciliar_observacoes", e.target.value)} 
                      placeholder="Restrições, dias específicos, etc..." 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="tipo_contratacao">Tipo de Contratação</Label>
              <Select 
                value={formData.tipo_contratacao || "autonomo"} 
                onValueChange={v => handleChange("tipo_contratacao", v)}
              >
                <SelectTrigger id="tipo_contratacao" aria-label="Tipo de Contratação">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                  <SelectItem value="mei">MEI</SelectItem>
                  <SelectItem value="pj">PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tipo_contratacao === "pj" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input 
                  id="cnpj"
                  value={formData.cnpj} 
                  onChange={e => handleChange("cnpj", e.target.value)} 
                  placeholder="00.000.000/0000-00" 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cor_agenda">Cor na Agenda</Label>
              <div className="flex items-center gap-3">
                <input 
                  id="cor_agenda"
                  type="color" 
                  value={formData.cor_agenda} 
                  onChange={e => handleChange("cor_agenda", e.target.value)} 
                  className="w-10 h-10 rounded border cursor-pointer p-0"
                  title="Escolher Cor na Agenda"
                />
                <Input value={formData.cor_agenda} onChange={e => handleChange("cor_agenda", e.target.value)} className="w-24 font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Assinatura Digital
                  {cleaningAssinatura && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <ImageUpload
                  value={formData.assinatura_url}
                  onChange={handleAssinaturaChange}
                  folder="signatures"
                  className="h-32 w-full object-contain bg-white border-2 border-dashed rounded-lg"
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-500" /> Cleanup IA Ativo
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Rubrica (Para Recibos/Contratos)
                  {cleaningRubrica && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <ImageUpload
                  value={formData.rubrica_url}
                  onChange={handleRubricaChange}
                  folder="rubrics"
                  className="h-32 w-full object-contain bg-white border-2 border-dashed rounded-lg"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="formacoes" className="pt-2">
            <FormacoesManager 
              profissionalId={initialData?.user_id ?? ""} 
              readOnly={!isCreating && !initialData} 
            />
          </TabsContent>

          {isCreating && (
            <TabsContent value="acesso">
              <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
                <h3 className="font-medium text-sm">Configuração Inicial de Acesso</h3>
                <p className="text-xs text-muted-foreground">
                  As permissões padrão para o cargo escolhido serão aplicadas.
                  Você poderá refiná-las individualmente após a criação.
                </p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </ScrollArea>

      <div className="flex justify-end gap-3 pt-4 border-t mt-4">
        <Button 
          type="submit" 
          disabled={loading}
          className="min-w-[120px]"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
          ) : (
            isCreating ? "Criar Membro" : "Salvar Alterações"
          )}
        </Button>
      </div>
    </form>
  );
};
