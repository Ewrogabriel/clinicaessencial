import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, AlertCircle, RotateCcw, MessageSquare, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PoliticasCancelamento = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { data: politica, isLoading } = useQuery({
    queryKey: ["politicas-cancelamento", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase
        .from("politicas_cancelamento")
        .select("*")
        .eq("clinica_id", user.id)
        .single() as any);
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const [formData, setFormData] = useState<any>({
    tempo_cancelamento_com_justificativa: politica?.tempo_cancelamento_com_justificativa ?? 3,
    tempo_minimo_reagendamento: politica?.tempo_minimo_reagendamento ?? 2,
    tempo_remarcacao_cancelada: politica?.tempo_remarcacao_cancelada ?? 30,
    tempo_cancelamento_sem_justificativa: politica?.tempo_cancelamento_sem_justificativa ?? 24,
    limite_cancelamentos_mes: politica?.limite_cancelamentos_mes ?? 2,
    taxa_cancelamento_extra: politica?.taxa_cancelamento_extra ?? 0,
    cancelamento_reduz_mensalidade: politica?.cancelamento_reduz_mensalidade ?? false,
    gera_reposicao_automatica: politica?.gera_reposicao_automatica ?? true,
    tempo_resposta_remarcacao: politica?.tempo_resposta_remarcacao ?? 7,
  });

  const updatePolitica = useMutation({
    mutationFn: async () => {
      if (!user || !politica) throw new Error("Dados incompletos");

      const { error } = await (supabase
        .from("politicas_cancelamento")
        .update(formData)
        .eq("id", politica.id) as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Políticas atualizadas com sucesso!" });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["politicas-cancelamento"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    }
  });

  const resetToDefault = useMutation({
    mutationFn: async () => {
      const defaults = {
        tempo_cancelamento_com_justificativa: 3,
        tempo_minimo_reagendamento: 2,
        tempo_remarcacao_cancelada: 30,
        tempo_cancelamento_sem_justificativa: 24,
        limite_cancelamentos_mes: 2,
        taxa_cancelamento_extra: 0,
        cancelamento_reduz_mensalidade: false,
        gera_reposicao_automatica: true,
        tempo_resposta_remarcacao: 7,
      };
      
      if (!user || !politica) throw new Error("Dados incompletos");
      
      const { error } = await (supabase
        .from("politicas_cancelamento")
        .update(defaults)
        .eq("id", politica.id) as any);
      
      if (error) throw error;
      setFormData(defaults);
    },
    onSuccess: () => {
      toast({ title: "Políticas restauradas para padrão!" });
      setResetConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["politicas-cancelamento"] });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (!isAdmin) {
    return <div className="flex items-center justify-center h-screen">Acesso negado</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Políticas de Cancelamento</h1>
        <p className="text-muted-foreground">Configure as regras de cancelamento para sua clínica</p>
      </div>

      {/* Cards informativos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Cancelamento com Justificativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formData.tempo_cancelamento_com_justificativa}</p>
            <p className="text-xs text-muted-foreground">horas antes da sessão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-green-600" />
              Reagendamento Mínimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formData.tempo_minimo_reagendamento}</p>
            <p className="text-xs text-muted-foreground">horas antes da sessão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Remarcação Cancelada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formData.tempo_remarcacao_cancelada}</p>
            <p className="text-xs text-muted-foreground">dias para reagendar</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulário de configuração */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configurações Detalhadas</CardTitle>
              <CardDescription>Ajuste todas as políticas de cancelamento</CardDescription>
            </div>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)}>Editar</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seção 1: Prazos de Cancelamento */}
          <div className="space-y-4 pb-6 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Prazos de Cancelamento
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="tempo_cancelamento_com_justificativa">
                  Cancelamento COM Justificativa (horas)
                </Label>
                <Input
                  id="tempo_cancelamento_com_justificativa"
                  type="number"
                  value={formData.tempo_cancelamento_com_justificativa}
                  onChange={(e) => setFormData({ ...formData, tempo_cancelamento_com_justificativa: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Tempo mínimo antes da sessão para cancelar com justificativa</p>
              </div>

              <div>
                <Label htmlFor="tempo_cancelamento_sem_justificativa">
                  Cancelamento SEM Justificativa (horas)
                </Label>
                <Input
                  id="tempo_cancelamento_sem_justificativa"
                  type="number"
                  value={formData.tempo_cancelamento_sem_justificativa}
                  onChange={(e) => setFormData({ ...formData, tempo_cancelamento_sem_justificativa: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Tempo mínimo para cancelar sem justificativa</p>
              </div>
            </div>
          </div>

          {/* Seção 2: Reagendamento */}
          <div className="space-y-4 pb-6 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Regras de Reagendamento
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="tempo_minimo_reagendamento">
                  Reagendamento Mínimo (horas)
                </Label>
                <Input
                  id="tempo_minimo_reagendamento"
                  type="number"
                  value={formData.tempo_minimo_reagendamento}
                  onChange={(e) => setFormData({ ...formData, tempo_minimo_reagendamento: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Tempo mínimo antes da sessão para reagendar</p>
              </div>

              <div>
                <Label htmlFor="tempo_remarcacao_cancelada">
                  Prazo para Remarcação (dias)
                </Label>
                <Input
                  id="tempo_remarcacao_cancelada"
                  type="number"
                  value={formData.tempo_remarcacao_cancelada}
                  onChange={(e) => setFormData({ ...formData, tempo_remarcacao_cancelada: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Dias disponíveis para remarcar uma sessão cancelada</p>
              </div>

              <div>
                <Label htmlFor="tempo_resposta_remarcacao">
                  Prazo de Resposta para Remarcação (dias)
                </Label>
                <Input
                  id="tempo_resposta_remarcacao"
                  type="number"
                  value={formData.tempo_resposta_remarcacao}
                  onChange={(e) => setFormData({ ...formData, tempo_resposta_remarcacao: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Dias que o paciente tem para responder uma solicitação de remarcação</p>
              </div>
            </div>
          </div>

          {/* Seção 3: Limites e Taxas */}
          <div className="space-y-4 pb-6 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Limites e Taxas
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="limite_cancelamentos_mes">
                  Limite de Cancelamentos/Mês
                </Label>
                <Input
                  id="limite_cancelamentos_mes"
                  type="number"
                  value={formData.limite_cancelamentos_mes}
                  onChange={(e) => setFormData({ ...formData, limite_cancelamentos_mes: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Cancelamentos permitidos antes de incidência de taxa</p>
              </div>

              <div>
                <Label htmlFor="taxa_cancelamento_extra">
                  Taxa Extra de Cancelamento (%)
                </Label>
                <Input
                  id="taxa_cancelamento_extra"
                  type="number"
                  value={formData.taxa_cancelamento_extra}
                  onChange={(e) => setFormData({ ...formData, taxa_cancelamento_extra: parseFloat(e.target.value) })}
                  disabled={!isEditing}
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground mt-1">Porcentagem da sessão cobrada para cancelamentos acima do limite</p>
              </div>
            </div>
          </div>

          {/* Seção 4: Políticas */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Políticas Gerais
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium">Cancelamento reduz mensalidade?</p>
                  <p className="text-sm text-muted-foreground">Se desativado, mensalidade não é reduzida por cancelamento</p>
                </div>
                {isEditing ? (
                  <Switch
                    checked={formData.cancelamento_reduz_mensalidade}
                    onCheckedChange={(value) => setFormData({ ...formData, cancelamento_reduz_mensalidade: value })}
                  />
                ) : (
                  <div className="text-sm font-medium">
                    {formData.cancelamento_reduz_mensalidade ? "Sim" : "Não"}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium">Gerar reposição automática?</p>
                  <p className="text-sm text-muted-foreground">Se ativado, uma nova sessão é criada quando o paciente cancela</p>
                </div>
                {isEditing ? (
                  <Switch
                    checked={formData.gera_reposicao_automatica}
                    onCheckedChange={(value) => setFormData({ ...formData, gera_reposicao_automatica: value })}
                  />
                ) : (
                  <div className="text-sm font-medium">
                    {formData.gera_reposicao_automatica ? "Sim" : "Não"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          {isEditing && (
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    tempo_cancelamento_com_justificativa: politica?.tempo_cancelamento_com_justificativa ?? 3,
                    tempo_minimo_reagendamento: politica?.tempo_minimo_reagendamento ?? 2,
                    tempo_remarcacao_cancelada: politica?.tempo_remarcacao_cancelada ?? 30,
                    tempo_cancelamento_sem_justificativa: politica?.tempo_cancelamento_sem_justificativa ?? 24,
                    limite_cancelamentos_mes: politica?.limite_cancelamentos_mes ?? 2,
                    taxa_cancelamento_extra: politica?.taxa_cancelamento_extra ?? 0,
                    cancelamento_reduz_mensalidade: politica?.cancelamento_reduz_mensalidade ?? false,
                    gera_reposicao_automatica: politica?.gera_reposicao_automatica ?? true,
                    tempo_resposta_remarcacao: politica?.tempo_resposta_remarcacao ?? 7,
                  });
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetConfirm(true)}
              >
                Restaurar Padrão
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => updatePolitica.mutate()}
                disabled={updatePolitica.isPending}
              >
                {updatePolitica.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de reset */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso restaurará todas as políticas para as configurações padrão. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetToDefault.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PoliticasCancelamento;
