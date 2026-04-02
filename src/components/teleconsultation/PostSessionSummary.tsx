import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Clock, FileText, Sparkles, Loader2, Download, X, User,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PostSessionSummaryProps {
  session: any;
  onClose: () => void;
  onSave: (summary: string) => void;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}min`;
  }
  return `${m}min ${s}s`;
}

export function PostSessionSummary({ session, onClose, onSave }: PostSessionSummaryProps) {
  const [summary, setSummary] = useState<string>(session.resumo_clinico ?? "");
  const [notes, setNotes] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const patientName: string = session.pacientes?.nome ?? "Paciente";
  const startedAt: string | null = session.started_at ?? null;
  const durationSeconds: number | null = session.duration_seconds ?? null;

  const generateAISummary = async () => {
    if (!session.transcricao_bruta) {
      toast.error("Sem transcrição disponível para gerar resumo.");
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-teleconsulta", {
        body: { sessionId: session.id, transcricao: session.transcricao_bruta },
      });
      if (error) throw error;
      setSummary(data?.summary ?? data?.resumo ?? "");
      toast.success("Resumo gerado com IA!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar resumo com IA");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    const combined = [summary, notes].filter(Boolean).join("\n\n---\n\n");
    setIsSaving(true);
    try {
      onSave(combined);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    toast.info("Exportação para PDF em breve disponível.");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Sessão Encerrada</h3>
            <p className="text-xs text-muted-foreground">Finalize o atendimento e salve o resumo</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Session info */}
      <Card className="bg-muted/40">
        <CardContent className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Paciente</p>
              <p className="text-sm font-medium truncate">{patientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Duração</p>
              <p className="text-sm font-medium">{formatDuration(durationSeconds)}</p>
            </div>
          </div>
          {startedAt && (
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-medium">
                  {format(new Date(startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* AI Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Resumo Clínico (IA)</Label>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={generateAISummary}
            disabled={isGenerating || !session.transcricao_bruta}
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 text-primary" />
            )}
            {isGenerating ? "Gerando..." : "Gerar com IA"}
          </Button>
        </div>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Resumo clínico da consulta... (pode ser gerado automaticamente com IA se houver transcrição)"
          className="min-h-[120px] text-sm"
        />
        {!session.transcricao_bruta && (
          <p className="text-xs text-muted-foreground">
            ⚠️ Nenhuma transcrição disponível — o resumo por IA requer transcrição ativa.
          </p>
        )}
      </div>

      {/* Additional notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Prescrição / Observações Adicionais</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Prescrições, encaminhamentos, orientações ao paciente..."
          className="min-h-[100px] text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap justify-between">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExportPDF}
        >
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar sem salvar
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar Resumo
          </Button>
        </div>
      </div>
    </div>
  );
}
