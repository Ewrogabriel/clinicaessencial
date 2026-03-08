import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface PlanoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlano: any | null;
  pacientes: { id: string; nome: string }[];
  modalidades: { id: string; nome: string }[];
  userId: string;
}

const defaultForm = {
  paciente_id: "",
  tipo_atendimento: "",
  total_sessoes: 10,
  valor: "",
  data_inicio: format(new Date(), "yyyy-MM-dd"),
  data_vencimento: "",
  observacoes: "",
  status: "ativo",
};

export const PlanoFormDialog = ({ open, onOpenChange, editPlano, pacientes, modalidades, userId }: PlanoFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEdit = !!editPlano;

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (editPlano) {
      setFormData({
        paciente_id: editPlano.paciente_id,
        tipo_atendimento: editPlano.tipo_atendimento,
        total_sessoes: editPlano.total_sessoes,
        valor: String(editPlano.valor),
        data_inicio: editPlano.data_inicio,
        data_vencimento: editPlano.data_vencimento || "",
        observacoes: editPlano.observacoes || "",
        status: editPlano.status,
      });
    } else {
      setFormData(defaultForm);
    }
  }, [editPlano, open]);

  const savePlano = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      
      if (isEdit) {
        const { error } = await supabase.from("planos").update({
          tipo_atendimento: formData.tipo_atendimento,
          total_sessoes: formData.total_sessoes,
          valor: parseFloat(formData.valor) || 0,
          data_inicio: formData.data_inicio,
          data_vencimento: formData.data_vencimento || null,
          observacoes: formData.observacoes || null,
          status: formData.status as any,
        }).eq("id", editPlano.id);
        if (error) throw error;
      } else {
        const { data: plano, error: planoError } = await supabase.from("planos").insert({
          paciente_id: formData.paciente_id,
          profissional_id: userId,
          tipo_atendimento: formData.tipo_atendimento,
          total_sessoes: formData.total_sessoes,
          valor: parseFloat(formData.valor) || 0,
          data_inicio: formData.data_inicio,
          data_vencimento: formData.data_vencimento || null,
          observacoes: formData.observacoes || null,
          created_by: userId,
        }).select().single();

        if (planoError) throw planoError;

        const { error: pgtoError } = await supabase.from("pagamentos").insert({
          paciente_id: formData.paciente_id,
          profissional_id: userId,
          plano_id: plano.id,
          valor: parseFloat(formData.valor) || 0,
          data_vencimento: formData.data_vencimento || null,
          status: "pendente",
          descricao: `Plano ${formData.tipo_atendimento} - ${formData.total_sessoes} sessões`,
          created_by: userId,
        });
        if (pgtoError) throw pgtoError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      onOpenChange(false);
      toast({ title: isEdit ? "Plano atualizado!" : "Plano criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Plano" : "Novo Plano de Sessões"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Paciente</Label>
            <Select
              value={formData.paciente_id}
              onValueChange={(v) => setFormData(p => ({ ...p, paciente_id: v }))}
              disabled={isEdit}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Modalidade</Label>
              <Select value={formData.tipo_atendimento} onValueChange={(v) => setFormData(p => ({ ...p, tipo_atendimento: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {modalidades.map((mod) => (
                    <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Qtd. Sessões</Label>
              <Select value={String(formData.total_sessoes)} onValueChange={(v) => setFormData(p => ({ ...p, total_sessoes: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 sessões</SelectItem>
                  <SelectItem value="10">10 sessões</SelectItem>
                  <SelectItem value="15">15 sessões</SelectItem>
                  <SelectItem value="20">20 sessões</SelectItem>
                  <SelectItem value="30">30 sessões</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={formData.valor} onChange={(e) => setFormData(p => ({ ...p, valor: e.target.value }))} />
            </div>
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={formData.data_inicio} onChange={(e) => setFormData(p => ({ ...p, data_inicio: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Data de Vencimento (opcional)</Label>
            <Input type="date" value={formData.data_vencimento} onChange={(e) => setFormData(p => ({ ...p, data_vencimento: e.target.value }))} />
          </div>
          {isEdit && (
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea placeholder="Observações sobre o plano..." value={formData.observacoes} onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => savePlano.mutate()} disabled={(!isEdit && !formData.paciente_id) || savePlano.isPending}>
              {savePlano.isPending ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Plano"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
