import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Brain, Loader2 } from "lucide-react";
import { SignaturePad } from "./SignaturePad";
import { toast } from "sonner";

// Static fallback (used if DB has no templates yet)
const FALLBACK_TEMPLATES = [
  { label: "Sessão Padrão", descricao: "Paciente realizou sessão de tratamento conforme protocolo estabelecido. Boa adesão aos exercícios propostos. Sem queixas álgicas durante a execução.", conduta: "Manter protocolo atual. Progredir carga/repetições na próxima sessão conforme tolerância." },
  { label: "Reavaliação", descricao: "Realizada reavaliação funcional. Paciente apresenta melhora em relação à avaliação anterior nos seguintes parâmetros: amplitude de movimento, força muscular e funcionalidade.", conduta: "Atualizar protocolo de tratamento conforme novos achados. Reavaliar em 30 dias." },
  { label: "Alta / Última Sessão", descricao: "Paciente atingiu os objetivos terapêuticos propostos. Apresenta independência funcional para atividades de vida diária. Orientado sobre manutenção dos ganhos em domicílio.", conduta: "Alta do tratamento. Orientações domiciliares entregues. Retorno preventivo em 3 meses." },
  { label: "Falta / Não Compareceu", descricao: "Paciente não compareceu à sessão agendada. Tentativa de contato realizada.", conduta: "Reagendar sessão. Reforçar importância da regularidade no tratamento." },
];

interface EvolutionFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pacienteId: string;
}

