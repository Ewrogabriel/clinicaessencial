import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, DollarSign, ClipboardList, Stethoscope, 
  FileCheck, AlertCircle, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PatientTimelineProps {
  pacienteId: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'agendamento' | 'pagamento' | 'evolucao' | 'avaliacao' | 'matricula';
  title: string;
  description: string;
  status?: string;
  value?: number;
  icon: any;
  color: string;
}

export const PatientTimeline = ({ pacienteId }: PatientTimelineProps) => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["patient-timeline", pacienteId],
    queryFn: async () => {
      const results: TimelineEvent[] = [];

      // 1. Agendamentos
      const { data: agendamentos } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_horario", { ascending: false });

      if (agendamentos) {
        agendamentos.forEach((a) => {
          results.push({
            id: `agenda-${a.id}`,
            date: new Date(a.data_horario),
            type: 'agendamento',
            title: `Sessão: ${a.tipo_atendimento}`,
            description: `Status: ${a.status}`,
            status: a.status,
            icon: Calendar,
            color: a.status === 'realizado' ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50"
          });
        });
      }

      // 2. Pagamentos
      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_vencimento", { ascending: false });

      if (pagamentos) {
        pagamentos.forEach((p) => {
          results.push({
            id: `pg-${p.id}`,
            date: new Date(p.data_pagamento || p.data_vencimento || p.created_at),
            type: 'pagamento',
            title: `Pagamento: ${p.descricao || 'Serviço'}`,
            description: p.status === 'pago' ? `Recebido via ${p.forma_pagamento}` : 'Aguardando pagamento',
            value: Number(p.valor),
            status: p.status,
            icon: DollarSign,
            color: p.status === 'pago' ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
          });
        });
      }

      // 3. Evoluções
      const { data: evolucoes } = await supabase
        .from("evolutions")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_evolucao", { ascending: false });

      if (evolucoes) {
        evolucoes.forEach((e) => {
          results.push({
            id: `evol-${e.id}`,
            date: new Date(e.data_evolucao),
            type: 'evolucao',
            title: "Evolução Clínica",
            description: e.descricao.substring(0, 100) + (e.descricao.length > 100 ? "..." : ""),
            icon: ClipboardList,
            color: "text-purple-600 bg-purple-50"
          });
        });
      }

      // 4. Avaliações
      const { data: avaliacoes } = await supabase
        .from("evaluations")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_avaliacao", { ascending: false });

      if (avaliacoes) {
        avaliacoes.forEach((ev) => {
          results.push({
            id: `eval-${ev.id}`,
            date: new Date(ev.data_avaliacao),
            type: 'avaliacao',
            title: "Avaliação Completa",
            description: `Queixa: ${ev.queixa_principal}`,
            icon: Stethoscope,
            color: "text-indigo-600 bg-indigo-50"
          });
        });
      }

      // 5. Matrículas
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      if (matriculas) {
        matriculas.forEach((m) => {
          results.push({
            id: `mat-${m.id}`,
            date: new Date(m.created_at),
            type: 'matricula',
            title: "Nova Matrícula",
            description: `Plano iniciado. Valor: R$ ${m.valor_mensal}`,
            icon: FileCheck,
            color: "text-orange-600 bg-orange-50"
          });
        });
      }

      return results.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Carregando linha do tempo...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>Nenhuma atividade registrada ainda nesta linha do tempo.</p>
      </div>
    );
  }

  return (
    <div className="relative pb-8 px-4">
      {/* Central Line */}
      <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-border/60" />

      <div className="space-y-8 relative">
        {events.map((event, idx) => (
          <div key={event.id} className="flex gap-4 group">
            {/* Icon Circle */}
            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-background shadow-sm ${event.color}`}>
              <event.icon className="h-4 w-4" />
            </div>

            {/* Content Card */}
            <div className="flex-1 pt-1 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm">{event.title}</h4>
                  <Badge variant="outline" className="text-[10px] py-0 h-4 font-normal uppercase tracking-wider">
                    {event.type}
                  </Badge>
                </div>
                <time className="text-xs text-muted-foreground font-medium">
                  {format(event.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </time>
              </div>

              <Card className="border-border/40 shadow-none bg-muted/20 group-hover:bg-muted/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {event.description}
                    </p>
                    
                    {event.value !== undefined && (
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600">
                          R$ {event.value.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {event.status && (
                    <div className="mt-3 flex items-center gap-1.5 pt-3 border-t border-border/10">
                      {event.status === 'realizado' || event.status === 'pago' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : event.status === 'falta' || event.status === 'atrasado' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className="text-[11px] font-medium uppercase text-muted-foreground tracking-tight">
                        {event.status}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
