import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { PenLine } from "lucide-react";
import { SignaturePad } from "./SignaturePad";
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
import { toast } from "@/modules/shared/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EvaluationFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pacienteId: string;
}

export const EvaluationForm = ({ open, onOpenChange, pacienteId }: EvaluationFormProps) => {
    const { user } = useAuth();
    const { activeClinicId } = useClinic();
    const queryClient = useQueryClient();
    const [assinaturaUrl, setAssinaturaUrl] = useState("");
    const [useProfSignature, setUseProfSignature] = useState(false);

    const { data: professional } = useQuery({
        queryKey: ["professional-profile-eval", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("assinatura_url, rubrica_url, nome")
                .eq("id", user?.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
    });

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

            const { data: evaluation, error: evalError } = await supabase
                .from("evaluations")
                .insert({
                    paciente_id: pacienteId,
                    profissional_id: user.id,
                     clinic_id: activeClinicId,
                    queixa_principal: formData.queixa_principal,
                    historico_doenca: formData.historico_doenca,
                    antecedentes_pessoais: formData.antecedentes_pessoais,
                    objetivos_tratamento: formData.objetivos_tratamento,
                    conduta_inicial: formData.conduta_inicial,
                    data_avaliacao: new Date().toISOString().split("T")[0]
                })
                .select()
                .single();

            if (evalError) throw evalError;

            // 2. Atualizar status e última avaliação do paciente
            const { error: patientErr } = await supabase
                .from("pacientes")
                .update({ 
                    status_clinico: "Avaliado" as any,
                    ultima_avaliacao_data: new Date().toISOString().split("T")[0] as any,
                } as any)
                .eq("id", pacienteId);
            
            if (patientErr) {
                console.error("Erro ao atualizar status do paciente:", patientErr);
                throw patientErr;
            }
            
            return evaluation;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["prontuarios-list"] });
            queryClient.invalidateQueries({ queryKey: ["paciente-detalhes", pacienteId] });
            queryClient.invalidateQueries({ queryKey: ["evaluations", pacienteId] });
            toast({ title: "Avaliação registrada com sucesso!" });
            onOpenChange(false);
            setFormData({
                queixa_principal: "",
                historico_doenca: "",
                antecedentes_pessoais: "",
                objetivos_tratamento: "",
                conduta_inicial: "",
            });
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
            <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Avaliação Inicial / Anamnese</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="space-y-4">
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

                    {/* Assinatura Digital */}
                    <div className="space-y-3 border-t pt-4">
                        <Label className="font-semibold flex items-center gap-2">
                            <PenLine className="h-4 w-4" />
                            Assinatura Digital
                        </Label>
                        {professional?.assinatura_url && (
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border hover:bg-muted/50 transition-colors">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={useProfSignature}
                                    onChange={(e) => setUseProfSignature(e.target.checked)}
                                />
                                <span className="text-sm">Usar assinatura do profissional</span>
                            </label>
                        )}
                        {!useProfSignature && (
                            <>
                                <p className="text-xs text-muted-foreground">Ou desenhe a assinatura abaixo:</p>
                                <SignaturePad onSave={setAssinaturaUrl} />
                                {assinaturaUrl && (
                                    <p className="text-xs text-primary font-medium">✓ Assinatura capturada</p>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="pt-4 border-t sm:justify-end gap-2">
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
