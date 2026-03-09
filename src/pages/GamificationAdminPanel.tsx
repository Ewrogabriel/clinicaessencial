import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Plus, Edit2, Trash2, Target, Trophy, Star, Users, User, Calendar, Activity, DollarSign, Clock, CheckCircle, TrendingUp, Dumbbell } from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// METRIC DEFINITIONS — linked to real system data
// ─────────────────────────────────────────────────────────────
const SYSTEM_METRICS = [
  {
    value: "sessoes_realizadas",
    label: "Sessões Realizadas",
    description: "Contagem de agendamentos com status 'realizado'",
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    unit: "sessões",
  },
  {
    value: "checkins_profissional",
    label: "Check-ins do Profissional",
    description: "Check-ins confirmados pelo profissional na agenda",
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    unit: "check-ins",
  },
  {
    value: "novos_pacientes",
    label: "Novos Pacientes Atendidos",
    description: "Pacientes distintos atendidos pela primeira vez",
    icon: <User className="h-4 w-4 text-purple-500" />,
    unit: "pacientes",
  },
  {
    value: "presenca_consecutiva",
    label: "Dias de Presença Consecutiva",
    description: "Sequência de dias com ao menos 1 sessão realizada",
    icon: <Activity className="h-4 w-4 text-orange-500" />,
    unit: "dias",
  },
  {
    value: "faturamento_mes",
    label: "Faturamento do Mês (R$)",
    description: "Soma do valor_sessao dos agendamentos realizados",
    icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
    unit: "R$",
  },
  {
    value: "avaliacoes_realizadas",
    label: "Avaliações Realizadas",
    description: "Fichas de avaliação clínica criadas pelo profissional",
    icon: <TrendingUp className="h-4 w-4 text-indigo-500" />,
    unit: "avaliações",
  },
  {
    value: "evolucoes_registradas",
    label: "Evoluções Registradas",
    description: "Prontuários de evolução preenchidos no período",
    icon: <Dumbbell className="h-4 w-4 text-rose-500" />,
    unit: "evoluções",
  },
  {
    value: "sessoes_paciente",
    label: "Sessões Completadas (Paciente)",
    description: "Quantidade de sessões realizadas pelo paciente",
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    unit: "sessões",
  },
  {
    value: "checkins_paciente",
    label: "Check-ins do Paciente",
    description: "Confirmações de presença feitas pelo próprio paciente",
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    unit: "check-ins",
  },
  {
    value: "indicacoes_paciente",
    label: "Indicações de Novos Pacientes",
    description: "Novos pacientes cadastrados por indicação",
    icon: <Users className="h-4 w-4 text-violet-500" />,
    unit: "indicações",
  },
];

const PROF_METRICS = SYSTEM_METRICS.filter(
  (m) => !["sessoes_paciente", "checkins_paciente", "indicacoes_paciente"].includes(m.value)
);
const PATIENT_METRICS = SYSTEM_METRICS.filter((m) =>
  ["sessoes_paciente", "checkins_paciente", "indicacoes_paciente", "presenca_consecutiva"].includes(m.value)
);

