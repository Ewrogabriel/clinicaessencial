import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { WhatsAppConfig, ConnectionTestResult } from "@/modules/whatsapp/types";

interface WhatsAppActivationProps {
  config: Partial<WhatsAppConfig>;
  onChange: (updates: Partial<WhatsAppConfig>) => void;
  onTestConnection: (token: string, phoneNumberId: string) => Promise<ConnectionTestResult>;
}

export function WhatsAppActivation({ config, onChange, onTestConnection }: WhatsAppActivationProps) {
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
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

  const canTest = Boolean(config.api_token?.trim() && config.phone_number_id?.trim());

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
              Conecte sua conta do WhatsApp Business via Meta Cloud API
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
              type="button"
              variant="outline"
              size="icon"
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
            Encontrado em Meta Business &rsaquo; Conta WhatsApp Business &rsaquo; Números de telefone
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canTest || testing}
            onClick={handleTest}
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
                    Conectado — {testResult.displayPhoneNumber ?? testResult.phoneNumberId}
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

        {config.is_active && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            WhatsApp Business está <strong>ativo</strong> para esta clínica
          </div>
        )}
      </CardContent>
    </Card>
  );
}
