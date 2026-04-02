import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PatientSelector } from "./PatientSelector";
import type { WhatsAppAutomationSettings } from "@/modules/whatsapp/types";

type Fields = Pick<
  WhatsAppAutomationSettings,
  | "overdue_alert_enabled"
  | "overdue_alert_days"
  | "overdue_alert_include_pix"
  | "overdue_alert_message"
  | "overdue_alert_patient_ids"
>;

interface Patient {
  id: string;
  nome: string;
  cpf?: string | null;
}

interface PixData {
  chave: string;
  titular: string;
  banco: string;
}

interface OverdueAlertSettingsProps {
  settings: Partial<Fields>;
  pixData: PixData;
  onChange: (updates: Partial<Fields>) => void;
  onPixChange: (updates: Partial<PixData>) => void;
  patients: Patient[];
}

const DAYS_OPTIONS = [
  { value: "1", label: "1 dia de atraso" },
  { value: "3", label: "3 dias de atraso" },
  { value: "7", label: "7 dias de atraso" },
];

const VARIABLES = ["{paciente_nome}", "{valor_atrasado}", "{dias_atraso}", "{chave_pix}", "{titular_pix}"];

const DEFAULT_MESSAGE =
  "Olá, {paciente_nome}! Identificamos que o pagamento de R$ {valor_atrasado} está em atraso há {dias_atraso} dia(s). Por favor, regularize sua situação. PIX: {chave_pix} ({titular_pix}).";

function renderPreview(template: string, pix: PixData) {
  return template
    .replace(/\{paciente_nome\}/g, "Maria Silva")
    .replace(/\{valor_atrasado\}/g, "300,00")
    .replace(/\{dias_atraso\}/g, "3")
    .replace(/\{chave_pix\}/g, pix.chave || "00.000.000/0000-00")
    .replace(/\{titular_pix\}/g, pix.titular || "Clínica Essencial");
}

export function OverdueAlertSettings({
  settings,
  pixData,
  onChange,
  onPixChange,
  patients,
}: OverdueAlertSettingsProps) {
  const message = settings.overdue_alert_message ?? DEFAULT_MESSAGE;
  const allPatients = settings.overdue_alert_patient_ids === null;

  const handleAllToggle = (all: boolean) => {
    onChange({ overdue_alert_patient_ids: all ? null : [] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Alerta de Pagamento Atrasado
            </CardTitle>
            <CardDescription className="mt-1">
              Notifique pacientes com pagamentos em atraso
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="oa-enabled" className="text-sm">
              {settings.overdue_alert_enabled ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="oa-enabled"
              checked={Boolean(settings.overdue_alert_enabled)}
              onCheckedChange={(v) => onChange({ overdue_alert_enabled: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Alertar após</Label>
          <Select
            value={String(settings.overdue_alert_days ?? 1)}
            onValueChange={(v) => onChange({ overdue_alert_days: Number(v) })}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="oa-pix"
              checked={Boolean(settings.overdue_alert_include_pix)}
              onCheckedChange={(v) => onChange({ overdue_alert_include_pix: v })}
            />
            <Label htmlFor="oa-pix" className="cursor-pointer">
              Incluir dados PIX na mensagem
            </Label>
          </div>

          {settings.overdue_alert_include_pix && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-1 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Chave PIX</Label>
                <Input
                  placeholder="CPF, CNPJ, e-mail ou aleatória"
                  value={pixData.chave}
                  onChange={(e) => onPixChange({ chave: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome do Titular</Label>
                <Input
                  placeholder="Clínica Essencial"
                  value={pixData.titular}
                  onChange={(e) => onPixChange({ titular: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Input
                  placeholder="Ex: Nubank, Itaú..."
                  value={pixData.banco}
                  onChange={(e) => onPixChange({ banco: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Aplicar para</Label>
          <div className="flex items-center gap-3">
            <Switch id="oa-all" checked={allPatients} onCheckedChange={handleAllToggle} />
            <Label htmlFor="oa-all" className="text-sm cursor-pointer">
              Todos os pacientes
            </Label>
          </div>
          {!allPatients && (
            <PatientSelector
              patients={patients}
              selectedIds={settings.overdue_alert_patient_ids ?? []}
              onChange={(ids) => onChange({ overdue_alert_patient_ids: ids })}
            />
          )}
        </div>

        <div className="space-y-1">
          <Label>Mensagem</Label>
          <Textarea
            value={message}
            onChange={(e) => onChange({ overdue_alert_message: e.target.value })}
            rows={4}
            placeholder={DEFAULT_MESSAGE}
          />
          <div className="flex flex-wrap gap-1 mt-1">
            {VARIABLES.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-accent"
                onClick={() => onChange({ overdue_alert_message: message + " " + v })}
                title="Clique para inserir no final da mensagem"
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Preview</Label>
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900 whitespace-pre-wrap">
            {renderPreview(message, pixData)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
