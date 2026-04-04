import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, Wifi, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WhatsAppConfig, ConnectionTestResult, WhatsAppProvider } from "@/modules/whatsapp/types";
import { testEvolutionConnection } from "@/modules/whatsapp/services/whatsappConversationService";

interface WhatsAppActivationProps {
  config: Partial<WhatsAppConfig>;
  onChange: (updates: Partial<WhatsAppConfig>) => void;
  onTestConnection: (token: string, phoneNumberId: string) => Promise<ConnectionTestResult>;
}

export function WhatsAppActivation({ config, onChange, onTestConnection }: WhatsAppActivationProps) {
  const [showToken, setShowToken] = useState(false);
  const [showEvoKey, setShowEvoKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | { success: boolean; status?: string | null; error: string | null } | null>(null);

  const provider: WhatsAppProvider = config.provider ?? "meta";

  const handleProviderChange = (p: string) => {
    onChange({ provider: p as WhatsAppProvider });
    setTestResult(null);
  };

  // Meta test
  const handleMetaTest = async () => {
    if (!config.api_token || !config.phone_number_id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(config.api_token, config.phone_number_id);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  // Evolution test
  const handleEvoTest = async () => {
    if (!config.evolution_api_url || !config.evolution_instance || !config.evolution_api_key) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testEvolutionConnection(
        config.evolution_api_url,
        config.evolution_instance,
        config.evolution_api_key
      );
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const canTestMeta = Boolean(config.api_token?.trim() && config.phone_number_id?.trim());
  const canTestEvo = Boolean(
    config.evolution_api_url?.trim() &&
    config.evolution_instance?.trim() &&
    config.evolution_api_key?.trim()
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wifi className="h-4 w-4 text-green-600" />
              Credenciais e Ativação
            </CardTitle>
            <CardDescription className="mt-1">
              Escolha o provedor WhatsApp e configure as credenciais desta clínica
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="wa-active" className="text-sm">
              {config.is_active ? "Ativado" : "Desativado"}
            </Label>
            <Switch
              id="wa-active"
              checked={Boolean(config.is_active)}
              onCheckedChange={(v) => onChange({ is_active: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selector */}
        <div className="space-y-1">
          <Label>Provedor WhatsApp</Label>
          <Tabs value={provider} onValueChange={handleProviderChange}>
            <TabsList className="w-full">
              <TabsTrigger value="meta" className="flex-1 gap-2">
                <Wifi className="h-4 w-4" /> Meta (Oficial)
              </TabsTrigger>
              <TabsTrigger value="evolution" className="flex-1 gap-2">
                <Zap className="h-4 w-4" /> Evolution API
              </TabsTrigger>
            </TabsList>

            {/* ── META ─────────────────────────────────────────── */}
            <TabsContent value="meta" className="space-y-4 pt-3">
              <div className="space-y-1">
                <Label htmlFor="api-token">API Token</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-token"
                      type={showToken ? "text" : "password"}
                      placeholder="EAAxxxxxxxx..."
                      value={config.api_token ?? ""}
                      onChange={(e) => onChange({ api_token: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => setShowToken((v) => !v)}
                    title={showToken ? "Ocultar token" : "Mostrar token"}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Token permanente gerado no Meta for Developers</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone-number-id">Phone Number ID</Label>
                <Input
                  id="phone-number-id"
                  placeholder="123456789012345"
                  value={config.phone_number_id ?? ""}
                  onChange={(e) => onChange({ phone_number_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Encontrado em Meta Business › Conta WhatsApp Business › Números de telefone
                </p>
              </div>

              <TestConnectionRow
                canTest={canTestMeta}
                testing={testing}
                testResult={testResult}
                onTest={handleMetaTest}
              />
            </TabsContent>

            {/* ── EVOLUTION ────────────────────────────────────── */}
            <TabsContent value="evolution" className="space-y-4 pt-3">
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <strong>⚡ Evolution API</strong> — Integração via servidor self-hosted. Cada clínica configura
                seu próprio número de WhatsApp na instância. Verifique as{" "}
                <a
                  href="https://doc.evolution-api.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  instruções de instalação
                </a>.
              </div>

              <div className="space-y-1">
                <Label htmlFor="evo-url">URL do Servidor Evolution</Label>
                <Input
                  id="evo-url"
                  placeholder="https://evolution.meusite.com"
                  value={config.evolution_api_url ?? ""}
                  onChange={(e) => onChange({ evolution_api_url: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="evo-instance">Nome da Instância</Label>
                <Input
                  id="evo-instance"
                  placeholder="clinica-exemplo"
                  value={config.evolution_instance ?? ""}
                  onChange={(e) => onChange({ evolution_instance: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Nome exato da instância criada na Evolution API (cada clínica tem a sua).
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="evo-key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="evo-key"
                    type={showEvoKey ? "text" : "password"}
                    placeholder="sua-api-key-aqui"
                    value={config.evolution_api_key ?? ""}
                    onChange={(e) => onChange({ evolution_api_key: e.target.value })}
                  />
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => setShowEvoKey((v) => !v)}
                  >
                    {showEvoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Global API key ou key da instância configurada no servidor Evolution.
                </p>
              </div>

              <TestConnectionRow
                canTest={canTestEvo}
                testing={testing}
                testResult={testResult as any}
                onTest={handleEvoTest}
                isEvolution
              />
            </TabsContent>
          </Tabs>
        </div>

        {config.is_active && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            WhatsApp está <strong>ativo</strong> para esta clínica — provedor: <strong>{provider === "evolution" ? "Evolution API" : "Meta Oficial"}</strong>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared test row ──────────────────────────────────────────

function TestConnectionRow({
  canTest,
  testing,
  testResult,
  onTest,
  isEvolution = false,
}: {
  canTest: boolean;
  testing: boolean;
  testResult: { success: boolean; status?: string | null; error: string | null; displayPhoneNumber?: string | null; phoneNumberId?: string | null } | null;
  onTest: () => void;
  isEvolution?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button
        type="button" variant="outline" size="sm"
        disabled={!canTest || testing}
        onClick={onTest}
        className="gap-2"
      >
        {testing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wifi className="h-4 w-4" />
        )}
        Testar Conexão
      </Button>

      {testResult && (
        <div className="flex items-center gap-2">
          {testResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                {isEvolution
                  ? `Conectado — status: ${testResult.status ?? "open"}`
                  : `Conectado — ${testResult.displayPhoneNumber ?? testResult.phoneNumberId}`}
              </Badge>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              <Badge variant="destructive" className="text-xs">
                {testResult.error ?? "Falha na conexão"}
              </Badge>
            </>
          )}
        </div>
      )}
    </div>
  );
}
