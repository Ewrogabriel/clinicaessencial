import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Save, Upload, CreditCard, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useClinicSettings, useUpdateClinicSettings } from "@/hooks/useClinicSettings";
import { supabase } from "@/integrations/supabase/client";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/masks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FormasPagamento from "./FormasPagamento";

const ClinicSettings = () => {
  const { data: settings, isLoading } = useClinicSettings();
  const updateMutation = useUpdateClinicSettings();
  const [form, setForm] = useState({
    nome: "", cnpj: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
    telefone: "", whatsapp: "", email: "", instagram: "", logo_url: "",
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
      });
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings?.id) return;
    updateMutation.mutate({ id: settings.id, ...form }, {
      onSuccess: () => toast({ title: "Dados da clínica atualizados!" }),
      onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `clinic/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("essencialfisiopilatesbq").upload(path, file, { upsert: false });
      if (upErr) { toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" }); return; }
      const { data: urlData } = supabase.storage.from("essencialfisiopilatesbq").getPublicUrl(path);
      const logo_url = urlData.publicUrl;
      setForm(f => ({ ...f, logo_url }));
      updateMutation.mutate({ id: settings.id, logo_url }, {
        onSuccess: () => toast({ title: "Logo atualizada!" }),
        onError: (err: any) => toast({ title: "Erro ao salvar logo", description: err.message, variant: "destructive" }),
      });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
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
      if (data.erro) { toast({ title: "CEP não encontrado", variant: "destructive" }); return; }
      setForm(f => ({
        ...f,
        endereco: data.logradouro || f.endereco,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        estado: data.uf || f.estado,
      }));
    } catch { toast({ title: "Erro ao buscar endereço", variant: "destructive" }); }
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
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="dados" className="gap-2">
            <Settings2 className="h-4 w-4" /> Dados da Clínica
          </TabsTrigger>
          <TabsTrigger value="pagamento" className="gap-2">
            <CreditCard className="h-4 w-4" /> Formas de Pagamento
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
                    <input id="logo" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
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

        <TabsContent value="pagamento">
          <FormasPagamento />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClinicSettings;
