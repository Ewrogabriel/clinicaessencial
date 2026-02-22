import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addWeeks, setHours as setH, setMinutes as setM, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
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
  tipo_atendimento: z.enum(["fisioterapia", "pilates", "rpg"]),
  tipo_sessao: z.enum(["individual", "grupo"]),
  observacoes: z.string().optional(),
  recorrente: z.boolean().default(false),
  dias_semana: z.array(z.number()).default([]),
  frequencia_semanal: z.number().min(1).max(7).default(1),
  recorrencia_semanas: z.number().min(1).max(52).default(4),
  horarios_por_dia: z.record(z.string(), z.string()).default({}),
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

interface AgendamentoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: Date;
}

export function AgendamentoForm({ open, onOpenChange, onSuccess, defaultDate }: AgendamentoFormProps) {
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      duracao_minutos: 50,
      tipo_atendimento: "fisioterapia",
      tipo_sessao: "individual",
      horario: "08:00",
      observacoes: "",
      recorrente: false,
      dias_semana: [],
      frequencia_semanal: 1,
      recorrencia_semanas: 4,
      horarios_por_dia: {},
    },
  });

  const isRecorrente = form.watch("recorrente");
  const diasSelecionados = form.watch("dias_semana");
  const freqSemanal = form.watch("frequencia_semanal");
  const tipoAtendimento = form.watch("tipo_atendimento");

  useEffect(() => {
    if (defaultDate) {
      form.setValue("data", defaultDate);
    }
  }, [defaultDate, form]);

  useEffect(() => {
    if (open) {
      fetchPacientes();
      fetchProfissionais();
    }
  }, [open]);

  // Auto-suggest frequency label
  const freqLabel = freqSemanal === 1 ? "1x" : freqSemanal === 2 ? "2x" : freqSemanal === 3 ? "3x" : `${freqSemanal}x`;

  const fetchPacientes = async () => {
    const { data } = await supabase
      .from("pacientes")
      .select("id, nome")
      .eq("status", "ativo")
      .order("nome");
    setPacientes(data ?? []);
  };

  const fetchProfissionais = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, nome")
      .order("nome");
    setProfissionais(data ?? []);
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

    if (values.dias_semana.length === 0) return dates;

    for (let week = 0; week < totalWeeks; week++) {
      for (const dia of values.dias_semana) {
        const diaHorario = values.horarios_por_dia[String(dia)] || "08:00";
        const [hours, minutes] = diaHorario.split(":").map(Number);
        
        const weekStart = addWeeks(startDate, week);
        const dayOffset = (dia - weekStart.getDay() + 7) % 7;
        const targetDate = addDays(weekStart, dayOffset);
        
        if (targetDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
          const dt = setM(setH(targetDate, hours), minutes);
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
      if (values.recorrente && values.dias_semana.length > 0) {
        // Validate frequency matches selected days
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
        }));

        const { error } = await (supabase as any).from("agendamentos").insert(records);
        if (error) throw error;

        toast({
          title: "Agendamentos recorrentes criados!",
          description: `${dates.length} sessões agendadas para ${values.recorrencia_semanas} semanas.`,
        });
      } else {
        // Single appointment
        const [hours, minutes] = values.horario.split(":").map(Number);
        const dataHorario = new Date(values.data);
        dataHorario.setHours(hours, minutes, 0, 0);

        const { error } = await (supabase as any).from("agendamentos").insert({
          paciente_id: values.paciente_id,
          profissional_id: values.profissional_id,
          data_horario: dataHorario.toISOString(),
          duracao_minutos: values.duracao_minutos,
          tipo_atendimento: values.tipo_atendimento,
          tipo_sessao: values.tipo_sessao,
          observacoes: values.observacoes || null,
          created_by: user.id,
        });
        if (error) throw error;

        toast({ title: "Agendamento criado com sucesso!" });
      }

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao criar agendamento", description: error.message, variant: "destructive" });
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
                    <FormLabel>Tipo de Atendimento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                        <SelectItem value="pilates">Pilates</SelectItem>
                        <SelectItem value="rpg">RPG</SelectItem>
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

            {/* Recorrência */}
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
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                          Frequência semanal
                          <span className="ml-2 text-xs text-muted-foreground">
                            (ex: {tipoAtendimento === "pilates" ? "Pilates" : tipoAtendimento === "rpg" ? "RPG" : "Fisio"} {freqLabel}/semana)
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

                  {/* Duração em semanas */}
                  <FormField
                    control={form.control}
                    name="recorrencia_semanas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repetir por</FormLabel>
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
                            <SelectItem value="2">2 semanas</SelectItem>
                            <SelectItem value="4">4 semanas (1 mês)</SelectItem>
                            <SelectItem value="8">8 semanas (2 meses)</SelectItem>
                            <SelectItem value="12">12 semanas (3 meses)</SelectItem>
                            <SelectItem value="24">24 semanas (6 meses)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preview */}
                  {previewCount > 0 && diasSelecionados.length === freqSemanal && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-foreground">
                        📅 {previewCount} sessões serão criadas
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {freqLabel}/semana · {DIAS_SEMANA.filter(d => diasSelecionados.includes(d.value)).map(d => d.label).join(", ")} · {form.watch("recorrencia_semanas")} semanas
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

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : isRecorrente ? `Agendar ${previewCount} sessões` : "Agendar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
