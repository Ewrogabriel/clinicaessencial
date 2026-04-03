import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, CheckCircle, AlertCircle, Clock, Zap } from "lucide-react";
import { toast } from "sonner";

interface SyncLog {
  id: string;
  integracao_tipo: string;
  acao: string;
  status: string;
  mensagem_erro?: string;
  created_at: string;
}

interface IntegrationConfig {
  id: string;
  tipo: string;
  ativo: boolean;
  config: Record<string, any>;
  updated_at: string;
}

export const IntegrationStatus = ({ clinicId }: { clinicId: string }) => {
  // Fetch integration configs
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ["integration-configs", clinicId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("config_integracoes" as any) as any)
        .select("*")
        .eq("clinic_id", clinicId);
      if (error) throw error;
      return data as IntegrationConfig[];
    },
  });

  // Fetch sync logs
  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["integracao-sync-logs", clinicId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("integracao_sync_logs" as any) as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Mutation para sincronizar Banco Inter
  const syncInterMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        new URL(/^http/.test(window.location.href) ? window.location.href : "http://localhost:3000") + "/functions/v1/inter-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: "sync_daily_extract",
            payload: {},
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao sincronizar");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Sincronização com Banco Inter iniciada!" });
    },
    onError: (err: any) => {
      toast({ title: "❌ Erro na sincronização", description: err.message, variant: "destructive" });
    },
  });

  // Mutation para sincronizar Nibo
  const syncNiboMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        new URL(/^http/.test(window.location.href) ? window.location.href : "http://localhost:3000") + "/functions/v1/nibo-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: "sync_customers",
            payload: {},
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao sincronizar");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Sincronização com Nibo iniciada!" });
    },
    onError: (err: any) => {
      toast({ title: "❌ Erro na sincronização", description: err.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (Status: string) => {
    switch (Status) {
      case "sucesso":
        return <Badge className="bg-emerald-500">Sucesso</Badge>;
      case "erro":
        return <Badge variant="destructive">Erro</Badge>;
      case "pendente":
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">{Status}</Badge>;
    }
  };

  const getIntegrationLabel = (tipo: string) => {
    switch (tipo) {
      case "banco_inter":
        return "🏦 Banco Inter";
      case "nibo":
        return "💰 Nibo";
      case "transmitenota":
        return "📄 TransmiteNota";
      default:
        return tipo;
    }
  };

  const lastLog = (tipo: string) => {
    return syncLogs?.find((log) => log.integracao_tipo === tipo);
  };

  const lastLogTime = (tipo: string) => {
    const log = lastLog(tipo);
    if (!log) return "Nunca";
    return format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  if (configsLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const interConfig = configs?.find((c) => c.tipo === "banco_inter");
  const niboConfig = configs?.find((c) => c.tipo === "nibo");
  const transmiteConfig = configs?.find((c) => c.tipo === "transmitenota");

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* === Banco Inter === */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>🏦 Banco Inter</CardTitle>
            {interConfig?.ativo ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">{interConfig?.ativo ? "Ativo" : "Inativo"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Última sincronização</p>
            <p className="text-sm font-mono">{lastLogTime("banco_inter")}</p>
          </div>

          {lastLog("banco_inter") && (
            <div>
              <p className="text-sm text-muted-foreground">Resultado</p>
              <div className="space-y-2">
                {getStatusBadge(lastLog("banco_inter")!.status)}
                {lastLog("banco_inter")!.mensagem_erro && (
                  <p className="text-xs text-destructive">{lastLog("banco_inter")!.mensagem_erro}</p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={() => syncInterMutation.mutate()}
            disabled={syncInterMutation.isPending || !interConfig?.ativo}
            className="w-full"
            size="sm"
          >
            {syncInterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {syncInterMutation.isPending ? "Sincronizando..." : "Sincronizar Agora"}
          </Button>
        </CardContent>
      </Card>

      {/* === Nibo === */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>💰 Nibo</CardTitle>
            {niboConfig?.ativo ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">{niboConfig?.ativo ? "Ativo" : "Inativo"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Última sincronização</p>
            <p className="text-sm font-mono">{lastLogTime("nibo")}</p>
          </div>

          {lastLog("nibo") && (
            <div>
              <p className="text-sm text-muted-foreground">Resultado</p>
              <div className="space-y-2">
                {getStatusBadge(lastLog("nibo")!.status)}
                {lastLog("nibo")!.mensagem_erro && (
                  <p className="text-xs text-destructive">{lastLog("nibo")!.mensagem_erro}</p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={() => syncNiboMutation.mutate()}
            disabled={syncNiboMutation.isPending || !niboConfig?.ativo}
            className="w-full"
            size="sm"
          >
            {syncNiboMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {syncNiboMutation.isPending ? "Sincronizando..." : "Sincronizar Agora"}
          </Button>
        </CardContent>
      </Card>

      {/* === TransmiteNota === */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>📄 TransmiteNota</CardTitle>
            {transmiteConfig?.ativo ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">{transmiteConfig?.ativo ? "Ativo" : "Inativo"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Última sincronização</p>
            <p className="text-sm font-mono">{lastLogTime("transmitenota")}</p>
          </div>

          {lastLog("transmitenota") && (
            <div>
              <p className="text-sm text-muted-foreground">Resultado</p>
              <div className="space-y-2">
                {getStatusBadge(lastLog("transmitenota")!.status)}
                {lastLog("transmitenota")!.mensagem_erro && (
                  <p className="text-xs text-destructive">{lastLog("transmitenota")!.mensagem_erro}</p>
                )}
              </div>
            </div>
          )}

          <Button
            disabled={true}
            className="w-full"
            size="sm"
            title="Emissão manual em desenvolvimento"
          >
            <Clock className="h-4 w-4 mr-2" />
            Aguardando...
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
