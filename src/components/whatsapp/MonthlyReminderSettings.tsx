import { DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PatientSelector } from "./PatientSelector";
import type { WhatsAppAutomationSettings } from "@/modules/whatsapp/types";

type Fields = Pick<
  WhatsAppAutomationSettings,
  | "monthly_reminder_enabled"
  | "monthly_reminder_days_before"
  | "monthly_reminder_message"
  | "monthly_reminder_patient_ids"
>;

interface Patient {
  id: string;
  nome: string;
  cpf?: string | null;
}

interface MonthlyReminderSettingsProps {
  settings: Partial<Fields>;
  onChange: (updates: Partial<Fields>) => void;
  patients: Patient[];
}

const DAYS_OPTIONS = [
  { value: "3", label: "3 dias antes" },
  { value: "7", label: "7 dias antes" },
  { value: "14", label: "14 dias antes" },
];

const VARIABLES = ["{paciente_nome}", "{valor_mensalidade}", "{data_vencimento}", "{plano_nome}"];

const DEFAULT_MESSAGE =
  "Olá, {paciente_nome}! Informamos que sua mensalidade no valor de R$ {valor_mensalidade} vence em {data_vencimento}. Entre em contato caso precise de mais informações.";

function renderPreview(template: string) {
  return template
    .replace(/\{paciente_nome\}/g, "Maria Silva")
    .replace(/\{valor_mensalidade\}/g, "300,00")
    .replace(/\{data_vencimento\}/g, "10/04/2026")
    .replace(/\{plano_nome\}/g, "Plano Mensal");
}

export function MonthlyReminderSettings({ settings, onChange, patients }: MonthlyReminderSettingsProps) {
  const message = settings.monthly_reminder_message ?? DEFAULT_MESSAGE;
  const allPatients = settings.monthly_reminder_patient_ids === null;

  const handleAllToggle = (all: boolean) => {
    onChange({ monthly_reminder_patient_ids: all ? null : [] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-yellow-600" />
              Lembrete de Mensalidade
            </CardTitle>
            <CardDescription className="mt-1">
              Avise pacientes sobre vencimento próximo da mensalidade
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mr-enabled" className="text-sm">
              {settings.monthly_reminder_enabled ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="mr-enabled"
              checked={Boolean(settings.monthly_reminder_enabled)}
              onCheckedChange={(v) => onChange({ monthly_reminder_enabled: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Enviar com antecedência de</Label>
          <Select
            value={String(settings.monthly_reminder_days_before ?? 7)}
            onValueChange={(v) => onChange({ monthly_reminder_days_before: Number(v) })}
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
          <Label>Aplicar para</Label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="mr-all"
                checked={allPatients}
                onCheckedChange={handleAllToggle}
              />
              <Label htmlFor="mr-all" className="text-sm cursor-pointer">
                Todos os pacientes
              </Label>
            </div>
          </div>
          {!allPatients && (
            <PatientSelector
              patients={patients}
              selectedIds={settings.monthly_reminder_patient_ids ?? []}
              onChange={(ids) => onChange({ monthly_reminder_patient_ids: ids })}
            />
          )}
        </div>

        <div className="space-y-1">
          <Label>Mensagem</Label>
          <Textarea
            value={message}
            onChange={(e) => onChange({ monthly_reminder_message: e.target.value })}
            rows={4}
            placeholder={DEFAULT_MESSAGE}
          />
          <div className="flex flex-wrap gap-1 mt-1">
            {VARIABLES.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-accent"
                onClick={() => onChange({ monthly_reminder_message: message + " " + v })}
                title="Clique para inserir no final da mensagem"
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Preview</Label>
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-900 whitespace-pre-wrap">
            {renderPreview(message)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
