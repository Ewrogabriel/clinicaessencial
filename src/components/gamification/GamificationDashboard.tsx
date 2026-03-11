import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useGamification } from "@/modules/patients/hooks/useGamification";
import { Trophy, Star, Target, Medal, Flame, Crown, Zap } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  pacienteId: string;
}

export const GamificationDashboard = ({ pacienteId }: Props) => {
  const {
    totalPoints,
    pointsHistory,
    unlockedAchievements,
    allAchievements,
    activeChallenges,
    ranking,
  } = useGamification(pacienteId);

  const unlockedIds = new Set(unlockedAchievements.map((u: any) => u.achievement_id));
  const currentRank = ranking.findIndex((r: any) => r.paciente_id === pacienteId) + 1;

  const getLevel = (points: number) => {
    if (points >= 500) return { name: "Diamante", icon: Crown, color: "text-cyan-500" };
    if (points >= 300) return { name: "Ouro", icon: Trophy, color: "text-yellow-500" };
    if (points >= 150) return { name: "Prata", icon: Medal, color: "text-gray-400" };
    if (points >= 50) return { name: "Bronze", icon: Star, color: "text-amber-600" };
    return { name: "Iniciante", icon: Zap, color: "text-muted-foreground" };
  };

  const level = getLevel(totalPoints);
  const LevelIcon = level.icon;

  return (
    <div className="space-y-6">
      {/* Points & Level */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <LevelIcon className={`h-8 w-8 ${level.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Seus Pontos</p>
                <p className="text-3xl font-bold">{totalPoints}</p>
                <Badge variant="secondary" className="mt-1">
                  Nível: {level.name}
                </Badge>
              </div>
              {currentRank > 0 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Ranking</p>
                  <p className="text-2xl font-bold text-primary">#{currentRank}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Flame className="h-8 w-8 text-orange-500 mb-2" />
            <p className="text-sm text-muted-foreground">Conquistas</p>
            <p className="text-2xl font-bold">
              {unlockedAchievements.length}/{allAchievements.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Challenges */}
      {activeChallenges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Desafios Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeChallenges.map((challenge: any) => {
              const prog = challenge.progress;
              const current = prog?.progresso || 0;
              const meta = prog?.meta || (challenge.meta as any)?.quantidade || 1;
              const percent = Math.min(100, Math.round((current / meta) * 100));
              const daysLeft = differenceInDays(new Date(challenge.data_fim), new Date());
              const isCompleted = prog?.completado;

              return (
                <div key={challenge.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{challenge.icone}</span>
                      <div>
                        <p className="font-medium text-sm">{challenge.titulo}</p>
                        <p className="text-xs text-muted-foreground">{challenge.descricao}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isCompleted ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">✅ Completo</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{daysLeft}d restantes</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={percent} className="flex-1 h-2" />
                    <span className="text-xs font-medium w-16 text-right">{current}/{meta}</span>
                  </div>
                  <p className="text-xs text-primary">+{challenge.pontos_recompensa} pts</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Achievements Gallery */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {allAchievements.map((a: any) => {
              const unlocked = unlockedIds.has(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${unlocked
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "bg-muted/30 border-muted opacity-50 grayscale"
                    }`}
                >
                  <span className="text-3xl mb-2">{a.icone}</span>
                  <p className="font-medium text-sm">{a.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                  <Badge variant={unlocked ? "default" : "outline"} className="mt-2 text-[10px]">
                    +{a.pontos} pts
                  </Badge>
                </div>
              );
            })}
            {allAchievements.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground text-sm py-8">
                Nenhuma conquista disponível ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ranking */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              Top 10 Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.map((r: any, i: number) => {
                const isMe = r.paciente_id === pacienteId;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div
                    key={r.paciente_id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${isMe ? "bg-primary/10 border border-primary/20" : ""
                      }`}
                  >
                    <span className="w-8 text-center font-bold text-sm">
                      {i < 3 ? medals[i] : `${i + 1}º`}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {r.nome?.split(" ").slice(0, 2).join(" ")}
                        {isMe && <span className="text-primary ml-1">(você)</span>}
                      </p>
                    </div>
                    <span className="font-bold text-sm">{r.total_pontos} pts</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points History */}
      {pointsHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Pontos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pointsHistory.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-muted last:border-0">
                  <div>
                    <p className="text-sm">{p.descricao || p.origem}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    +{p.pontos}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
