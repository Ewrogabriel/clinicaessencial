import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addWeeks, setHours as setH, setMinutes as setM, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Repeat, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkAvailability, type AvailabilityCheckResult } from "@/lib/availabilityCheck";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

const DIAS_SEMANA = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const formSchema = z.object({
  paciente_id: z.string().min(1, "Selecione um paciente"),
  profissional_id: z.string().min(1, "Selecione um profissional"),
  data: z.date({ required_error: "Selecione a data" }),
  horario: z.string().min(1, "Informe o horário"),
  duracao_minutos: z.number().min(15).max(120),
  tipo_atendimento: z.string().min(1, "Selecione a modalidade"),
  tipo_sessao: z.enum(["individual", "grupo"]),
  observacoes: z.string().optional(),
  recorrente: z.boolean().default(false),
  dias_semana: z.array(z.number()).default([]),
  frequencia_semanal: z.number().min(1).max(7).default(1),
  recorrencia_semanas: z.number().min(1).max(200).default(52),
  horarios_por_dia: z.record(z.string(), z.string()).default({}),
  valor_sessao: z.number().min(0).optional(),
  valor_mensal: z.number().min(0).optional(),
  repetir: z.boolean().default(false),
  repetir_tipo: z.enum(["vezes", "semanas"]).default("vezes"),
  repetir_quantidade: z.number().min(1).max(52).default(4),
});

type FormData = z.infer<typeof formSchema>;

interface Paciente {
  id: string;
  nome: string;
}

interface Profissional {
  id: string;
  user_id: string;
  nome: string;
}

interface Modalidade {
  id: string;
  nome: string;
}

interface AgendamentoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: Date;
}

