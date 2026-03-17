import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2, FileText } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  tipo: string;
}

export const ContractTemplatesTab = ({ clinicId }: { clinicId: string }) => {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-templates", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_templates")
        .select("*")
        .eq("clinic_id", clinicId);
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!clinicId,
  });

  const saveMutation = useMutation({
    mutationFn: async (template: Partial<Template>) => {
      if (template.id) {
        const { error } = await supabase
          .from("contrato_templates")
          .update(template)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contrato_templates")
          .insert({ ...template, clinic_id: clinicId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      setEditingTemplate(null);
      toast({ title: "Template salvo com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contrato_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      toast({ title: "Template excluído." });
    },
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Modelos de Contratos</h3>
        <Button onClick={() => setEditingTemplate({ nome: "", conteudo: "", tipo: "paciente" })}>
          <Plus className="h-4 w-4 mr-2" /> Novo Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setEditingTemplate(tpl)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold truncate">{tpl.nome}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground capitalize">{tpl.tipo}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingTemplate && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{editingTemplate.id ? "Editar Template" : "Novo Template"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input value={editingTemplate.nome} onChange={(e) => setEditingTemplate({ ...editingTemplate, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editingTemplate.tipo} onValueChange={(v) => setEditingTemplate({ ...editingTemplate, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paciente">Paciente</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo (Use placeholders: {"{PACIENTE_NOME}"}, {"{PACIENTE_CPF}"}, {"{CLINICA_NOME}"})</Label>
              <Textarea rows={15} value={editingTemplate.conteudo} onChange={(e) => setEditingTemplate({ ...editingTemplate, conteudo: e.target.value })} className="font-mono text-sm" />
            </div>
            <div className="flex justify-between">
              {editingTemplate.id && (
                <Button variant="destructive" onClick={() => { if(confirm("Excluir?")) deleteMutation.mutate(editingTemplate.id!) }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate(editingTemplate)}>
                  <Save className="h-4 w-4 mr-2" /> Salvar Template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
