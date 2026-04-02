import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRewardsCatalog, useRedeemReward, useRedemptionHistory } from "@/modules/gamification/hooks/useRewards";
import { usePlayerStats } from "@/modules/gamification/hooks/useGamification";
import { Gift, Star, History, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RewardsCatalog() {
  const { data: catalog = [], isLoading: loadingCatalog } = useRewardsCatalog();
  const { data: stats } = usePlayerStats();
  const { data: history = [], isLoading: loadingHistory } = useRedemptionHistory();
  const { mutate: redeemReward, isPending } = useRedeemReward();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const currentPoints = stats?.total_pontos ?? 0;

  const handleRedeem = (rewardId: string) => {
    setRedeemingId(rewardId);
    redeemReward(rewardId, {
      onSettled: () => setRedeemingId(null),
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Catálogo de Recompensas</h1>
        </div>

        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="font-bold text-sm">{currentPoints} pontos</span>
          {stats?.nivel && (
            <Badge variant="secondary" className="text-xs">
              {stats.nivel}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="catalog" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Recompensas
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {loadingCatalog ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : catalog.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Gift className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma recompensa disponível no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {catalog.map((reward: any) => {
                const canAfford = currentPoints >= (reward.custo_pontos ?? 0);
                const isRedeeming = isPending && redeemingId === reward.id;

                return (
                  <Card
                    key={reward.id}
                    className={`transition-all ${canAfford ? "hover:shadow-md" : "opacity-60"}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {reward.icone && <span className="text-2xl">{reward.icone}</span>}
                          <CardTitle className="text-sm">{reward.titulo}</CardTitle>
                        </div>
                        <Badge
                          variant={canAfford ? "default" : "outline"}
                          className={`shrink-0 ${canAfford ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                        >
                          <Star className="h-3 w-3 mr-1" />
                          {reward.custo_pontos} pts
                        </Badge>
                      </div>
                      {reward.descricao && (
                        <CardDescription className="text-xs">{reward.descricao}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      {reward.estoque !== null && reward.estoque !== undefined && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Estoque: {reward.estoque > 0 ? reward.estoque : "Indisponível"}
                        </p>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={!canAfford || isRedeeming || reward.estoque === 0}
                          >
                            {isRedeeming ? "Resgatando..." : canAfford ? "Resgatar" : "Pontos insuficientes"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar resgate</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja resgatar <strong>{reward.titulo}</strong> por{" "}
                              <strong>{reward.custo_pontos} pontos</strong>? Você possui{" "}
                              {currentPoints} pontos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRedeem(reward.id)}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Resgates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Nenhum resgate realizado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 border-b border-muted last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {item.gamification_recompensas?.icone && (
                          <span>{item.gamification_recompensas.icone}</span>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {item.gamification_recompensas?.titulo ?? "Recompensa"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-destructive border-destructive/30">
                        -{item.gamification_recompensas?.custo_pontos ?? "?"} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
