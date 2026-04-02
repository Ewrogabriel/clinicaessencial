import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./ProgressBar";
import { Target, Clock, Star } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Challenge {
  titulo: string;
  descricao: string;
  meta: number;
  progresso_atual: number;
  pontos_recompensa: number;
  data_fim?: string;
  tipo?: string;
}

interface Props {
  challenge: Challenge;
}

export const ChallengeCard = ({ challenge }: Props) => {
  const { titulo, descricao, meta, progresso_atual, pontos_recompensa, data_fim, tipo } = challenge;

  const isCompleted = progresso_atual >= meta;
  const isExpired = data_fim ? isPast(new Date(data_fim)) && !isCompleted : false;
  const daysLeft = data_fim ? differenceInDays(new Date(data_fim), new Date()) : null;

  return (
    <Card className={`transition-all ${isCompleted ? "border-green-300 bg-green-50/50 dark:bg-green-950/10 dark:border-green-800" : ""}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">{titulo}</CardTitle>
          </div>
          <Badge
            variant={isCompleted ? "default" : isExpired ? "destructive" : "secondary"}
            className={`shrink-0 ${isCompleted ? "bg-green-500 hover:bg-green-600" : ""}`}
          >
            {isCompleted ? "✅ Completo" : isExpired ? "Expirado" : tipo ?? "Desafio"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-muted-foreground">{descricao}</p>

        <ProgressBar
          current={progresso_atual}
          total={meta}
          showPercentage={true}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-primary text-xs font-medium">
            <Star className="h-3 w-3" />
            {pontos_recompensa} pts
          </div>

          {data_fim && !isCompleted && (
            <div className={`flex items-center gap-1 text-xs ${daysLeft !== null && daysLeft <= 2 ? "text-destructive" : "text-muted-foreground"}`}>
              <Clock className="h-3 w-3" />
              {daysLeft !== null && daysLeft >= 0
                ? `${daysLeft}d restantes`
                : format(new Date(data_fim), "dd/MM", { locale: ptBR })}
            </div>
          )}

          {isCompleted && data_fim && (
            <span className="text-xs text-muted-foreground">
              até {format(new Date(data_fim), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
