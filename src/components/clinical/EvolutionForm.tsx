import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
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
import { toast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";

const EVOLUTION_TEMPLATES = [
  {
    label: "Sessão Padrão",
    descricao: "Paciente realizou sessão de tratamento conforme protocolo estabelecido. Boa adesão aos exercícios propostos. Sem queixas álgicas durante a execução.",
    conduta: "Manter protocolo atual. Progredir carga/repetições na próxima sessão conforme tolerância.",
  },
  {
    label: "Reavaliação",
    descricao: "Realizada reavaliação funcional. Paciente apresenta melhora em relação à avaliação anterior nos seguintes parâmetros: amplitude de movimento, força muscular e funcionalidade.",
    conduta: "Atualizar protocolo de tratamento conforme novos achados. Reavaliar em 30 dias.",
  },
  {
    label: "Alta / Última Sessão",
    descricao: "Paciente atingiu os objetivos terapêuticos propostos. Apresenta independência funcional para atividades de vida diária. Orientado sobre manutenção dos ganhos em domicílio.",
    conduta: "Alta do tratamento. Orientações domiciliares entregues. Retorno preventivo em 3 meses.",
  },
  {
    label: "Falta / Não Compareceu",
    descricao: "Paciente não compareceu à sessão agendada. Tentativa de contato realizada.",
    conduta: "Reagendar sessão. Reforçar importância da regularidade no tratamento.",
  },
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

    const evolutionMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Usuário não autenticado");

            const { error } = await (supabase.from("evolutions") as any).insert({
                clinic_id: activeClinicId,
                paciente_id: pacienteId,
                profissional_id: user.id,
                descricao,
                conduta,
                data_evolucao: new Date().toISOString(),
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["evolucoes", pacienteId] });
            toast({ title: "Evolução registrada com sucesso!" });
            setDescricao("");
            setConduta("");
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao registrar evolução",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!descricao) {
            toast({ title: "A descrição é obrigatória", variant: "destructive" });
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
            <DialogContent className="sm:max-w-[560px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Evoluir Sessão</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Templates */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Templates Rápidos
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {EVOLUTION_TEMPLATES.map((t) => (
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
                        <div className="space-y-2">
                            <Label htmlFor="descricao">Descrição do Atendimento *</Label>
                            <Textarea
                                id="descricao"
                                placeholder="Descreva o que foi realizado na sessão..."
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                rows={5}
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
