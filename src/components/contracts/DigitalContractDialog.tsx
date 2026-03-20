import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePad } from "@/components/clinical/SignaturePad";
import { FileCheck, PenLine } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";

// Templates will be loaded from the database

interface DigitalContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  pacienteNome: string;
  pacienteCpf?: string;
}

export function DigitalContractDialog({
  open,
  onOpenChange,
  pacienteId,
  pacienteNome,
  pacienteCpf,
}: DigitalContractDialogProps) {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates", activeClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_templates")
        .select("*")
        .eq("ativo", true)
        .eq("clinic_id", activeClinicId!);
      if (error) throw error;
      return data as Array<{ id: string; nome: string; conteudo: string; tipo: string; ativo: boolean }>;
    },
    enabled: !!activeClinicId,
  });

  const { data: professional } = useQuery({
    queryKey: ["professional-profile", user?.id],
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

  const [templateId, setTemplateId] = useState("");
  const [contractText, setContractText] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [title, setTitle] = useState("Contrato de Prestação de Serviço");
  const [useProfSignature, setUseProfSignature] = useState(false);
  const [useProfRubrica, setUseProfRubrica] = useState(false);

  const applyTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setTemplateId(id);
      setTitle(tpl.nome);
      let text = tpl.conteudo;
      text = text.replace(/{PACIENTE_NOME}/g, pacienteNome);
      text = text.replace(/{PACIENTE_CPF}/g, pacienteCpf || "_______________");
      text = text.replace(/{DATA_CONTRATO}/g, new Date().toLocaleDateString("pt-BR"));
      setContractText(text);
    }
  };

  const saveContract = useMutation({
    mutationFn: async () => {
      if (!user || !activeClinicId) throw new Error("Não autenticado");
      if (!signatureUrl) throw new Error("Assinatura obrigatória");

      const { error } = await supabase.from("contratos_digitais").insert({
        clinic_id: activeClinicId,
        paciente_id: pacienteId,
        titulo: title,
        conteudo: contractText,
        assinatura_url: signatureUrl,
        assinado_em: new Date().toISOString(),
        created_by: user.id,
        profissional_assinatura_id: useProfSignature ? user.id : null,
        profissional_rubrica_id: useProfRubrica ? user.id : null,
        usa_assinatura_profissional: useProfSignature,
        usa_rubrica_profissional: useProfRubrica,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-digitais"] });
      toast({ title: "Contrato assinado e salvo! ✅" });
      onOpenChange(false);
      setContractText("");
      setSignatureUrl("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Contrato Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selection */}
          <div>
            <Label>Modelo de Contrato</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {templates.map((t) => (
                <Badge
                  key={t.id}
                  variant={templateId === t.id ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => applyTemplate(t.id)}
                >
                  {t.nome}
                </Badge>
              ))}
            </div>
          </div>

          {/* Contract title */}
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Contract body */}
          <div>
            <Label>Conteúdo do Contrato</Label>
            <Textarea
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="Selecione um modelo ou escreva o contrato..."
            />
          </div>

          {/* Patient info */}
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <strong>{pacienteNome}</strong>
                {pacienteCpf && <span className="text-muted-foreground ml-2">CPF: {pacienteCpf}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Signature */}
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="mb-2 block font-semibold flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Assinatura do Profissional
              </Label>
              <div className="space-y-2">
                {professional?.assinatura_url ? (
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors border border-transparent hover:border-border">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={useProfSignature}
                      onChange={(e) => setUseProfSignature(e.target.checked)}
                    />
                    <span className="text-sm">Inserir minha assinatura profissional</span>
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Assinatura não cadastrada no perfil.
                  </p>
                )}
                
                {professional?.rubrica_url ? (
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors border border-transparent hover:border-border">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={useProfRubrica}
                      onChange={(e) => setUseProfRubrica(e.target.checked)}
                    />
                    <span className="text-sm">Inserir minha rubrica no carimbo</span>
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Rubrica não cadastrada no perfil.
                  </p>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <Label className="mb-2 block font-semibold flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Assinatura do Paciente (Obrigatória)
              </Label>
              <SignaturePad onSave={setSignatureUrl} />
              {signatureUrl && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ Assinatura capturada</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => saveContract.mutate()}
            disabled={saveContract.isPending || !contractText || !signatureUrl}
          >
            {saveContract.isPending ? "Salvando..." : "Assinar e Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