export const EvolutionForm = ({ open, onOpenChange, pacienteId }: EvolutionFormProps) => {
    const { user } = useAuth();
    const { activeClinicId } = useClinic();
    const queryClient = useQueryClient();
    const [descricao, setDescricao] = useState("");
    const [conduta, setConduta] = useState("");
    const [assinaturaUrl, setAssinaturaUrl] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    // Load templates dynamically from DB
    const { data: dbTemplates } = useQuery({
        queryKey: ["evolution-templates", activeClinicId],
        queryFn: async () => {
            if (!activeClinicId) return FALLBACK_TEMPLATES;
            const { data, error } = await (supabase as any)
                .from("evolution_templates")
                .select("label, descricao, conduta")
                .or(`clinic_id.eq.${activeClinicId},is_default.eq.true`)
                .order("is_default", { ascending: false })
                .order("label");
            if (error || !data || data.length === 0) return FALLBACK_TEMPLATES;
            return data as { label: string; descricao: string; conduta: string }[];
        },
        staleTime: 1000 * 60 * 10,
    });

    const templates = dbTemplates ?? FALLBACK_TEMPLATES;

    // Fetch patient data for AI context
    const { data: paciente } = useQuery({
        queryKey: ["paciente-evol", pacienteId],
        queryFn: async () => {
            const { data } = await supabase.from("pacientes").select("tipo_atendimento").eq("id", pacienteId).single();
            return data;
        },
        enabled: !!pacienteId && open,
    });

    const { data: prevEvolutions = [] } = useQuery({
        queryKey: ["evolucoes-prev", pacienteId],
        queryFn: async () => {
            const { data } = await supabase.from("evolutions")
                .select("descricao, conduta, data_evolucao")
                .eq("paciente_id", pacienteId)
                .order("data_evolucao", { ascending: false })
                .limit(10);
            return data || [];
        },
        enabled: !!pacienteId && open,
    });

    const { data: evaluation } = useQuery({
        queryKey: ["avaliacao-evol", pacienteId],
        queryFn: async () => {
            const { data } = await supabase.from("evaluations")
                .select("queixa_principal, historico_doenca, antecedentes_pessoais, objetivos_tratamento, conduta_inicial")
                .eq("paciente_id", pacienteId)
                .order("data_avaliacao", { ascending: false })
                .limit(1)
                .maybeSingle();
            return data;
        },
        enabled: !!pacienteId && open,
    });

    const { data: attachments = [] } = useQuery({
        queryKey: ["attachments-evol", pacienteId],
        queryFn: async () => {
            const { data } = await supabase.from("patient_attachments")
                .select("file_name, file_type, descricao")
                .eq("paciente_id", pacienteId)
                .limit(20);
            return data || [];
        },
        enabled: !!pacienteId && open,
    });

    const suggestWithAI = async () => {
        setAiLoading(true);
        try {
            const evolutionsText = prevEvolutions
                .map((e: any) => `[${e.data_evolucao?.split("T")[0]}] ${e.descricao}${e.conduta ? `\nConduta: ${e.conduta}` : ""}`)
                .join("\n\n");

            const evaluationText = evaluation
                ? `Queixa: ${evaluation.queixa_principal}\nHistórico: ${evaluation.historico_doenca || "N/A"}\nAntecedentes: ${evaluation.antecedentes_pessoais || "N/A"}\nObjetivos: ${evaluation.objetivos_tratamento || "N/A"}\nConduta Inicial: ${evaluation.conduta_inicial || "N/A"}`
                : "";

            const attachmentsInfo = attachments.length > 0
                ? attachments.map((a: any) => `- ${a.file_name}${a.descricao ? ` — ${a.descricao}` : ""}`).join("\n")
                : "";

            const { data, error } = await supabase.functions.invoke("ai-clinical", {
                body: {
                    paciente_id: pacienteId,
                    evolutions_text: evolutionsText,
                    evaluation_text: evaluationText,
                    action: "suggest_evolution",
                    modalidade: paciente?.tipo_atendimento || "",
                    attachments_info: attachmentsInfo,
                },
            });

            if (error) throw error;

            // Try to parse JSON response
            const resultText = data.result || "";
            try {
                // Clean potential markdown code blocks
                const cleaned = resultText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.descricao) setDescricao(parsed.descricao);
                if (parsed.conduta) setConduta(parsed.conduta);
                toast.success("Sugestão de evolução gerada pela IA!", { description: "Revise e ajuste conforme necessário antes de salvar." });
            } catch {
                // If not JSON, put it all in descricao
                setDescricao(resultText);
                toast.success("Sugestão gerada pela IA!", { description: "Revise o texto antes de salvar." });
            }
        } catch (err: any) {
            toast.error("Erro ao gerar sugestão", { description: err.message });
        } finally {
            setAiLoading(false);
        }
    };

    const evolutionMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Usuário não autenticado");

            const { error } = await supabase.from("evolutions").insert({
                clinic_id: activeClinicId,
                paciente_id: pacienteId,
                profissional_id: user.id,
                descricao,
                conduta,
                assinatura_url: assinaturaUrl || null,
                data_evolucao: new Date().toISOString(),
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["evolucoes", pacienteId] });
            queryClient.invalidateQueries({ queryKey: ["evolucoes-ai", pacienteId] });
            toast.success("Evolução registrada com sucesso!");
            setDescricao("");
            setConduta("");
            setAssinaturaUrl("");
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast.error("Erro ao registrar evolução", { description: error.message });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!descricao) {
            toast.error("A descrição é obrigatória");
            return;
        }
        evolutionMutation.mutate();
    };

    const applyTemplate = (template: typeof EVOLUTION_TEMPLATES[0]) => {
        setDescricao(template.descricao);
        setConduta(template.conduta);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Evoluir Sessão</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Templates + AI */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Templates Rápidos
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {templates.map((t) => (
                                    <Badge
                                        key={t.label}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                        onClick={() => applyTemplate(t)}
                                    >
                                        {t.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* AI Suggestion Button */}
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full gap-2"
                            onClick={suggestWithAI}
                            disabled={aiLoading}
                        >
                            {aiLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Brain className="h-4 w-4" />
                            )}
                            {aiLoading ? "Gerando sugestão com IA..." : "🤖 Sugestão de Evolução por IA"}
                        </Button>
                        {aiLoading && (
                            <p className="text-xs text-muted-foreground text-center animate-pulse">
                                Analisando prontuário, evoluções anteriores e documentos...
                            </p>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="descricao">Descrição do Atendimento *</Label>
                            <Textarea
                                id="descricao"
                                placeholder="Descreva o que foi realizado na sessão..."
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                rows={6}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="conduta">Próximos Passos / Conduta</Label>
                            <Textarea
                                id="conduta"
                                placeholder="Plano para a próxima sessão..."
                                value={conduta}
                                onChange={(e) => setConduta(e.target.value)}
                                rows={3}
                            />
                        </div>
                        {/* Digital Signature */}
                        <SignaturePad onSave={setAssinaturaUrl} />
                        {assinaturaUrl && (
                            <p className="text-xs text-primary font-medium">✓ Assinatura capturada</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={evolutionMutation.isPending}>
                            {evolutionMutation.isPending ? "Salvando..." : "Salvar Evolução"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
