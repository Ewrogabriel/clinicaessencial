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
import { Plus, Edit2, Trash2, Target, Trophy, Star, Users, User, Calendar } from "lucide-react";
import { toast } from "sonner";

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
  meta: any;
  pontos_recompensa: number;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
}

const emptyGoal: Goal = {
  titulo: "",
  descricao: "",
  tipo: "individual",
  meta_tipo: "atendimentos",
  meta_valor: 0,
  pontos_recompensa: 0,
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
  meta: { target: 10, metric: "sessions" },
  pontos_recompensa: 100,
  data_inicio: "",
  data_fim: "",
  ativo: true,
};

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

  // Fetch professional goals
  const { data: goals = [] } = useQuery({
    queryKey: ["professional-goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professional_goals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch challenges
  const { data: challenges = [] } = useQuery({
    queryKey: ["challenges-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch users for goal assignment
  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-for-goals"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const userIds = (roles || []).map(r => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", userIds);
      return profiles || [];
    },
  });

  // Mutations
  const saveGoalMutation = useMutation({
    mutationFn: async (goalData: Goal) => {
      const goal = { ...goalData, created_by: user?.id };
      if (editingGoal) {
        const { error } = await supabase.from("professional_goals").update(goal).eq("id", editingGoal.id);
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
      toast.success(editingGoal ? "Meta atualizada!" : "Meta criada!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar meta: " + error.message);
    },
  });

  const saveChallengeMutation = useMutation({
    mutationFn: async (challenge: Challenge) => {
      if (editingChallenge) {
        const { error } = await supabase.from("challenges").update(challenge).eq("id", editingChallenge.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("challenges").insert([challenge]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges-admin"] });
      setChallengeDialogOpen(false);
      setEditingChallenge(null);
      setChallengeForm(emptyChallenge);
      toast.success(editingChallenge ? "Desafio atualizado!" : "Desafio criado!");
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

  const openGoalDialog = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm(goal);
    } else {
      setEditingGoal(null);
      setGoalForm(emptyGoal);
    }
    setGoalDialogOpen(true);
  };

  const openChallengeDialog = (challenge?: Challenge) => {
    if (challenge) {
      setEditingChallenge(challenge);
      setChallengeForm(challenge);
    } else {
      setEditingChallenge(null);
      setChallengeForm(emptyChallenge);
    }
    setChallengeDialogOpen(true);
  };

  if (!isAdmin) {
    return <div className="p-8 text-center">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Gamificação</h1>
          <p className="text-muted-foreground">Gerencie metas, desafios e recompensas para profissionais e pacientes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="goals" className="gap-2">
            <Target className="h-4 w-4" />
            Metas Profissionais
          </TabsTrigger>
          <TabsTrigger value="challenges" className="gap-2">
            <Trophy className="h-4 w-4" />
            Desafios Gerais
          </TabsTrigger>
        </TabsList>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Metas Profissionais ({goals.length})</h2>
            <Button onClick={() => openGoalDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal: any) => (
              <Card key={goal.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">{goal.titulo}</CardTitle>
                    </div>
                    <Badge variant={goal.ativo ? "default" : "secondary"}>
                      {goal.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{goal.descricao}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{goal.meta_tipo}</Badge>
                    <Badge variant="outline">{goal.tipo}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Meta:</span> {goal.meta_valor}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pontos:</span> {goal.pontos_recompensa}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {format(new Date(goal.data_inicio), "dd/MM")} - {format(new Date(goal.data_fim), "dd/MM/yyyy")}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openGoalDialog(goal)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteGoalMutation.mutate(goal.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Challenges Tab */}
        <TabsContent value="challenges" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Desafios ({challenges.length})</h2>
            <Button onClick={() => openChallengeDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Desafio
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge: any) => (
              <Card key={challenge.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{challenge.icone}</span>
                      <CardTitle className="text-base">{challenge.titulo}</CardTitle>
                    </div>
                    <Badge variant={challenge.ativo ? "default" : "secondary"}>
                      {challenge.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{challenge.descricao}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      {challenge.tipo === "profissional" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {challenge.tipo}
                    </Badge>
                    <Badge variant="outline">
                      <Star className="h-3 w-3 mr-1" />
                      {challenge.pontos_recompensa} pts
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {format(new Date(challenge.data_inicio), "dd/MM")} - {format(new Date(challenge.data_fim), "dd/MM/yyyy")}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openChallengeDialog(challenge)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteChallengeMutation.mutate(challenge.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta Profissional"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={goalForm.titulo} onChange={(e) => setGoalForm({ ...goalForm, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={goalForm.descricao} onChange={(e) => setGoalForm({ ...goalForm, descricao: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={goalForm.tipo} onValueChange={(value: "individual" | "equipe") => setGoalForm({ ...goalForm, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="equipe">Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={goalForm.meta_tipo} onValueChange={(value: any) => setGoalForm({ ...goalForm, meta_tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atendimentos">Atendimentos</SelectItem>
                    <SelectItem value="presenca">Presença</SelectItem>
                    <SelectItem value="faturamento">Faturamento</SelectItem>
                    <SelectItem value="pontos">Pontos</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {goalForm.tipo === "individual" && (
              <div>
                <Label>Profissional</Label>
                <Select value={goalForm.target_user_id || ""} onValueChange={(value) => setGoalForm({ ...goalForm, target_user_id: value || null })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {professionals.map((prof: any) => (
                      <SelectItem key={prof.user_id} value={prof.user_id}>{prof.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Meta</Label>
                <Input type="number" value={goalForm.meta_valor} onChange={(e) => setGoalForm({ ...goalForm, meta_valor: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Pontos</Label>
                <Input type="number" value={goalForm.pontos_recompensa} onChange={(e) => setGoalForm({ ...goalForm, pontos_recompensa: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={goalForm.data_inicio} onChange={(e) => setGoalForm({ ...goalForm, data_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={goalForm.data_fim} onChange={(e) => setGoalForm({ ...goalForm, data_fim: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveGoalMutation.mutate(goalForm)} disabled={saveGoalMutation.isPending}>
              {saveGoalMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Challenge Dialog */}
      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingChallenge ? "Editar Desafio" : "Novo Desafio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={challengeForm.titulo} onChange={(e) => setChallengeForm({ ...challengeForm, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={challengeForm.descricao} onChange={(e) => setChallengeForm({ ...challengeForm, descricao: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Ícone</Label>
                <Input value={challengeForm.icone} onChange={(e) => setChallengeForm({ ...challengeForm, icone: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={challengeForm.tipo} onValueChange={(value: "profissional" | "paciente") => setChallengeForm({ ...challengeForm, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="paciente">Paciente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pontos</Label>
                <Input type="number" value={challengeForm.pontos_recompensa} onChange={(e) => setChallengeForm({ ...challengeForm, pontos_recompensa: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={challengeForm.data_inicio} onChange={(e) => setChallengeForm({ ...challengeForm, data_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={challengeForm.data_fim} onChange={(e) => setChallengeForm({ ...challengeForm, data_fim: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChallengeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveChallengeMutation.mutate(challengeForm)} disabled={saveChallengeMutation.isPending}>
              {saveChallengeMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}