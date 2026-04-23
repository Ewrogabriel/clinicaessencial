/**
 * AlertsWidget — "O que precisa da minha atenção hoje?"
 * Shows prioritized action items: overdue payments, expiring contracts,
 * patients absent 15+ days, unsigned contracts, and pending reposições.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, UserX, CreditCard, BellRing, ArrowRight, CheckCircle2 } from "lucide-react";
import { subDays } from "date-fns";

interface AlertItem {
  id: string;
  type: "payment" | "contract" | "absent" | "unsigned_contract";
  label: string;
  detail: string;
  severity: "high" | "medium" | "low";
  route: string;
}

const SEVERITY_CONFIG = {
  high: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", badge: "destructive" as const },
  medium: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30", badge: "outline" as const },
  low: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30", badge: "outline" as const },
};

const TYPE_ICON = {
  payment: CreditCard,
  contract: FileText,
  absent: UserX,
  unsigned_contract: FileText,
};

export function AlertsWidget() {
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();

  const { data: alerts = [], isLoading } = useQuery<AlertItem[]>({
    queryKey: ["dashboard-alerts-widget", activeClinicId],
    queryFn: async () => {
      const items: AlertItem[] = [];
      const today = new Date().toISOString().split("T")[0];
      const fifteenDaysAgo = subDays(new Date(), 15).toISOString();

      // 1. Overdue payments
      let payQ = supabase
        .from("pagamentos")
        .select("id, descricao, paciente_id")
        .eq("status", "pendente")
        .lte("data_vencimento", today);
      if (activeClinicId) payQ = payQ.eq("clinic_id", activeClinicId);
      const { data: overduePayments } = await payQ;
      if (overduePayments && overduePayments.length > 0) {
        items.push({
          id: "overdue-payments",
          type: "payment",
          label: `${overduePayments.length} pagamento(s) em atraso`,
          detail: "Confirme ou entre em contato com os pacientes",
          severity: "high",
          route: "/financeiro",
        });
      }

      // 2. Patients absent 15+ days (had appointments but none recently)
      let absentQ = supabase
        .from("agendamentos")
        .select("paciente_id, pacientes(nome)")
        .lt("data_horario", fifteenDaysAgo)
        .not("status", "in", '("cancelado","falta")');
      if (activeClinicId) absentQ = absentQ.eq("clinic_id", activeClinicId);
      const { data: absentData } = await absentQ;

      if (absentData && absentData.length > 0) {
        // Get patients who DO have recent appointments
        let recentQ = supabase
          .from("agendamentos")
          .select("paciente_id")
          .gte("data_horario", fifteenDaysAgo)
          .not("status", "in", '("cancelado","falta")');
        if (activeClinicId) recentQ = recentQ.eq("clinic_id", activeClinicId);
        const { data: recentData } = await recentQ;
        const recentPacienteIds = new Set((recentData || []).map((r: any) => r.paciente_id));
        
        const absentPatients = absentData
          .filter((a: any) => !recentPacienteIds.has(a.paciente_id))
          .map((a: any) => (a as any).pacientes?.nome)
          .filter(Boolean);
        
        const uniqueAbsent = [...new Set(absentPatients)];
        if (uniqueAbsent.length > 0) {
          items.push({
            id: "absent-patients",
            type: "absent",
            label: `${uniqueAbsent.length} paciente(s) ausente(s) há 15+ dias`,
            detail: uniqueAbsent.slice(0, 3).join(", ") + (uniqueAbsent.length > 3 ? "..." : ""),
            severity: "medium",
            route: "/relatorios",
          });
        }
      }

      // 3. Contracts without signature
      let contrQ = (supabase as any)
        .from("contratos_pacientes")
        .select("id, titulo")
        .eq("status", "pendente");
      if (activeClinicId) contrQ = contrQ.eq("clinic_id", activeClinicId);
      const { data: unsignedContracts } = (await contrQ) as { data: any[] | null };
      if (unsignedContracts && unsignedContracts.length > 0) {
        items.push({
          id: "unsigned-contracts",
          type: "unsigned_contract",
          label: `${unsignedContracts.length} contrato(s) pendente(s) de assinatura`,
          detail: "Clique para verificar e coletar assinaturas",
          severity: "low",
          route: "/contratos",
        });
      }

      return items.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.severity] - order[b.severity];
      });
    },
    enabled: !!activeClinicId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-500" />
            Atenção Necessária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">Tudo em dia! 🎉</p>
            <p className="text-xs text-green-600 dark:text-green-400">Nenhum item requer atenção no momento.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highCount = alerts.filter(a => a.severity === "high").length;

  return (
    <Card className={highCount > 0 ? "border-destructive/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className={`h-5 w-5 ${highCount > 0 ? "text-destructive" : "text-amber-500"}`} />
            Atenção Necessária
          </CardTitle>
          {highCount > 0 && (
            <Badge variant="destructive" className="text-xs">{highCount} urgente{highCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {alerts.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          const Icon = TYPE_ICON[alert.type];
          return (
            <button
              key={alert.id}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${cfg.bg}`}
              onClick={() => navigate(alert.route)}
            >
              <div className={`shrink-0 ${cfg.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${cfg.color}`}>{alert.label}</p>
                <p className="text-xs text-muted-foreground truncate">{alert.detail}</p>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
