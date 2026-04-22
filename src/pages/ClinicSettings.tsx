import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Save, Upload, CreditCard, Settings2, Shield, Database, FileText, Zap, MessageCircle, Palette, Lock, Users } from "lucide-react";
import { useClinicSettings, useUpdateClinicSettings } from "@/modules/clinic/hooks/useClinicSettings";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/masks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FormasPagamento from "./FormasPagamento";
import { AuditLogViewer } from "@/components/settings/AuditLogViewer";
import { BackupExport } from "@/components/settings/BackupExport";
import { IntegrationTabs } from "@/components/settings/IntegrationTabs";
import { WhatsAppConfigPanel } from "@/components/whatsapp/WhatsAppConfig";
import { ClinicThemeTab } from "@/components/settings/ClinicThemeTab";
import { PermissionsManager } from "@/components/permissions/PermissionsManager";
import { ScheduleAccessManager } from "@/components/permissions/ScheduleAccessManager";
import { AccessAuditPanel } from "@/components/permissions/AccessAuditPanel";

import { HolidaysTab } from "@/components/settings/HolidaysTab";
import { Calendar, ShieldCheck, CheckCircle2, XCircle, Rocket } from "lucide-react";
import { useSaaS } from "@/modules/shared/hooks/useSaaS";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function UpgradePlanButton({ clinicId, currentPlan }: { clinicId?: string; currentPlan?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans-upgrade"],
    queryFn: async () => {
      const { data } = await (supabase.from("platform_plans") as any).select("*").eq("ativo", true).order("valor_mensal");
      return data || [];
    },
    enabled: open,
  });

  const requestUpgrade = useMutation({
    mutationFn: async () => {
      if (!clinicId || !selectedPlanId || !user?.id) throw new Error("Dados incompletos");
      // Get current subscription
      const { data: sub } = await (supabase.from("clinic_subscriptions") as any)
        .select("plan_id").eq("clinic_id", clinicId).maybeSingle();
      
      const { data: inserted, error } = await (supabase.from("plan_upgrade_requests") as any).insert({
        clinic_id: clinicId,
        current_plan_id: sub?.plan_id || null,
        requested_plan_id: selectedPlanId,
        requested_by: user.id,
        motivo: motivo || null,
      }).select().single();
      if (error) throw error;

      // Notify master admins (non-blocking)
      try {
        const { data: masters } = await (supabase.from("user_roles") as any).select("user_id").eq("role", "master");
        if (masters?.length) {
          const plan = plans.find((p: any) => p.id === selectedPlanId);
          await (supabase.from("notificacoes") as any).insert(
            masters.map((m: any) => ({
              user_id: m.user_id,
              tipo: "upgrade_plano",
              titulo: "Solicitação de Upgrade de Plano",
              resumo: `Clínica solicitou upgrade para o plano ${plan?.nome || "—"}`,
              link: "/master",
            }))
          );
        }
      } catch (notifError) {
        console.warn("Notificação não enviada:", notifError);
      }
    },
    onSuccess: () => {
      toast.success("Solicitação enviada!", { description: "O administrador master será notificado para aprovar." });
      setOpen(false);
      setSelectedPlanId("");
      setMotivo("");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <>
      <Button variant="default" className="w-full sm:w-auto h-10 px-8 gap-2" onClick={() => setOpen(true)}>
        <Rocket className="h-4 w-4" /> Solicitar Upgrade de Plano
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Upgrade de Plano</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Plano atual: <strong>{currentPlan || "Básico"}</strong>. Selecione o plano desejado abaixo. 
              A solicitação será enviada ao administrador master para aprovação.
            </p>
            <div>
              <Label>Novo Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — R$ {Number(p.valor_mensal).toFixed(2)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Precisamos de mais pacientes" />
            </div>
            <Button className="w-full" onClick={() => requestUpgrade.mutate()} disabled={!selectedPlanId || requestUpgrade.isPending}>
              {requestUpgrade.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ClinicSettings = () => {
  const { data: settings, isLoading } = useClinicSettings();
  const { activeClinicId } = useClinic();
  const { saasStatus, isLoading: loadingSaaS } = useSaaS();
  const updateMutation = useUpdateClinicSettings();
  const [form, setForm] = useState({
    nome: "", cnpj: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
    telefone: "", whatsapp: "", email: "", instagram: "", logo_url: "",
    assinatura_url: "", rubrica_url: "",
    // Contratos
    pref_contract_multa_atraso_pct: "2",
    pref_contract_juros_mensal_pct: "1",
    pref_contract_prazo_cancelamento_h: "3",
    pref_contract_dia_vencimento: "10",
    pref_contract_prazo_reposicao_dias: "30",
    pref_contract_vigencia_meses: "6",
    pref_contract_raio_nao_concorrencia_km: "5",
    pref_contract_multa_nao_captacao_fator: "10",
    pref_contract_dia_pagamento_comissao: "10",
    pref_contract_prazo_aviso_previo_dias: "30",
    pref_contract_multa_uso_marca_valor: "5000",
    pref_contract_cidade_foro: "",
    pref_contract_estado_foro: "",
    pref_contract_enrollment_fee: "0",
    pref_contract_witness1_name: "",
    pref_contract_witness1_cpf: "",
    pref_contract_witness2_name: "",
    pref_contract_witness2_cpf: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        nome: settings.nome || "",
        cnpj: settings.cnpj || "",
        endereco: settings.endereco || "",
        numero: settings.numero || "",
        bairro: settings.bairro || "",
        cidade: settings.cidade || "",
        estado: settings.estado || "",
        cep: settings.cep || "",
        telefone: settings.telefone || "",
        whatsapp: settings.whatsapp || "",
        email: settings.email || "",
        instagram: settings.instagram || "",
        logo_url: settings.logo_url || "",
        assinatura_url: settings.assinatura_url || "",
        rubrica_url: settings.rubrica_url || "",
        // Contratos
        pref_contract_multa_atraso_pct: String(settings.pref_contract_multa_atraso_pct ?? "2"),
        pref_contract_juros_mensal_pct: String(settings.pref_contract_juros_mensal_pct ?? "1"),
        pref_contract_prazo_cancelamento_h: String(settings.pref_contract_prazo_cancelamento_h ?? "3"),
        pref_contract_dia_vencimento: String(settings.pref_contract_dia_vencimento ?? "10"),
        pref_contract_prazo_reposicao_dias: String(settings.pref_contract_prazo_reposicao_dias ?? "30"),
        pref_contract_vigencia_meses: String(settings.pref_contract_vigencia_meses ?? "6"),
        pref_contract_raio_nao_concorrencia_km: String(settings.pref_contract_raio_nao_concorrencia_km ?? "5"),
        pref_contract_multa_nao_captacao_fator: String(settings.pref_contract_multa_nao_captacao_fator ?? "10"),
        pref_contract_dia_pagamento_comissao: String(settings.pref_contract_dia_pagamento_comissao ?? "10"),
        pref_contract_prazo_aviso_previo_dias: String(settings.pref_contract_prazo_aviso_previo_dias ?? "30"),
        pref_contract_multa_uso_marca_valor: String(settings.pref_contract_multa_uso_marca_valor ?? "5000"),
        pref_contract_cidade_foro: settings.pref_contract_cidade_foro || "",
        pref_contract_estado_foro: settings.pref_contract_estado_foro || "",
        pref_contract_enrollment_fee: String(settings.pref_contract_enrollment_fee ?? "0"),
        pref_contract_witness1_name: settings.pref_contract_witness1_name || "",
        pref_contract_witness1_cpf: settings.pref_contract_witness1_cpf || "",
        pref_contract_witness2_name: settings.pref_contract_witness2_name || "",
        pref_contract_witness2_cpf: settings.pref_contract_witness2_cpf || "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    // Convert numeric fields back to numbers before saving
    const numericFields = [
      "pref_contract_multa_atraso_pct", "pref_contract_juros_mensal_pct",
      "pref_contract_prazo_cancelamento_h", "pref_contract_dia_vencimento",
      "pref_contract_prazo_reposicao_dias", "pref_contract_vigencia_meses",
      "pref_contract_raio_nao_concorrencia_km", "pref_contract_multa_nao_captacao_fator",
      "pref_contract_dia_pagamento_comissao", "pref_contract_prazo_aviso_previo_dias",
      "pref_contract_multa_uso_marca_valor", "pref_contract_enrollment_fee",
    ];
    const payload: any = { id: settings?.id, ...form };
    numericFields.forEach((f) => {
      if (payload[f] !== undefined && payload[f] !== "") {
        const n = Number(payload[f]);
        if (!Number.isNaN(n)) payload[f] = n;
      }
    });
    updateMutation.mutate(payload, {
      onSuccess: () => toast.success("Dados da clínica atualizados!"),
      onError: () => toast.error("Erro ao salvar"),
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `clinic/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("essencialfisiopilatesbq").upload(path, file, { upsert: false });
      if (upErr) { toast.error("Erro no upload", { description: upErr.message }); return; }
      const { data: urlData } = supabase.storage.from("essencialfisiopilatesbq").getPublicUrl(path);
      const logo_url = urlData.publicUrl;
      setForm(f => ({ ...f, logo_url }));
      updateMutation.mutate({ id: settings?.id, logo_url }, {
        onSuccess: () => toast.success("Logo atualizada!"),
        onError: (err: any) => toast.error("Erro ao salvar logo", { description: err.message }),
      });
    } catch (err: any) {
      toast.error("Erro no upload", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `clinic/signature-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("essencialfisiopilatesbq").upload(path, file, { upsert: false });
      if (upErr) { toast.error("Erro no upload", { description: upErr.message }); return; }
      const { data: urlData } = supabase.storage.from("essencialfisiopilatesbq").getPublicUrl(path);
      const assinatura_url = urlData.publicUrl;
      setForm(f => ({ ...f, assinatura_url }));
      updateMutation.mutate({ id: settings?.id, assinatura_url }, {
        onSuccess: () => toast.success("Assinatura atualizada!"),
        onError: (err: any) => toast.error("Erro ao salvar assinatura", { description: err.message }),
      });
    } catch (err: any) {
      toast.error("Erro no upload", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleRubricaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `clinic/rubrica-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("essencialfisiopilatesbq").upload(path, file, { upsert: false });
      if (upErr) { toast.error("Erro no upload", { description: upErr.message }); return; }
      const { data: urlData } = supabase.storage.from("essencialfisiopilatesbq").getPublicUrl(path);
      const rubrica_url = urlData.publicUrl;
      setForm(f => ({ ...f, rubrica_url }));
      updateMutation.mutate({ id: settings?.id, rubrica_url }, {
        onSuccess: () => toast.success("Rubrica atualizada!"),
        onError: (err: any) => toast.error("Erro ao salvar rubrica", { description: err.message }),
      });
    } catch (err: any) {
      toast.error("Erro no upload", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const fetchAddressFor = async (cepCode: string) => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      setForm(f => ({
        ...f,
        endereco: data.logradouro || f.endereco,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        estado: data.uf || f.estado,
      }));
    } catch { toast.error("Erro ao buscar endereço"); }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (field === "cnpj") val = maskCNPJ(val);
    if (field === "telefone" || field === "whatsapp") val = maskPhone(val);
    if (field === "cep") { val = maskCEP(val); fetchAddressFor(val); }
    setForm(f => ({ ...f, [field]: val }));
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Clínica</h1>
        <p className="text-muted-foreground">Gerencie informações, logo e formas de pagamento.</p>
      </div>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1 max-w-[900px]">
          <TabsTrigger value="dados" className="gap-2">
            <Settings2 className="h-4 w-4" /> Dados
          </TabsTrigger>
          <TabsTrigger value="plano" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Meu Plano
          </TabsTrigger>
          <TabsTrigger value="assinaturas" className="gap-2">
            <Settings2 className="h-4 w-4" /> Assinaturas
          </TabsTrigger>
          <TabsTrigger value="pagamento" className="gap-2">
            <CreditCard className="h-4 w-4" /> Pagamento
          </TabsTrigger>
          <TabsTrigger value="feriados" className="gap-2">
            <Calendar className="h-4 w-4" /> Feriados
          </TabsTrigger>
          <TabsTrigger value="nfe" className="gap-2">
            <FileText className="h-4 w-4" /> Nota Fiscal
          </TabsTrigger>
          <TabsTrigger value="integracao" className="gap-2">
            <Zap className="h-4 w-4" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Shield className="h-4 w-4" /> Logs
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="h-4 w-4" /> Backup
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="tema" className="gap-2">
            <Palette className="h-4 w-4" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="contratos" className="gap-2">
            <FileText className="h-4 w-4" /> Contratos
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-2">
            <Lock className="h-4 w-4" /> Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center"><Building2 className="h-6 w-6 text-muted-foreground" /></div>
                  )}
                  <div>
                    <Label htmlFor="logo" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild disabled={uploading}>
                        <span><Upload className="h-3 w-3 mr-1" />{uploading ? "Enviando..." : "Alterar Logo"}</span>
                      </Button>
                    </Label>
                    <input id="logo" title="Upload Logo" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>
                <div><Label>Nome da Clínica</Label><Input value={form.nome} onChange={set("nome")} /></div>
                <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0000-00" /></div>
                <div><Label>E-mail</Label><Input value={form.email} onChange={set("email")} type="email" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input value={form.telefone} onChange={set("telefone")} /></div>
                  <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={set("whatsapp")} /></div>
                </div>
                <div><Label>Instagram</Label><Input value={form.instagram} onChange={set("instagram")} placeholder="@clinica" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>CEP</Label><Input value={form.cep} onChange={set("cep")} placeholder="00000-000" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Label>Rua/Logradouro</Label><Input value={form.endereco} onChange={set("endereco")} /></div>
                  <div><Label>Nº</Label><Input value={form.numero} onChange={set("numero")} /></div>
                </div>
                <div><Label>Bairro</Label><Input value={form.bairro} onChange={set("bairro")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cidade</Label><Input value={form.cidade} onChange={set("cidade")} /></div>
                  <div><Label>Estado</Label><Input value={form.estado} onChange={set("estado")} /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 mt-4">
            <Save className="h-4 w-4" /> Salvar Alterações
          </Button>
        </TabsContent>

        <TabsContent value="plano">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    Plano Atual: <Badge className="text-lg px-4 py-1">{saasStatus?.plan_name || "Básico"}</Badge>
                  </CardTitle>
                  <CardDescription>Status da assinatura e limites do sistema</CardDescription>
                </div>
                {saasStatus?.subscription_status === 'active' && (
                  <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Ativa</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Limite de Pacientes</p>
                  <p className="text-2xl font-bold">{saasStatus?.max_patients === 999999 ? "Ilimitado" : saasStatus?.max_patients}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Limite de Profissionais</p>
                  <p className="text-2xl font-bold">{saasStatus?.max_professionals}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Renovação</p>
                  <p className="text-2xl font-bold">
                    {saasStatus?.current_period_end ? new Date(saasStatus.current_period_end).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider">Funcionalidades do Plano</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    {saasStatus?.has_premium_agenda ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                    Agenda Premium (Multi-vagas e Overbooking)
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {saasStatus?.has_bi ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                    Inteligência BI (LTV, Churn, CAC)
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {saasStatus?.has_api ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                    Integração API (Z-API / WhatsApp)
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="text-green-500 h-5 w-5" />
                    Contabilidade (DRE e Fluxo de Caixa)
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <UpgradePlanButton clinicId={saasStatus?.clinic_id} currentPlan={saasStatus?.plan_name} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assinaturas">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Assinaturas da Clínica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Assinatura Digital</Label>
                  <div className="flex items-center gap-4">
                    {form.assinatura_url ? (
                      <img src={form.assinatura_url} alt="Assinatura" className="h-16 w-32 rounded-lg object-contain border bg-white" />
                    ) : (
                      <div className="h-16 w-32 rounded-lg bg-muted flex flex-col items-center justify-center text-xs text-muted-foreground">Sem assinatura</div>
                    )}
                    <div>
                      <Label htmlFor="assinatura" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild disabled={uploading}>
                          <span><Upload className="h-3 w-3 mr-1" />{uploading ? "Enviando..." : "Upload Assinatura"}</span>
                        </Button>
                      </Label>
                      <input id="assinatura" title="Upload Assinatura" type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Usada como assinatura principal em contratos e documentos da clínica.</p>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Rubrica (Opcional)</Label>
                  <div className="flex items-center gap-4">
                    {form.rubrica_url ? (
                      <img src={form.rubrica_url} alt="Rubrica" className="h-16 w-16 rounded-lg object-contain border bg-white" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted flex flex-col items-center justify-center text-xs text-muted-foreground uppercase text-center">-</div>
                    )}
                    <div>
                      <Label htmlFor="rubrica" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild disabled={uploading}>
                          <span><Upload className="h-3 w-3 mr-1" />{uploading ? "Enviando..." : "Upload Rubrica"}</span>
                        </Button>
                      </Label>
                      <input id="rubrica" title="Upload Rubrica" type="file" accept="image/*" className="hidden" onChange={handleRubricaUpload} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Símbolo curto ou rubrica anexado ao carimbo da clínica.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pagamento">
          <FormasPagamento />
        </TabsContent>

        <TabsContent value="nfe">
          <NfeConfigTab />
        </TabsContent>

        <TabsContent value="integracao">
          <IntegrationTabs clinicId={settings?.id || ""} />
        </TabsContent>

        <TabsContent value="logs">
          <AuditLogViewer />
        </TabsContent>


        <TabsContent value="feriados">
          <HolidaysTab clinicId={activeClinicId || ""} />
        </TabsContent>

        <TabsContent value="backup">
          <BackupExport />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppConfigPanel clinicId={settings?.id || ""} />
        </TabsContent>

        <TabsContent value="tema">
          <ClinicThemeTab />
        </TabsContent>

        <TabsContent value="contratos">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Padrões para Pacientes
                </CardTitle>
                <CardDescription>Valores aplicados a novos contratos de pacientes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Multa por Atraso (%)</Label>
                    <Input type="number" step="0.1" value={form.pref_contract_multa_atraso_pct} onChange={set("pref_contract_multa_atraso_pct")} />
                  </div>
                  <div>
                    <Label>Juros Mensais (%)</Label>
                    <Input type="number" step="0.1" value={form.pref_contract_juros_mensal_pct} onChange={set("pref_contract_juros_mensal_pct")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prazo Cancelamento (h)</Label>
                    <Input type="number" value={form.pref_contract_prazo_cancelamento_h} onChange={set("pref_contract_prazo_cancelamento_h")} />
                  </div>
                  <div>
                    <Label>Dia de Vencimento</Label>
                    <Input type="number" min="1" max="31" value={form.pref_contract_dia_vencimento} onChange={set("pref_contract_dia_vencimento")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prazo Reposição (dias)</Label>
                    <Input type="number" value={form.pref_contract_prazo_reposicao_dias} onChange={set("pref_contract_prazo_reposicao_dias")} />
                  </div>
                  <div>
                    <Label>Vigência Padrão (meses)</Label>
                    <Input type="number" value={form.pref_contract_vigencia_meses} onChange={set("pref_contract_vigencia_meses")} />
                  </div>
                </div>
                <div>
                  <Label>Taxa de Matrícula Padrão (R$)</Label>
                  <Input type="number" value={form.pref_contract_enrollment_fee} onChange={set("pref_contract_enrollment_fee")} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Padrões para Profissionais
                </CardTitle>
                <CardDescription>Valores aplicados a novos contratos de profissionais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Raio Não Concorrência (km)</Label>
                    <Input type="number" step="0.1" value={form.pref_contract_raio_nao_concorrencia_km} onChange={set("pref_contract_raio_nao_concorrencia_km")} />
                  </div>
                  <div>
                    <Label>Fator Multa Captação (x)</Label>
                    <Input type="number" value={form.pref_contract_multa_nao_captacao_fator} onChange={set("pref_contract_multa_nao_captacao_fator")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Dia Pagto Comissão</Label>
                    <Input type="number" min="1" max="31" value={form.pref_contract_dia_pagamento_comissao} onChange={set("pref_contract_dia_pagamento_comissao")} />
                  </div>
                  <div>
                    <Label>Aviso Prévio (dias)</Label>
                    <Input type="number" value={form.pref_contract_prazo_aviso_previo_dias} onChange={set("pref_contract_prazo_aviso_previo_dias")} />
                  </div>
                </div>
                <div>
                  <Label>Multa Uso Marca (R$)</Label>
                  <Input type="number" step="0.01" value={form.pref_contract_multa_uso_marca_valor} onChange={set("pref_contract_multa_uso_marca_valor")} />
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Disposições Gerais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade do Foro</Label>
                    <Input 
                      value={form.pref_contract_cidade_foro} 
                      onChange={set("pref_contract_cidade_foro")} 
                      placeholder="Ex: Barbacena" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado do Foro (UF)</Label>
                    <Input 
                      value={form.pref_contract_estado_foro} 
                      onChange={set("pref_contract_estado_foro")} 
                      placeholder="Ex: MG" 
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" /> Testemunhas Padrão (Opcional)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Nome Testemunha 1</Label>
                      <Input value={form.pref_contract_witness1_name} onChange={set("pref_contract_witness1_name")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">CPF Testemunha 1</Label>
                      <Input value={form.pref_contract_witness1_cpf} onChange={set("pref_contract_witness1_cpf")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Nome Testemunha 2</Label>
                      <Input value={form.pref_contract_witness2_name} onChange={set("pref_contract_witness2_name")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">CPF Testemunha 2</Label>
                      <Input value={form.pref_contract_witness2_cpf} onChange={set("pref_contract_witness2_cpf")} />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    * Se preenchidos, os nomes e CPFs das testemunhas serão impressos automaticamente nos contratos para conferir força de título executivo extrajudicial.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 mt-6">
            <Save className="h-4 w-4" /> Salvar Padrões de Contrato
          </Button>
        </TabsContent>

        <TabsContent value="permissoes">
          <div className="space-y-6">
            <PermissionsManager />
            <ScheduleAccessManager />
            <AccessAuditPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** NFe Configuration Sub-Tab */
const NfeConfigTab = () => {
  const queryClient = useQueryClient();
  const [nfeForm, setNfeForm] = useState({
    ambiente: "homologacao",
    prestador_cnpj: "",
    prestador_inscricao_municipal: "",
    prestador_codigo_municipio: "",
    servico_codigo_tributacao: "",
    servico_cnae: "",
    servico_item_lista: "",
    servico_discriminacao_padrao: "Serviços de Fisioterapia e Pilates",
    aliquota_iss: "5",
  });

  const { data: nfeConfig, isLoading } = useQuery({
    queryKey: ["config-nfe-settings"],
    queryFn: async () => {
      const { data } = await (supabase.from("config_nfe") as any).select("*").limit(1).single();
      return data;
    },
  });

  useEffect(() => {
    if (nfeConfig) {
      setNfeForm({
        ambiente: nfeConfig.ambiente || "homologacao",
        prestador_cnpj: nfeConfig.prestador_cnpj || "",
        prestador_inscricao_municipal: nfeConfig.prestador_inscricao_municipal || "",
        prestador_codigo_municipio: nfeConfig.prestador_codigo_municipio || "",
        servico_codigo_tributacao: nfeConfig.servico_codigo_tributacao || "",
        servico_cnae: nfeConfig.servico_cnae || "",
        servico_item_lista: nfeConfig.servico_item_lista || "",
        servico_discriminacao_padrao: nfeConfig.servico_discriminacao_padrao || "Serviços de Fisioterapia e Pilates",
        aliquota_iss: String(nfeConfig.aliquota_iss ?? "5"),
      });
    }
  }, [nfeConfig]);

  const saveNfe = useMutation({
    mutationFn: async () => {
      const payload = {
        ...nfeForm,
        aliquota_iss: parseFloat(nfeForm.aliquota_iss) || 5,
      };
      if (nfeConfig?.id) {
        const { error } = await (supabase.from("config_nfe") as any).update(payload).eq("id", nfeConfig.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("config_nfe") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-nfe-settings"] });
      toast.success("Configuração de NF-e salva!");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const setNfe = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNfeForm((f) => ({ ...f, [field]: e.target.value }));

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Dados do Prestador (Focus NFe)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Ambiente</Label>
            <Select value={nfeForm.ambiente} onValueChange={(v) => setNfeForm((f) => ({ ...f, ambiente: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>CNPJ do Prestador</Label><Input value={nfeForm.prestador_cnpj} onChange={setNfe("prestador_cnpj")} placeholder="00.000.000/0000-00" /></div>
          <div><Label>Inscrição Municipal</Label><Input value={nfeForm.prestador_inscricao_municipal} onChange={setNfe("prestador_inscricao_municipal")} /></div>
          <div><Label>Código do Município (IBGE)</Label><Input value={nfeForm.prestador_codigo_municipio} onChange={setNfe("prestador_codigo_municipio")} placeholder="Ex: 3550308" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Serviço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Código de Tributação Municipal</Label><Input value={nfeForm.servico_codigo_tributacao} onChange={setNfe("servico_codigo_tributacao")} /></div>
          <div><Label>CNAE</Label><Input value={nfeForm.servico_cnae} onChange={setNfe("servico_cnae")} placeholder="Ex: 8650002" /></div>
          <div><Label>Item da Lista de Serviço</Label><Input value={nfeForm.servico_item_lista} onChange={setNfe("servico_item_lista")} placeholder="Ex: 04.01" /></div>
          <div><Label>Discriminação Padrão</Label><Input value={nfeForm.servico_discriminacao_padrao} onChange={setNfe("servico_discriminacao_padrao")} /></div>
          <div><Label>Alíquota ISS (%)</Label><Input type="number" step="0.01" value={nfeForm.aliquota_iss} onChange={setNfe("aliquota_iss")} /></div>
        </CardContent>
      </Card>

      <div className="md:col-span-2">
        <Button onClick={() => saveNfe.mutate()} disabled={saveNfe.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Salvar Configuração NF-e
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Após salvar, adicione seu token da Focus NFe nos segredos do projeto para ativar a emissão automática.
        </p>
      </div>
    </div>
  );
};

export default ClinicSettings;
