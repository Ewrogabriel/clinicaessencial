import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EvaluationFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pacienteId: string;
}

export const EvaluationForm = ({ open, onOpenChange, pacienteId }: EvaluationFormProps) => {
    const { user, clinicId } = useAuth();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        queixa_principal: "",
        historico_doenca: "",
        antecedentes_pessoais: "",
        objetivos_tratamento: "",
        conduta_inicial: "",
    });

    const evaluationMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Usuário não autenticado");

            const { error } = await (supabase.from("evaluations") as any).insert({
                clinic_id: user.id,
                paciente_id: pacienteId,
                profissional_id: user.id,
                ...formData,
                data_avaliacao: new Date().toISOString(),
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["avaliacao", pacienteId] });
            toast({ title: "Avaliação registrada com sucesso!" });
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao registrar avaliação",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        evaluationMutation.mutate();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Avaliação Inicial / Anamnese</DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-hidden">
                        <div className="space-y-4 py-4 pr-4">
                            <div className="space-y-2">
                                <Label htmlFor="queixa_principal">Queixa Principal *</Label>
                                <Textarea
                                    id="queixa_principal"
                                    placeholder="O que trouxe o paciente à clínica?"
                                    value={formData.queixa_principal}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="historico_doenca">Histórico da Doença Atual (HDA)</Label>
                                <Textarea
                                    id="historico_doenca"
                                    placeholder="Início dos sintomas, evolução..."
                                    value={formData.historico_doenca}
                                    onChange={handleChange}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="antecedentes_pessoais">Antecedentes Pessoais / Comorbidades</Label>
                                <Textarea
                                    id="antecedentes_pessoais"
                                    placeholder="Diabetes, hipertensão, cirurgias anteriores..."
                                    value={formData.antecedentes_pessoais}
                                    onChange={handleChange}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="objetivos_tratamento">Objetivos do Tratamento</Label>
                                <Textarea
                                    id="objetivos_tratamento"
                                    placeholder="O que o paciente espera alcançar?"
                                    value={formData.objetivos_tratamento}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="conduta_inicial">Conduta Inicial / Plano Terapêutico</Label>
                                <Textarea
                                    id="conduta_inicial"
                                    placeholder="Quais técnicas serão utilizadas inicialmente?"
                                    value={formData.conduta_inicial}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="shrink-0 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={evaluationMutation.isPending}>
                            {evaluationMutation.isPending ? "Salvando..." : "Salvar Avaliação"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
