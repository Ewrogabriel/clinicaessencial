import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, MessageSquare, Eye } from "lucide-react";
import { AIChurnSuggestions } from "./AIChurnSuggestions";
import { format, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ChurnRisk {
  paciente_id: string;
  nome: string;
  telefone: string;
  riskScore: number; // 0-100
  riskLevel: "alto" | "medio" | "baixo";
  reasons: string[];
  lastSession: string | null;
  faltasRecentes: number;
  pagamentosAtrasados: number;
}

export function ChurnPrediction() {
  const navigate = useNavigate();

  const { data: churnData = [], isLoading } = useQuery({
    queryKey: ["churn-prediction"],
    queryFn: async () => {
      const threeMonthsAgo = subMonths(new Date(), 3).toISOString();

      // Fetch patients
      const { data: pacientes } = await supabase.from("pacientes")
        .select("id, nome, telefone, status")
        .eq("status", "ativo");

      if (!pacientes?.length) return [];

      const pacienteIds = pacientes.map((p) => p.id);

      // Fetch recent appointments
      const { data: agendamentos } = await supabase.from("agendamentos")
        .select("paciente_id, data_horario, status")
        .in("paciente_id", pacienteIds)
        .gte("data_horario", threeMonthsAgo)
        .order("data_horario", { ascending: false });

      // Fetch overdue payments
      const { data: pagamentos } = await supabase.from("pagamentos")
        .select("paciente_id, status, data_vencimento")
        .in("paciente_id", pacienteIds)
        .eq("status", "pendente");

      // Calculate risk per patient
      const risks: ChurnRisk[] = pacientes.map((p) => {
        const pAgendamentos = (agendamentos || []).filter((a: any) => a.paciente_id === p.id);
        const pPagamentos = (pagamentos || []).filter((pg: any) => pg.paciente_id === p.id);

        const faltas = pAgendamentos.filter((a: any) => a.status === "falta" || a.status === "cancelado").length;
        const totalSessoes = pAgendamentos.length;
        const taxaFalta = totalSessoes > 0 ? (faltas / totalSessoes) * 100 : 0;

        const pagAtrasados = pPagamentos.filter((pg: any) => {
          if (!pg.data_vencimento) return false;
          return differenceInDays(new Date(), new Date(pg.data_vencimento)) > 0;
        }).length;

        const lastSession = pAgendamentos.find((a: any) => a.status === "realizado");
        const diasSemSessao = lastSession
          ? differenceInDays(new Date(), new Date(lastSession.data_horario))
          : 999;

        // Risk score calculation
        let score = 0;
        const reasons: string[] = [];

        // High absence rate
        if (taxaFalta >= 50 && totalSessoes >= 2) {
          score += 35;
          reasons.push(`${faltas} faltas/cancelamentos em ${totalSessoes} sessões (${Math.round(taxaFalta)}%)`);
        } else if (taxaFalta >= 30 && totalSessoes >= 2) {
          score += 20;
          reasons.push(`${Math.round(taxaFalta)}% de faltas recentes`);
        }

        // Overdue payments
        if (pagAtrasados >= 2) {
          score += 30;
          reasons.push(`${pagAtrasados} pagamentos em atraso`);
        } else if (pagAtrasados === 1) {
          score += 15;
          reasons.push("1 pagamento em atraso");
        }

        // Days without session
        if (diasSemSessao > 30) {
          score += 25;
          reasons.push(`${diasSemSessao} dias sem sessão realizada`);
        } else if (diasSemSessao > 14) {
          score += 10;
          reasons.push(`${diasSemSessao} dias desde a última sessão`);
        }

        // No future appointments
        const futureAgs = pAgendamentos.filter((a: any) =>
          new Date(a.data_horario) > new Date() && a.status !== "cancelado"
        );
        if (futureAgs.length === 0 && totalSessoes > 0) {
          score += 15;
          reasons.push("Sem agendamentos futuros");
        }

        const riskLevel = score >= 50 ? "alto" : score >= 25 ? "medio" : "baixo";

        return {
          paciente_id: p.id,
          nome: p.nome,
          telefone: p.telefone,
          riskScore: Math.min(score, 100),
          riskLevel,
          reasons,
          lastSession: lastSession?.data_horario || null,
          faltasRecentes: faltas,
          pagamentosAtrasados: pagAtrasados,
        };
      });

      // Sort by risk score descending, filter only medium+ risk
      return risks
        .filter(r => r.riskScore >= 20)
        .sort((a, b) => b.riskScore - a.riskScore);
    },
  });

  const openWhatsApp = (tel: string, nome: string) => {
    const msg = encodeURIComponent(
      `Olá ${nome}! 😊 Percebemos que faz um tempo que você não vem à clínica. Gostaríamos de saber como você está e se podemos ajudar a remarcar seu atendimento. Estamos à disposição!`
    );
    window.open(`https://wa.me/55${tel.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  const riskColors = {
    alto: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    medio: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    baixo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  const riskLabels = { alto: "Alto Risco", medio: "Médio Risco", baixo: "Baixo Risco" };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-destructive" />
          Previsão de Churn
        </CardTitle>
        <CardDescription>
          Pacientes com maior risco de abandono baseado em faltas, pagamentos e frequência.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Analisando dados...</div>
        ) : churnData.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum paciente em risco identificado. 🎉
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {churnData.map((r) => (
              <div key={r.paciente_id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                    r.riskLevel === "alto" ? "bg-destructive/10 text-destructive" :
                    r.riskLevel === "medio" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                  }`}>
                    {r.riskScore}%
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-semibold text-sm text-primary hover:underline cursor-pointer"
                      onClick={() => navigate(`/pacientes/${r.paciente_id}/detalhes`)}
                    >
                      {r.nome}
                    </span>
                    <Badge className={`text-[10px] ${riskColors[r.riskLevel]}`}>
                      {riskLabels[r.riskLevel]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.reasons.map((reason, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {reason}
                      </span>
                    ))}
                  </div>
                  {r.lastSession && (
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Última sessão: {format(new Date(r.lastSession), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                  
                  {/* AI Suggestions */}
                  <AIChurnSuggestions patient={r} />
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600"
                    onClick={() => openWhatsApp(r.telefone, r.nome)}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => navigate(`/pacientes/${r.paciente_id}/detalhes`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
