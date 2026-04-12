import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, DollarSign, ClipboardList, Stethoscope, 
  FileCheck, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PatientTimelineProps {
  pacienteId: string;
}

type EventType = 'agendamento' | 'pagamento' | 'evolucao' | 'avaliacao' | 'matricula';

interface TimelineEvent {
  id: string;
  date: Date;
  type: EventType;
  title: string;
  description: string;
  status?: string;
  value?: number;
  icon: any;
  colorClass: string;
  bgClass: string;
}

const TYPE_CONFIG: Record<EventType, { label: string; colorClass: string; bgClass: string }> = {
  agendamento: { label: "Sessão", colorClass: "text-blue-600 dark:text-blue-400", bgClass: "bg-blue-100 dark:bg-blue-900/40" },
  pagamento: { label: "Pagamento", colorClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-100 dark:bg-emerald-900/40" },
  evolucao: { label: "Evolução", colorClass: "text-purple-600 dark:text-purple-400", bgClass: "bg-purple-100 dark:bg-purple-900/40" },
  avaliacao: { label: "Avaliação", colorClass: "text-indigo-600 dark:text-indigo-400", bgClass: "bg-indigo-100 dark:bg-indigo-900/40" },
  matricula: { label: "Matrícula", colorClass: "text-orange-600 dark:text-orange-400", bgClass: "bg-orange-100 dark:bg-orange-900/40" },
};

const STATUS_ICON: Record<string, { icon: any; className: string }> = {
  realizado: { icon: CheckCircle2, className: "text-emerald-500" },
  pago: { icon: CheckCircle2, className: "text-emerald-500" },
  falta: { icon: XCircle, className: "text-red-500" },
  atrasado: { icon: XCircle, className: "text-red-500" },
  cancelado: { icon: XCircle, className: "text-red-500" },
};

export const PatientTimeline = ({ pacienteId }: PatientTimelineProps) => {
  const [activeFilter, setActiveFilter] = useState<EventType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(20);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["patient-timeline", pacienteId],
    queryFn: async () => {
      const results: TimelineEvent[] = [];

      const [agendamentos, pagamentos, evolucoes, avaliacoes, matriculas] = await Promise.all([
        supabase.from("agendamentos").select("id, data_horario, tipo_atendimento, status").eq("paciente_id", pacienteId).order("data_horario", { ascending: false }),
        supabase.from("pagamentos").select("id, valor, status, data_pagamento, data_vencimento, created_at, descricao, forma_pagamento").eq("paciente_id", pacienteId).order("created_at", { ascending: false }),
        supabase.from("evolutions").select("id, data_evolucao, descricao").eq("paciente_id", pacienteId).order("data_evolucao", { ascending: false }),
        supabase.from("evaluations").select("id, data_avaliacao, queixa_principal").eq("paciente_id", pacienteId).order("data_avaliacao", { ascending: false }),
        supabase.from("matriculas").select("id, created_at, valor_mensal, tipo_atendimento, status").eq("paciente_id", pacienteId).order("created_at", { ascending: false }),
      ]);

      agendamentos.data?.forEach((a) => {
        const cfg = TYPE_CONFIG.agendamento;
        results.push({
          id: `ag-${a.id}`, date: new Date(a.data_horario), type: "agendamento",
          title: a.tipo_atendimento || "Sessão",
          description: `${format(new Date(a.data_horario), "HH:mm")} — ${a.status}`,
          status: a.status, icon: Calendar,
          colorClass: cfg.colorClass, bgClass: cfg.bgClass,
        });
      });

      pagamentos.data?.forEach((p) => {
        const cfg = TYPE_CONFIG.pagamento;
        results.push({
          id: `pg-${p.id}`, date: new Date(p.data_pagamento || p.data_vencimento || p.created_at), type: "pagamento",
          title: p.descricao || "Pagamento",
          description: p.status === "pago" ? `Pago via ${p.forma_pagamento || "—"}` : "Pendente",
          status: p.status, value: Number(p.valor), icon: DollarSign,
          colorClass: cfg.colorClass, bgClass: cfg.bgClass,
        });
      });

      evolucoes.data?.forEach((e) => {
        const cfg = TYPE_CONFIG.evolucao;
        results.push({
          id: `ev-${e.id}`, date: new Date(e.data_evolucao), type: "evolucao",
          title: "Evolução Clínica",
          description: e.descricao.substring(0, 120) + (e.descricao.length > 120 ? "…" : ""),
          icon: ClipboardList, colorClass: cfg.colorClass, bgClass: cfg.bgClass,
        });
      });

      avaliacoes.data?.forEach((av) => {
        const cfg = TYPE_CONFIG.avaliacao;
        results.push({
          id: `av-${av.id}`, date: new Date(av.data_avaliacao), type: "avaliacao",
          title: "Avaliação",
          description: av.queixa_principal, icon: Stethoscope,
          colorClass: cfg.colorClass, bgClass: cfg.bgClass,
        });
      });

      matriculas.data?.forEach((m) => {
        const cfg = TYPE_CONFIG.matricula;
        results.push({
          id: `mt-${m.id}`, date: new Date(m.created_at), type: "matricula",
          title: `Matrícula — ${m.tipo_atendimento || ""}`,
          description: `R$ ${Number(m.valor_mensal).toFixed(2)}/mês · ${m.status}`,
          status: m.status, icon: FileCheck,
          colorClass: cfg.colorClass, bgClass: cfg.bgClass,
        });
      });

      return results.sort((a, b) => b.date.getTime() - a.date.getTime());
    },
  });

  const filtered = activeFilter === "all" ? events : events.filter(e => e.type === activeFilter);
  const visible = filtered.slice(0, showCount);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando linha do tempo…</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock className="h-14 w-14 mx-auto mb-4 opacity-15" />
        <p className="text-sm">Nenhuma atividade registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <button
          onClick={() => setActiveFilter("all")}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium",
            activeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
          )}
        >
          Tudo ({events.length})
        </button>
        {(Object.keys(TYPE_CONFIG) as EventType[]).map(type => {
          const count = events.filter(e => e.type === type).length;
          if (count === 0) return null;
          const cfg = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium",
                activeFilter === type ? `${cfg.bgClass} ${cfg.colorClass} border-current` : "border-border hover:bg-muted"
              )}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        <AnimatePresence initial={false}>
          {visible.map((event, idx) => {
            const isExpanded = expandedId === event.id;
            const Icon = event.icon;
            const statusInfo = event.status ? STATUS_ICON[event.status] : null;
            const StatusIcon = statusInfo?.icon || Clock;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: idx * 0.02, duration: 0.25 }}
                className="relative mb-3"
              >
                {/* Dot */}
                <div className={cn(
                  "absolute -left-6 top-3 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 border-background shadow-sm z-10",
                  event.bgClass
                )}>
                  <Icon className={cn("h-3 w-3", event.colorClass)} />
                </div>

                {/* Card */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  className={cn(
                    "ml-4 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm",
                    "bg-card hover:bg-muted/30",
                    isExpanded && "ring-1 ring-primary/20"
                  )}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{event.title}</span>
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium shrink-0", event.colorClass)}>
                          {TYPE_CONFIG[event.type].label}
                        </Badge>
                      </div>
                      <time className="text-[11px] text-muted-foreground font-medium">
                        {format(event.date, "dd MMM yyyy · HH:mm", { locale: ptBR })}
                      </time>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {event.value !== undefined && (
                        <span className={cn(
                          "text-sm font-bold",
                          event.status === "pago" ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          R$ {event.value.toFixed(2)}
                        </span>
                      )}
                      {event.status && (
                        <StatusIcon className={cn("h-4 w-4", statusInfo?.className || "text-muted-foreground")} />
                      )}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs text-foreground/70 leading-relaxed">{event.description}</p>
                          {event.status && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <StatusIcon className={cn("h-3 w-3", statusInfo?.className || "text-amber-500")} />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{event.status}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Load more */}
      {filtered.length > showCount && (
        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" onClick={() => setShowCount(s => s + 20)} className="text-xs gap-1">
            <ChevronDown className="h-3 w-3" /> Carregar mais ({filtered.length - showCount} restantes)
          </Button>
        </div>
      )}
    </div>
  );
};