export function AgendamentoForm({ open, onOpenChange, onSuccess, defaultDate }: AgendamentoFormProps) {
  const { user, clinicId } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      duracao_minutos: 50,
      tipo_atendimento: "",
      tipo_sessao: "individual",
      horario: "08:00",
      observacoes: "",
      recorrente: false,
      dias_semana: [],
      frequencia_semanal: 1,
      recorrencia_semanas: 52,
      horarios_por_dia: {},
      valor_sessao: undefined,
      valor_mensal: undefined,
      repetir: false,
      repetir_tipo: "vezes",
      repetir_quantidade: 4,
    },
  });

  const isRecorrente = form.watch("recorrente");
  const diasSelecionados = form.watch("dias_semana");
  const freqSemanal = form.watch("frequencia_semanal");
  const tipoAtendimento = form.watch("tipo_atendimento");
  const watchedProfId = form.watch("profissional_id");
  const watchedDate = form.watch("data");
  const watchedHorario = form.watch("horario");
  const isRepetir = form.watch("repetir");
  const repetirTipo = form.watch("repetir_tipo");
  const repetirQuantidade = form.watch("repetir_quantidade");

  // Check availability when professional, date, or time changes (single appointments only)
  useEffect(() => {
    if (!watchedProfId || !watchedDate || !watchedHorario || isRecorrente) {
      setAvailabilityResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingAvailability(true);
      const [h, m] = watchedHorario.split(":").map(Number);
      const dt = new Date(watchedDate);
      dt.setHours(h, m, 0, 0);
      const result = await checkAvailability(watchedProfId, dt);
      setAvailabilityResult(result);
      setCheckingAvailability(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [watchedProfId, watchedDate, watchedHorario, isRecorrente]);

  useEffect(() => {
    if (defaultDate) {
      form.setValue("data", defaultDate);
    }
  }, [defaultDate, form]);

  useEffect(() => {
    if (open) {
      fetchPacientes();
      fetchProfissionais();
      fetchModalidades();
    }
  }, [open]);

  const freqLabel = freqSemanal === 1 ? "1x" : freqSemanal === 2 ? "2x" : freqSemanal === 3 ? "3x" : `${freqSemanal}x`;

  const fetchPacientes = async () => {
    const { data } = await (supabase.from("pacientes") as any)
      .select("id, nome")
      .eq("status", "ativo")
      .order("nome");
    setPacientes(data ?? []);
  };

  const fetchProfissionais = async () => {
    const { data } = await (supabase.from("profiles") as any)
      .select("id, user_id, nome")
      .order("nome");
    setProfissionais(data ?? []);
  };

  const fetchModalidades = async () => {
    const { data } = await supabase
      .from("modalidades")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    setModalidades(data ?? []);
  };

  const toggleDia = (dia: number) => {
    const current = form.getValues("dias_semana");
    const currentHorarios = form.getValues("horarios_por_dia");
    if (current.includes(dia)) {
      form.setValue("dias_semana", current.filter((d) => d !== dia));
      const { [String(dia)]: _, ...rest } = currentHorarios;
      form.setValue("horarios_por_dia", rest);
    } else {
      form.setValue("dias_semana", [...current, dia].sort());
      form.setValue("horarios_por_dia", { ...currentHorarios, [String(dia)]: "08:00" });
    }
  };

  const generateRecurringDates = (values: FormData): Date[] => {
    const dates: Date[] = [];
    const startDate = values.data;
    const totalWeeks = values.recorrencia_semanas;

    if (!values.recorrente) return dates;

    for (let week = 0; week < totalWeeks; week++) {
      for (const dia of values.dias_semana) {
        const diaHorario = values.horarios_por_dia[String(dia)] || values.horario || "08:00";
        const [h, m] = diaHorario.split(":").map(Number);

        const weekStart = addWeeks(startDate, week);
        const dayOffset = (dia - weekStart.getDay() + 7) % 7;
        const targetDate = addDays(weekStart, dayOffset);

        if (targetDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
          const dt = setM(setH(targetDate, h), m);
          dates.push(dt);
        }
      }
    }

    const unique = Array.from(
      new Set(dates.map((d) => d.toISOString()))
    ).map((iso) => new Date(iso));
    unique.sort((a, b) => a.getTime() - b.getTime());

    return unique;
  };

  const onSubmit = async (values: FormData) => {
    if (!user) return;
    setLoading(true);

    try {
      if (isRecorrente) {
        // Validation: days must match frequency
        if (values.dias_semana.length !== values.frequencia_semanal) {
          toast({
            title: "Atenção",
            description: `Você selecionou ${values.dias_semana.length} dia(s) mas a frequência é ${values.frequencia_semanal}x. Ajuste para que coincidam.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const dates = generateRecurringDates(values);
        if (dates.length === 0) {
          toast({ title: "Nenhuma data gerada", description: "Verifique os dias e o período.", variant: "destructive" });
          setLoading(false);
          return;
        }

        const grupoId = crypto.randomUUID();
        const records = dates.map((dt) => ({
          paciente_id: values.paciente_id,
          profissional_id: values.profissional_id,
          data_horario: dt.toISOString(),
          duracao_minutos: values.duracao_minutos,
          tipo_atendimento: values.tipo_atendimento,
          tipo_sessao: values.tipo_sessao,
          observacoes: values.observacoes || null,
          created_by: user.id,
          recorrente: true,
          recorrencia_grupo_id: grupoId,
          dias_semana: values.dias_semana,
          frequencia_semanal: values.frequencia_semanal,
          valor_mensal: values.valor_mensal || null,
        }));

        const { error } = await (supabase.from("agendamentos") as any).insert(records);
        if (error) throw error;

        toast({
          title: "Agendamentos recorrentes criados!",
          description: `${dates.length} sessões agendadas.`,
        });
      } else {
        const [hours, minutes] = values.horario.split(":").map(Number);
        const dataHorario = new Date(values.data);
        dataHorario.setHours(hours, minutes, 0, 0);

        if (values.repetir && values.repetir_quantidade > 1) {
          // Repeat same day/time for X occurrences (weekly interval)
          const totalOccurrences = values.repetir_tipo === "vezes"
            ? values.repetir_quantidade
            : values.repetir_quantidade; // semanas = same number
          const grupoId = crypto.randomUUID();
          const records = [];
          for (let i = 0; i < totalOccurrences; i++) {
            const dt = addWeeks(dataHorario, i);
            records.push({
              paciente_id: values.paciente_id,
              profissional_id: values.profissional_id,
              data_horario: dt.toISOString(),
              duracao_minutos: values.duracao_minutos,
              tipo_atendimento: values.tipo_atendimento,
              tipo_sessao: values.tipo_sessao,
              observacoes: values.observacoes || null,
              created_by: user.id,
              recorrente: true,
              recorrencia_grupo_id: grupoId,
              valor_sessao: values.valor_sessao || null,
            });
          }
          const { error } = await (supabase.from("agendamentos") as any).insert(records);
          if (error) throw error;
          toast({
            title: "Sessões repetidas criadas!",
            description: `${totalOccurrences} sessões agendadas (mesmo dia/horário, semanalmente).`,
          });
        } else {
          const { error } = await (supabase.from("agendamentos") as any).insert({
            paciente_id: values.paciente_id,
            profissional_id: values.profissional_id,
            data_horario: dataHorario.toISOString(),
            duracao_minutos: values.duracao_minutos,
            tipo_atendimento: values.tipo_atendimento,
            tipo_sessao: values.tipo_sessao,
            observacoes: values.observacoes || null,
            created_by: user.id,
            valor_sessao: values.valor_sessao || null,
          });
          if (error) throw error;
          toast({ title: "Agendamento criado com sucesso!" });
        }
      }

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro ao criar agendamento", description: errorMessage, variant: "destructive" });
    }

    setLoading(false);
  };

  const previewCount = isRecorrente && diasSelecionados.length > 0
    ? diasSelecionados.length * form.watch("recorrencia_semanas")
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Plus_Jakarta_Sans]">Novo Agendamento</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paciente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pacientes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profissional_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profissionais.map((p) => (
                        <SelectItem key={p.id} value={p.user_id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_atendimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modalidades.map((mod) => (
                          <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_sessao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Sessão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="grupo">Grupo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isRecorrente && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="horario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duracao_minutos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="50">50 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {isRecorrente && (
              <FormField
                control={form.control}
                name="duracao_minutos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração por sessão</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="50">50 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Valor - sessão única */}
            {!isRecorrente && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Valor da Consulta/Sessão</Label>
                </div>
                <FormField
                  control={form.control}
                  name="valor_sessao"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            className="pl-10"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Repetir sessão (para agendamento único) */}
            {!isRecorrente && (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">Repetir esta sessão</Label>
                  </div>
                  <FormField
                    control={form.control}
                    name="repetir"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {isRepetir && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Repete no mesmo dia da semana e horário, semanalmente.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Repetir por</Label>
                        <Input
                          type="number"
                          min={2}
                          max={52}
                          className="mt-1"
                          value={repetirQuantidade}
                          onChange={(e) => form.setValue("repetir_quantidade", Number(e.target.value) || 4)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={repetirTipo}
                          onValueChange={(v) => form.setValue("repetir_tipo", v as "vezes" | "semanas")}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vezes">vezes</SelectItem>
                            <SelectItem value="semanas">semanas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      Serão criadas <span className="font-semibold text-foreground">{repetirQuantidade}</span> sessões no mesmo dia/horário, uma por semana.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Atendimento Recorrente</Label>
                </div>
                <FormField
                  control={form.control}
                  name="recorrente"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {isRecorrente && (
                <div className="space-y-4 pt-2">
                  {/* Frequência semanal */}
                  <FormField
                    control={form.control}
                    name="frequencia_semanal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Quantidade por semana
                          <span className="ml-2 text-xs text-muted-foreground">
                            (ex: {tipoAtendimento || "Sessão"} {freqLabel}/semana)
                          </span>
                        </FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(Number(v))}
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1x por semana</SelectItem>
                            <SelectItem value="2">2x por semana</SelectItem>
                            <SelectItem value="3">3x por semana</SelectItem>
                            <SelectItem value="4">4x por semana</SelectItem>
                            <SelectItem value="5">5x por semana</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dias da semana */}
                  <div>
                    <Label className="text-sm font-medium">
                      Dias da semana
                      <span className="ml-2 text-xs text-muted-foreground">
                        (selecione {freqSemanal} dia{freqSemanal > 1 ? "s" : ""})
                      </span>
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DIAS_SEMANA.map((dia) => {
                        const selected = diasSelecionados.includes(dia.value);
                        return (
                          <button
                            key={dia.value}
                            type="button"
                            onClick={() => toggleDia(dia.value)}
                            className={cn(
                              "px-3 py-2 rounded-md text-sm font-medium border transition-colors",
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                            )}
                          >
                            {dia.label}
                          </button>
                        );
                      })}
                    </div>
                    {diasSelecionados.length > 0 && diasSelecionados.length !== freqSemanal && (
                      <p className="text-xs text-destructive mt-1">
                        Selecione exatamente {freqSemanal} dia{freqSemanal > 1 ? "s" : ""} para combinar com a frequência
                      </p>
                    )}
                  </div>

                  {/* Horários individuais por dia */}
                  {diasSelecionados.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Horário por dia</Label>
                      <div className="space-y-2">
                        {DIAS_SEMANA.filter(d => diasSelecionados.includes(d.value)).map((dia) => {
                          const horariosDia = form.watch("horarios_por_dia");
                          const horarioDia = horariosDia[String(dia.value)] || "08:00";
                          return (
                            <div key={dia.value} className="flex items-center gap-3 rounded-md border p-2">
                              <span className="text-sm font-medium w-12">{dia.label}</span>
                              <Input
                                type="time"
                                value={horarioDia}
                                onChange={(e) => {
                                  const current = form.getValues("horarios_por_dia");
                                  form.setValue("horarios_por_dia", {
                                    ...current,
                                    [String(dia.value)]: e.target.value,
                                  });
                                }}
                                className="w-32"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="data"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Início a partir de</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={ptBR}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Valor mensal */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium text-sm">Pagamento Mensal</Label>
                    </div>
                    <FormField
                      control={form.control}
                      name="valor_mensal"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ex: 180,00"
                                className="pl-10"
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Valor mensal do pacote (ex: Pilates {freqLabel}/semana)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Preview - tempo indeterminado */}
                  {diasSelecionados.length > 0 && diasSelecionados.length === freqSemanal && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-foreground">
                        ♾️ Agendamento recorrente por tempo indeterminado
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {freqLabel}/semana · {DIAS_SEMANA.filter(d => diasSelecionados.includes(d.value)).map(d => d.label).join(", ")}
                        {form.watch("valor_mensal") ? ` · R$ ${form.watch("valor_mensal")?.toFixed(2)}/mês` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Serão criadas {previewCount} sessões ({form.watch("recorrencia_semanas")} semanas iniciais)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Data (only for single appointments) */}
            {!isRecorrente && (
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre o agendamento..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Availability Alert */}
            {!isRecorrente && availabilityResult && (
              <Alert variant={availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity ? "default" : "destructive"} className="flex items-start gap-2">
                {availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                )}
                <AlertDescription className="text-sm">
                  {availabilityResult.message}
                  {availabilityResult.isOverCapacity && (
                    <span className="block text-xs mt-1 opacity-80">
                      O agendamento será criado, mas excederá a capacidade configurada.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Salvando..."
                  : isRecorrente
                    ? `Agendar ${previewCount} sessões`
                    : isRepetir
                      ? `Agendar ${repetirQuantidade} sessões`
                      : "Agendar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