function getMetricInfo(value: string) {
  return SYSTEM_METRICS.find((m) => m.value === value);
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Goal {
  id?: string;
  titulo: string;
  descricao?: string;
  tipo?: string;
  meta_tipo: string;
  meta_valor?: number;
  pontos_recompensa?: number;
  data_inicio?: string;
  data_fim?: string;
  ativo?: boolean;
  created_by: string;
  target_user_id?: string | null;
}

interface Challenge {
  id?: string;
  titulo: string;
  descricao: string;
  icone: string;
  tipo: "profissional" | "paciente";
  metric_type: string;
  meta: { target: number; metric: string };
  pontos_recompensa: number;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
}

const emptyGoal: Goal = {
  titulo: "",
  descricao: "",
  tipo: "individual",
  meta_tipo: "sessoes_realizadas",
  meta_valor: 10,
  pontos_recompensa: 100,
  data_inicio: "",
  data_fim: "",
  ativo: true,
  created_by: "",
  target_user_id: null,
};

const emptyChallenge: Challenge = {
  titulo: "",
  descricao: "",
  icone: "🎯",
  tipo: "profissional",
  metric_type: "sessoes_realizadas",
  meta: { target: 10, metric: "sessoes_realizadas" },
  pontos_recompensa: 100,
  data_inicio: "",
  data_fim: "",
  ativo: true,
};

const CHALLENGE_ICONS = ["🎯", "🏆", "⭐", "🔥", "💪", "🌟", "🏅", "🚀", "💎", "🎖️"];

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function GamificationAdminPanel() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("goals");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [goalForm, setGoalForm] = useState<Goal>(emptyGoal);
  const [challengeForm, setChallengeForm] = useState<Challenge>(emptyChallenge);

  const { data: goals = [] } = useQuery({
    queryKey: ["professional-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["challenges-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-for-goals"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["profissional", "admin"]);
      const userIds = (roles || []).map((r) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds)
        .order("nome");
      return profiles || [];
    },
  });

  // ── Mutations ───────────────────────────────────────────────
  const saveGoalMutation = useMutation({
    mutationFn: async (goalData: Goal) => {
      const goal = {
        titulo: goalData.titulo,
        descricao: goalData.descricao,
        tipo: goalData.tipo,
        meta_tipo: goalData.meta_tipo,
        meta_valor: goalData.meta_valor ?? 0,
        pontos_recompensa: goalData.pontos_recompensa ?? 0,
        data_inicio: goalData.data_inicio || null,
        data_fim: goalData.data_fim || null,
        ativo: goalData.ativo ?? true,
        created_by: user?.id,
        target_user_id: goalData.target_user_id || null,
      };
      if (editingGoal?.id) {
        const { error } = await supabase
          .from("professional_goals")
          .update(goal)
          .eq("id", editingGoal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professional_goals").insert([goal]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-goals"] });
      setGoalDialogOpen(false);
      setEditingGoal(null);
      setGoalForm(emptyGoal);
      toast.success(editingGoal ? "Meta atualizada!" : "Meta criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar meta: " + error.message);
    },
  });

  const saveChallengeMutation = useMutation({
    mutationFn: async (challenge: Challenge) => {
      const payload = {
        titulo: challenge.titulo,
        descricao: challenge.descricao,
        icone: challenge.icone,
        tipo: challenge.tipo,
        metric_type: challenge.metric_type,
        meta: { target: challenge.meta.target, metric: challenge.metric_type },
        pontos_recompensa: challenge.pontos_recompensa,
        data_inicio: challenge.data_inicio,
        data_fim: challenge.data_fim,
        ativo: challenge.ativo,
      };
      if (editingChallenge?.id) {
        const { error } = await supabase
          .from("challenges")
          .update(payload)
          .eq("id", editingChallenge.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("challenges").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges-admin"] });
      setChallengeDialogOpen(false);
      setEditingChallenge(null);
      setChallengeForm(emptyChallenge);
      toast.success(editingChallenge ? "Desafio atualizado!" : "Desafio criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar desafio: " + error.message);
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professional_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-goals"] });
      toast.success("Meta excluída!");
    },
  });

  const deleteChallengeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges-admin"] });
      toast.success("Desafio excluído!");
    },
  });

  // ── Dialog openers ──────────────────────────────────────────
  const openGoalDialog = (goal?: any) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm(goal);
    } else {
      setEditingGoal(null);
      setGoalForm(emptyGoal);
    }
    setGoalDialogOpen(true);
  };

  const openChallengeDialog = (challenge?: any) => {
    if (challenge) {
      setEditingChallenge(challenge);
      setChallengeForm({
        ...challenge,
        metric_type: challenge.metric_type || challenge.meta?.metric || "sessoes_realizadas",
        meta: { target: challenge.meta?.target ?? 10, metric: challenge.metric_type || challenge.meta?.metric || "sessoes_realizadas" },
      });
    } else {
      setEditingChallenge(null);
      setChallengeForm(emptyChallenge);
    }
    setChallengeDialogOpen(true);
  };

  const availableMetrics = challengeForm.tipo === "paciente" ? PATIENT_METRICS : PROF_METRICS;
  const goalMetrics = goalForm.tipo === "equipe" ? PROF_METRICS : PROF_METRICS;

  if (!isAdmin) {
    return <div className="p-8 text-center">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Gamificação</h1>
        <p className="text-muted-foreground">
          Gerencie metas e desafios vinculados a métricas reais do sistema
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="goals" className="gap-2">
            <Target className="h-4 w-4" />
            Metas Profissionais
          </TabsTrigger>
          <TabsTrigger value="challenges" className="gap-2">
            <Trophy className="h-4 w-4" />
            Desafios
          </TabsTrigger>
        </TabsList>

        {/* ── GOALS TAB ── */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Metas ({goals.length})</h2>
            <Button onClick={() => openGoalDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal: any) => {
              const metric = getMetricInfo(goal.meta_tipo);
              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {metric?.icon ?? <Target className="h-4 w-4 text-primary" />}
                        <CardTitle className="text-base">{goal.titulo}</CardTitle>
                      </div>
                      <Badge variant={goal.ativo ? "default" : "secondary"}>
                        {goal.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {goal.descricao && (
                      <p className="text-sm text-muted-foreground">{goal.descricao}</p>
                    )}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Métrica vinculada</p>
                      <p className="text-sm font-semibold">{metric?.label ?? goal.meta_tipo}</p>
                      {metric?.description && (
                        <p className="text-xs text-muted-foreground">{metric.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{goal.tipo}</Badge>
                      <Badge variant="outline">
                        Meta: {goal.meta_valor} {metric?.unit}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span className="font-medium">{goal.pontos_recompensa} pts</span>
                    </div>
                    {goal.data_inicio && goal.data_fim && (
                      <div className="text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {format(new Date(goal.data_inicio + "T12:00:00"), "dd/MM")} -{" "}
                        {format(new Date(goal.data_fim + "T12:00:00"), "dd/MM/yyyy")}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openGoalDialog(goal)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteGoalMutation.mutate(goal.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {goals.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma meta criada. Clique em "Nova Meta" para começar.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── CHALLENGES TAB ── */}
        <TabsContent value="challenges" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Desafios ({challenges.length})</h2>
            <Button onClick={() => openChallengeDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Desafio
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge: any) => {
              const metric = getMetricInfo(
                challenge.metric_type || challenge.meta?.metric
              );
              return (
                <Card key={challenge.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{challenge.icone}</span>
                        <CardTitle className="text-base">{challenge.titulo}</CardTitle>
                      </div>
                      <Badge variant={challenge.ativo ? "default" : "secondary"}>
                        {challenge.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{challenge.descricao}</p>

                    {/* Metric badge */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Métrica do sistema</p>
                      <div className="flex items-center gap-2">
                        {metric?.icon}
                        <p className="text-sm font-semibold">{metric?.label ?? challenge.metric_type ?? "—"}</p>
                      </div>
                      {metric?.description && (
                        <p className="text-xs text-muted-foreground">{metric.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        {challenge.tipo === "profissional" ? (
                          <Users className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {challenge.tipo === "profissional" ? "Profissional" : "Paciente"}
                      </Badge>
                      <Badge variant="outline">
                        Meta: {challenge.meta?.target} {metric?.unit}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span className="font-medium">{challenge.pontos_recompensa} pts</span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {format(new Date(challenge.data_inicio + "T12:00:00"), "dd/MM")} -{" "}
                      {format(new Date(challenge.data_fim + "T12:00:00"), "dd/MM/yyyy")}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openChallengeDialog(challenge)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteChallengeMutation.mutate(challenge.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {challenges.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum desafio criado. Clique em "Novo Desafio" para começar.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── GOAL DIALOG ── */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta Profissional"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={goalForm.titulo}
                onChange={(e) => setGoalForm({ ...goalForm, titulo: e.target.value })}
                placeholder="Ex: Campeão de Sessões do Mês"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={goalForm.descricao}
                onChange={(e) => setGoalForm({ ...goalForm, descricao: e.target.value })}
                rows={2}
                placeholder="Descreva o objetivo desta meta..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Escopo</Label>
                <Select
                  value={goalForm.tipo}
                  onValueChange={(value) => setGoalForm({ ...goalForm, tipo: value, target_user_id: null })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="equipe">Toda a Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {goalForm.tipo === "individual" && (
                <div>
                  <Label>Profissional</Label>
                  <Select
                    value={goalForm.target_user_id || ""}
                    onValueChange={(v) => setGoalForm({ ...goalForm, target_user_id: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os profissionais</SelectItem>
                      {professionals.map((prof: any) => (
                        <SelectItem key={prof.user_id} value={prof.user_id}>
                          {prof.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Metric selector */}
            <div>
              <Label>Métrica do Sistema *</Label>
              <Select
                value={goalForm.meta_tipo}
                onValueChange={(v) => setGoalForm({ ...goalForm, meta_tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {goalMetrics.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        {m.icon}
                        <span>{m.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {goalForm.meta_tipo && (
                <p className="text-xs text-muted-foreground mt-1">
                  {getMetricInfo(goalForm.meta_tipo)?.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Meta ({getMetricInfo(goalForm.meta_tipo)?.unit ?? "unidades"})
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={goalForm.meta_valor}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, meta_valor: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Pontos de Recompensa</Label>
                <Input
                  type="number"
                  min={0}
                  value={goalForm.pontos_recompensa}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, pontos_recompensa: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={goalForm.data_inicio}
                  onChange={(e) => setGoalForm({ ...goalForm, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={goalForm.data_fim}
                  onChange={(e) => setGoalForm({ ...goalForm, data_fim: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveGoalMutation.mutate(goalForm)}
              disabled={saveGoalMutation.isPending || !goalForm.titulo}
            >
              {saveGoalMutation.isPending ? "Salvando..." : "Salvar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CHALLENGE DIALOG ── */}
      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChallenge ? "Editar Desafio" : "Novo Desafio"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[80px_1fr] gap-4">
              <div>
                <Label>Ícone</Label>
                <Select
                  value={challengeForm.icone}
                  onValueChange={(v) => setChallengeForm({ ...challengeForm, icone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHALLENGE_ICONS.map((ic) => (
                      <SelectItem key={ic} value={ic}>
                        <span className="text-xl">{ic}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título *</Label>
                <Input
                  value={challengeForm.titulo}
                  onChange={(e) => setChallengeForm({ ...challengeForm, titulo: e.target.value })}
                  placeholder="Ex: Maratonista de Sessões"
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={challengeForm.descricao}
                onChange={(e) =>
                  setChallengeForm({ ...challengeForm, descricao: e.target.value })
                }
                rows={2}
                placeholder="Explique como o desafio funciona..."
              />
            </div>

            <div>
              <Label>Para quem é este desafio?</Label>
              <Select
                value={challengeForm.tipo}
                onValueChange={(value: "profissional" | "paciente") =>
                  setChallengeForm({
                    ...challengeForm,
                    tipo: value,
                    metric_type: value === "paciente" ? "sessoes_paciente" : "sessoes_realizadas",
                    meta: {
                      ...challengeForm.meta,
                      metric: value === "paciente" ? "sessoes_paciente" : "sessoes_realizadas",
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Profissional
                    </div>
                  </SelectItem>
                  <SelectItem value="paciente">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Paciente
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* System metric selector */}
            <div>
              <Label>Métrica do Sistema *</Label>
              <Select
                value={challengeForm.metric_type}
                onValueChange={(v) =>
                  setChallengeForm({
                    ...challengeForm,
                    metric_type: v,
                    meta: { ...challengeForm.meta, metric: v },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMetrics.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        {m.icon}
                        <span>{m.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {challengeForm.metric_type && (
                <div className="bg-muted/50 rounded p-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    {getMetricInfo(challengeForm.metric_type)?.description}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Meta ({getMetricInfo(challengeForm.metric_type)?.unit ?? "unidades"})
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={challengeForm.meta.target}
                  onChange={(e) =>
                    setChallengeForm({
                      ...challengeForm,
                      meta: { ...challengeForm.meta, target: Number(e.target.value) },
                    })
                  }
                />
              </div>
              <div>
                <Label>Pontos de Recompensa</Label>
                <Input
                  type="number"
                  min={0}
                  value={challengeForm.pontos_recompensa}
                  onChange={(e) =>
                    setChallengeForm({
                      ...challengeForm,
                      pontos_recompensa: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={challengeForm.data_inicio}
                  onChange={(e) =>
                    setChallengeForm({ ...challengeForm, data_inicio: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Data Fim *</Label>
                <Input
                  type="date"
                  value={challengeForm.data_fim}
                  onChange={(e) =>
                    setChallengeForm({ ...challengeForm, data_fim: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChallengeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveChallengeMutation.mutate(challengeForm)}
              disabled={
                saveChallengeMutation.isPending ||
                !challengeForm.titulo ||
                !challengeForm.data_inicio ||
                !challengeForm.data_fim
              }
            >
              {saveChallengeMutation.isPending ? "Salvando..." : "Salvar Desafio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
