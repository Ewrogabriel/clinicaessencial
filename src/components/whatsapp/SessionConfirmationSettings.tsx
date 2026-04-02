import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { WhatsAppAutomationSettings } from "@/modules/whatsapp/types";
import { CONFIRMATION_TEMPLATE, CONFIRMATION_VARIABLES } from "@/lib/whatsapp/confirmationTemplates";

type Fields = Pick<
  WhatsAppAutomationSettings,
  "session_confirmation_enabled" | "session_confirmation_hours_before" | "session_confirmation_message"
>;

interface SessionConfirmationSettingsProps {
  settings: Partial<Fields>;
  onChange: (updates: Partial<Fields>) => void;
}

const HOURS_OPTIONS = [
  { value: "12", label: "12 horas antes" },
  { value: "24", label: "24 horas antes" },
  { value: "48", label: "48 horas antes" },
  { value: "72", label: "72 horas antes" },
];

const VARIABLES = CONFIRMATION_VARIABLES;

const DEFAULT_MESSAGE = CONFIRMATION_TEMPLATE;

function renderPreview(template: string) {
  return template
    .replace(/\{paciente\}/g, "Maria Silva")
    .replace(/\{tipo\}/g, "sessão")
    .replace(/\{dia_semana\}/g, "Segunda-feira")
    .replace(/\{data\}/g, "10/04/2026")
    .replace(/\{hora\}/g, "09:00")
    .replace(/\{profissional\}/g, "Dr. João")
    .replace(/\{link\}/g, "https://app.exemplo.com/confirmar-agendamento/123");
}

export function SessionConfirmationSettings({ settings, onChange }: SessionConfirmationSettingsProps) {
  const message = settings.session_confirmation_message ?? DEFAULT_MESSAGE;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-blue-600" />
              Confirmação de Sessão
            </CardTitle>
            <CardDescription className="mt-1">
              Envie um lembrete automático antes da sessão agendada
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sc-enabled" className="text-sm">
              {settings.session_confirmation_enabled ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="sc-enabled"
              checked={Boolean(settings.session_confirmation_enabled)}
              onCheckedChange={(v) => onChange({ session_confirmation_enabled: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Enviar com antecedência de</Label>
          <Select
            value={String(settings.session_confirmation_hours_before ?? 24)}
            onValueChange={(v) => onChange({ session_confirmation_hours_before: Number(v) })}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Mensagem</Label>
          <Textarea
            value={message}
            onChange={(e) => onChange({ session_confirmation_message: e.target.value })}
            rows={4}
            placeholder={DEFAULT_MESSAGE}
          />
          <div className="flex flex-wrap gap-1 mt-1">
            {VARIABLES.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-accent"
                onClick={() => onChange({ session_confirmation_message: message + " " + v })}
                title="Clique para inserir no final da mensagem"
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Preview</Label>
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900 whitespace-pre-wrap">
            {renderPreview(message)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
