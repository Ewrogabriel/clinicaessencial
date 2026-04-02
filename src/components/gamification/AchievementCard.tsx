import { Trophy, Star, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Achievement {
  titulo: string;
  descricao: string;
  icone: string;
  conquistado: boolean;
  data_conquista?: string;
  pontos?: number;
}

interface Props {
  achievement: Achievement;
}

export const AchievementCard = ({ achievement }: Props) => {
  const { titulo, descricao, icone, conquistado, data_conquista, pontos } = achievement;

  return (
    <Card
      className={`transition-all ${
        conquistado
          ? "bg-yellow-50 border-yellow-300 shadow-sm dark:bg-yellow-950/20 dark:border-yellow-700"
          : "bg-muted/30 border-muted opacity-50 grayscale"
      }`}
    >
      <CardContent className="flex flex-col items-center text-center p-4 space-y-2">
        <div
          className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl ${
            conquistado ? "bg-yellow-100 dark:bg-yellow-900/40" : "bg-muted"
          }`}
        >
          {icone || (conquistado ? <Trophy className="h-6 w-6 text-yellow-500" /> : <Lock className="h-6 w-6 text-muted-foreground" />)}
        </div>

        <div>
          <p className="font-semibold text-sm">{titulo}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
        </div>

        {pontos !== undefined && (
          <Badge
            variant={conquistado ? "default" : "outline"}
            className={conquistado ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}
          >
            <Star className="h-3 w-3 mr-1" />
            {pontos} pts
          </Badge>
        )}

        {conquistado && data_conquista && (
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(data_conquista), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
