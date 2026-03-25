import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/modules/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Check, X, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";

interface IntegrationConfig {
  id: string;
  clinic_id: string;
  tipo: string;
  config: Record<string, any>;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const IntegrationTabs = ({ clinicId }: { clinicId: string }) => {
  const [interConfig, setInterConfig] = useState({
    client_id: "",
    client_secret: "",
    certificate_path: "",
    ativo: false,
  });

  const [niboConfig, setNiboConfig] = useState({
    api_key: "",
    account_id: "",
    plan_type: "basico",
    ativo: false,
  });

  const [transmiteConfig, setTransmiteConfig] = useState({
    token: "",
    cnpj: "",
    environment: "homolog",
    ativo: false,
  });

  const [showSecrets, setShowSecrets] = useState({
    inter: false,
    nibo: false,
    transmite: false,
  });

  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);

  // Fetch integration configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ["integration-configs", clinicId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("config_integracoes" as any) as any)
        .select("*")
        .eq("clinic_id", clinicId);
      if (error) throw error;
      return data as IntegrationConfig[];
    },
  });

  useEffect(() => {
    if (configs) {
      const inter = configs.find((c) => c.tipo === "banco_inter");
      const nibo = configs.find((c) => c.tipo === "nibo");
      const transmite = configs.find((c) => c.tipo === "transmitenota");

      if (inter) {
        setInterConfig({
          client_id: inter.config.client_id || "",
          client_secret: inter.config.client_secret || "",
          certificate_path: inter.config.certificate_path || "",
          ativo: inter.ativo || false,
        });
      }

      if (nibo) {
        setNiboConfig({
          api_key: nibo.config.api_key || "",
          account_id: nibo.config.account_id || "",
          plan_type: nibo.config.plan_type || "basico",
          ativo: nibo.ativo || false,
        });
      }

      if (transmite) {
        setTransmiteConfig({
          token: transmite.config.token || "",
          cnpj: transmite.config.cnpj || "",
          environment: transmite.config.environment || "homolog",
          ativo: transmite.ativo || false,
        });
      }
    }
  }, [configs]);

  // Save mutations
  const saveInterMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await (supabase
        .from("config_integracoes" as any) as any)
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("tipo", "banco_inter")
        .single();

      if (existing) {
        const { error } = await (supabase
          .from("config_integracoes" as any) as any)
          .update({ config: interConfig, ativo: interConfig.ativo })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("config_integracoes" as any) as any)
          .insert({
            clinic_id: clinicId,
            tipo: "banco_inter",
            config: interConfig,
            ativo: interConfig.ativo,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração do Banco Inter salva com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const saveNiboMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("config_integracoes")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("tipo", "nibo")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("config_integracoes")
          .update({ config: niboConfig, ativo: niboConfig.ativo })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("config_integracoes")
          .insert({
            clinic_id: clinicId,
            tipo: "nibo",
            config: niboConfig,
            ativo: niboConfig.ativo,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração do Nibo salva com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const saveTransmiteMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("config_integracoes")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("tipo", "transmitenota")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("config_integracoes")
          .update({ config: transmiteConfig, ativo: transmiteConfig.ativo })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("config_integracoes")
          .insert({
            clinic_id: clinicId,
            tipo: "transmitenota",
            config: transmiteConfig,
            ativo: transmiteConfig.ativo,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração do TransmiteNota salva com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  // Test connection functions
  const testInterConnection = async () => {
    setTestingIntegration("inter");
    try {
      const response = await fetch(
        new URL(/^http/.test(window.location.href) ? window.location.href : "http://localhost:3000") + "/functions/v1/inter-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: "sync_daily_extract",
            payload: {},
          }),
        }
      );

      if (response.ok) {
        toast({ title: "✅ Conexão com Banco Inter bem-sucedida!" });
      } else {
        const error = await response.json();
        toast({ title: "❌ Erro na conexão", description: error.error || "Verifique suas credenciais", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao testar", description: err.message, variant: "destructive" });
    } finally {
      setTestingIntegration(null);
    }
  };

  const testNiboConnection = async () => {
    setTestingIntegration("nibo");
    try {
      const response = await fetch(
        new URL(/^http/.test(window.location.href) ? window.location.href : "http://localhost:3000") + "/functions/v1/nibo-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: "fetch_balance",
            payload: {},
          }),
        }
      );

      if (response.ok) {
        toast({ title: "✅ Conexão com Nibo bem-sucedida!" });
      } else {
        const error = await response.json();
        toast({ title: "❌ Erro na conexão", description: error.error || "Verifique sua chave de API", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao testar", description: err.message, variant: "destructive" });
    } finally {
      setTestingIntegration(null);
    }
  };

  const testTransmiteConnection = async () => {
    setTestingIntegration("transmite");
    try {
      const response = await fetch(
        new URL(/^http/.test(window.location.href) ? window.location.href : "http://localhost:3000") + "/functions/v1/transmitenota-emit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: "validate_config",
            payload: {},
          }),
        }
      );

      if (response.ok) {
        toast({ title: "✅ Configuração do TransmiteNota válida!" });
      } else {
        const error = await response.json();
        toast({ title: "❌ Erro na configuração", description: error.error || "Verifique seus dados", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao testar", description: err.message, variant: "destructive" });
    } finally {
      setTestingIntegration(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="inter" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="inter" className="flex items-center gap-2">
          🏦 Banco Inter
        </TabsTrigger>
        <TabsTrigger value="nibo" className="flex items-center gap-2">
          💰 Nibo
        </TabsTrigger>
        <TabsTrigger value="transmite" className="flex items-center gap-2">
          📄 TransmiteNota
        </TabsTrigger>
      </TabsList>

      {/* === Banco Inter === */}
      <TabsContent value="inter" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Banco Inter</CardTitle>
                <CardDescription>Configure credenciais para sincronização de pagamentos e extratos</CardDescription>
              </div>
              {interConfig.ativo && <Badge className="bg-emerald-500">Ativo</Badge>}
              {!interConfig.ativo && <Badge variant="secondary">Inativo</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="inter_client_id">Client ID</Label>
              <Input
                id="inter_client_id"
                placeholder="Seu Client ID do Banco Inter"
                value={interConfig.client_id}
                onChange={(e) => setInterConfig({ ...interConfig, client_id: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="inter_client_secret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="inter_client_secret"
                  type={showSecrets.inter ? "text" : "password"}
                  placeholder="Seu Client Secret do Banco Inter"
                  value={interConfig.client_secret}
                  onChange={(e) => setInterConfig({ ...interConfig, client_secret: e.target.value })}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecrets({ ...showSecrets, inter: !showSecrets.inter })}
                >
                  {showSecrets.inter ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="inter_cert">Caminho do Certificado (opcional)</Label>
              <Input
                id="inter_cert"
                placeholder="/path/to/certificate.pem"
                value={interConfig.certificate_path}
                onChange={(e) => setInterConfig({ ...interConfig, certificate_path: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Caminho para certificado pfx/pem para autenticação mTLS (deixe em branco para OAuth2)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="inter_ativo"
                checked={interConfig.ativo}
                onChange={(e) => setInterConfig({ ...interConfig, ativo: e.target.checked })}
                className="rounded border border-input"
              />
              <Label htmlFor="inter_ativo" className="cursor-pointer">
                Ativa esta integração
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => saveInterMutation.mutate()}
                disabled={saveInterMutation.isPending}
              >
                {saveInterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Configuração
              </Button>
              <Button
                variant="outline"
                onClick={testInterConnection}
                disabled={testingIntegration === "inter"}
              >
                {testingIntegration === "inter" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* === Nibo === */}
      <TabsContent value="nibo" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Nibo</CardTitle>
                <CardDescription>Configure acesso para gestão financeira integrada</CardDescription>
              </div>
              {niboConfig.ativo && <Badge className="bg-emerald-500">Ativo</Badge>}
              {!niboConfig.ativo && <Badge variant="secondary">Inativo</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nibo_api_key">Chave API do Nibo</Label>
              <div className="relative">
                <Input
                  id="nibo_api_key"
                  type={showSecrets.nibo ? "text" : "password"}
                  placeholder="Sua chave API do Nibo"
                  value={niboConfig.api_key}
                  onChange={(e) => setNiboConfig({ ...niboConfig, api_key: e.target.value })}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecrets({ ...showSecrets, nibo: !showSecrets.nibo })}
                >
                  {showSecrets.nibo ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="nibo_account">ID da Conta (Account ID)</Label>
              <Input
                id="nibo_account"
                placeholder="ID único da sua conta no Nibo"
                value={niboConfig.account_id}
                onChange={(e) => setNiboConfig({ ...niboConfig, account_id: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="nibo_plan">Plano do Nibo</Label>
              <select
                id="nibo_plan"
                value={niboConfig.plan_type}
                onChange={(e) => setNiboConfig({ ...niboConfig, plan_type: e.target.value })}
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="basico">Básico</option>
                <option value="profissional">Profissional</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="nibo_ativo"
                checked={niboConfig.ativo}
                onChange={(e) => setNiboConfig({ ...niboConfig, ativo: e.target.checked })}
                className="rounded border border-input"
              />
              <Label htmlFor="nibo_ativo" className="cursor-pointer">
                Ativa esta integração
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => saveNiboMutation.mutate()}
                disabled={saveNiboMutation.isPending}
              >
                {saveNiboMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Configuração
              </Button>
              <Button
                variant="outline"
                onClick={testNiboConnection}
                disabled={testingIntegration === "nibo"}
              >
                {testingIntegration === "nibo" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* === TransmiteNota === */}
      <TabsContent value="transmite" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>TransmiteNota</CardTitle>
                <CardDescription>Configure emissão de Notas Fiscais de Serviço (NFS-e)</CardDescription>
              </div>
              {transmiteConfig.ativo && <Badge className="bg-emerald-500">Ativo</Badge>}
              {!transmiteConfig.ativo && <Badge variant="secondary">Inativo</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="transmite_token">Token da API</Label>
              <div className="relative">
                <Input
                  id="transmite_token"
                  type={showSecrets.transmite ? "text" : "password"}
                  placeholder="Seu token de autenticação TransmiteNota"
                  value={transmiteConfig.token}
                  onChange={(e) => setTransmiteConfig({ ...transmiteConfig, token: e.target.value })}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecrets({ ...showSecrets, transmite: !showSecrets.transmite })}
                >
                  {showSecrets.transmite ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="transmite_cnpj">CNPJ da Clínica (sem formatação)</Label>
              <Input
                id="transmite_cnpj"
                placeholder="00000000000191"
                value={transmiteConfig.cnpj}
                onChange={(e) => setTransmiteConfig({ ...transmiteConfig, cnpj: e.target.value.replace(/\D/g, "") })}
              />
            </div>

            <div>
              <Label htmlFor="transmite_env">Ambiente</Label>
              <select
                id="transmite_env"
                value={transmiteConfig.environment}
                onChange={(e) => setTransmiteConfig({ ...transmiteConfig, environment: e.target.value })}
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="homolog">Homologação (Teste)</option>
                <option value="producao">Produção</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="transmite_ativo"
                checked={transmiteConfig.ativo}
                onChange={(e) => setTransmiteConfig({ ...transmiteConfig, ativo: e.target.checked })}
                className="rounded border border-input"
              />
              <Label htmlFor="transmite_ativo" className="cursor-pointer">
                Ativa esta integração
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => saveTransmiteMutation.mutate()}
                disabled={saveTransmiteMutation.isPending}
              >
                {saveTransmiteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Configuração
              </Button>
              <Button
                variant="outline"
                onClick={testTransmiteConnection}
                disabled={testingIntegration === "transmite"}
              >
                {testingIntegration === "transmite" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Validar Configuração
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
