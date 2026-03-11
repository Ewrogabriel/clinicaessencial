import { useState } from "react";
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

const CONTRACT_TEMPLATES = [
  {
    id: "servico",
    label: "Prestação de Serviço",
    content: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Pelo presente instrumento particular, de um lado {CLINICA_NOME}, inscrita no CNPJ {CLINICA_CNPJ}, com sede em {CLINICA_ENDERECO}, doravante denominada CONTRATADA, e de outro lado {PACIENTE_NOME}, portador(a) do CPF {PACIENTE_CPF}, doravante denominado(a) CONTRATANTE, têm entre si justo e contratado o seguinte:

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {MODALIDADE} pela CONTRATADA ao CONTRATANTE.

CLÁUSULA 2ª - DO VALOR E PAGAMENTO
O CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {VALOR}, com vencimento todo dia {DIA_VENCIMENTO} de cada mês.

CLÁUSULA 3ª - DA VIGÊNCIA
O presente contrato tem início em {DATA_INICIO} e vigência por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.

CLÁUSULA 4ª - DAS FALTAS
Em caso de falta sem aviso prévio de 24 horas, a sessão será considerada realizada para fins de cobrança.

CLÁUSULA 5ª - DO FORO
Fica eleito o foro da comarca de {CIDADE} para dirimir eventuais litígios decorrentes deste contrato.

{CIDADE}, {DATA_CONTRATO}

_______________________________
CONTRATADA

_______________________________
CONTRATANTE`,
  },
  {
    id: "plano_sessoes",
    label: "Plano de Sessões",
    content: `CONTRATO DE PLANO DE SESSÕES

CONTRATADA: {CLINICA_NOME} - CNPJ: {CLINICA_CNPJ}
CONTRATANTE: {PACIENTE_NOME} - CPF: {PACIENTE_CPF}

CLÁUSULA 1ª - O CONTRATANTE adquire um plano de {TOTAL_SESSOES} sessões de {MODALIDADE}.

CLÁUSULA 2ª - O valor total do plano é de R$ {VALOR}, podendo ser pago em até {PARCELAS}x.

CLÁUSULA 3ª - As sessões devem ser utilizadas no prazo de {VALIDADE_MESES} meses a partir da data de início.

CLÁUSULA 4ª - Sessões não utilizadas no prazo não serão reembolsadas.

CLÁUSULA 5ª - O cancelamento antes do término resulta na cobrança proporcional das sessões utilizadas pelo valor unitário de R$ {VALOR_UNITARIO}.

{CIDADE}, {DATA_CONTRATO}

_______________________________
CONTRATADA

_______________________________
CONTRATANTE`,
  },
];

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

  const [templateId, setTemplateId] = useState("servico");
  const [contractText, setContractText] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [title, setTitle] = useState("Contrato de Prestação de Serviço");

  const applyTemplate = (id: string) => {
    const tpl = CONTRACT_TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      setTemplateId(id);
      setTitle(tpl.label);
      let text = tpl.content;
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
              {CONTRACT_TEMPLATES.map((t) => (
                <Badge
                  key={t.id}
                  variant={templateId === t.id ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => applyTemplate(t.id)}
                >
                  {t.label}
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
          <div>
            <Label className="mb-2 block">Assinatura do Paciente</Label>
            <SignaturePad onSave={setSignatureUrl} />
            {signatureUrl && (
              <p className="text-xs text-green-600 font-medium mt-1">✓ Assinatura capturada</p>
            )}
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
