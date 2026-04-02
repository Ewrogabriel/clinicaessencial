import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard } from "@/modules/gamification/hooks/useLeaderboard";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { gamificationService } from "@/modules/gamification/services/gamificationService";
import { Trophy, Medal, Crown, Star } from "lucide-react";
import type { LeaderboardPeriod } from "@/modules/gamification/services/gamificationService";

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: "Esta Semana",
  month: "Este Mês",
  all: "Todos os Tempos",
};

const MEDALS = ["🥇", "🥈", "🥉"];

const getLevelColor = (points: number) => {
  const level = gamificationService.getLevel(points);
  const map: Record<string, string> = {
    Diamante: "text-cyan-500",
    Ouro: "text-yellow-500",
    Prata: "text-gray-400",
    Bronze: "text-amber-600",
    Iniciante: "text-muted-foreground",
  };
  return map[level.name] ?? "text-muted-foreground";
};

export default function LeaderboardPatient() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const { data: entries = [], isLoading } = useLeaderboard(period);
  const { patientId } = useAuth();

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Ranking de Pacientes</h1>
        </div>

        <Select value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {PERIOD_LABELS[period]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum dado disponível para este período.
            </p>
          ) : (
            entries.map((entry, i) => {
              const isMe = entry.paciente_id === patientId;
              const level = gamificationService.getLevel(entry.total_pontos);
              const levelColor = getLevelColor(entry.total_pontos);

              return (
                <div
                  key={entry.paciente_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isMe
                      ? "bg-primary/10 border-primary/30 shadow-sm"
                      : i < 3
                      ? "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/10 dark:border-yellow-800"
                      : "border-transparent hover:bg-muted/50"
                  }`}
                >
                  <span className="w-8 text-center font-bold text-sm shrink-0">
                    {i < 3 ? MEDALS[i] : `${i + 1}º`}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.nome?.split(" ").slice(0, 2).join(" ")}
                      {isMe && <span className="text-primary ml-1 text-xs">(você)</span>}
                    </p>
                    <p className={`text-xs ${levelColor}`}>{level.name}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="font-bold text-sm">{entry.total_pontos}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">pts</span>
                  </div>

                  {i === 0 && <Medal className="h-4 w-4 text-yellow-500 shrink-0" />}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {!isLoading && entries.length > 0 && patientId && !entries.some((e) => e.paciente_id === patientId) && (
        <p className="text-center text-sm text-muted-foreground">
          Você ainda não está no top 10. Continue acumulando pontos!
        </p>
      )}

      <div className="grid grid-cols-5 gap-3 text-center">
        {(["Iniciante", "Bronze", "Prata", "Ouro", "Diamante"] as const).map((lvl) => {
          const thresholds: Record<string, number> = { Iniciante: 0, Bronze: 50, Prata: 150, Ouro: 300, Diamante: 500 };
          const colors: Record<string, string> = {
            Iniciante: "text-muted-foreground",
            Bronze: "text-amber-600",
            Prata: "text-gray-400",
            Ouro: "text-yellow-500",
            Diamante: "text-cyan-500",
          };
          return (
            <div key={lvl} className={`p-3 rounded-lg border ${colors[lvl]} bg-card`}>
              <p className="font-semibold text-xs">{lvl}</p>
              <p className="text-[10px] text-muted-foreground">{thresholds[lvl]}+ pts</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
