import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Repeat, CalendarIcon, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FinancialSection } from "./FinancialSection";
import { DIAS_SEMANA } from "./types";
import type { UseFormReturn } from "react-hook-form";
import type { FormData, FormaPagamento } from "./types";

interface RecurrenceSectionProps {
  form: UseFormReturn<FormData>;
  formasPagamento: FormaPagamento[];
  monthlyAvail: Record<number, number>;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  watchedProfId: string;
}

export function RecurrenceSection({ form, formasPagamento, monthlyAvail, currentMonth, setCurrentMonth, watchedProfId }: RecurrenceSectionProps) {
  const isRecorrente = form.watch("recorrente");
  const diasSelecionados = form.watch("dias_semana");
  const freqSemanal = form.watch("frequencia_semanal");
  const tipoAtendimento = form.watch("tipo_atendimento");
  const previewCount = diasSelecionados.length * form.watch("recorrencia_semanas");
  const freqLabel = `${freqSemanal}x`;

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

  return (
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
          {/* Duration */}
          <FormField
            control={form.control}
            name="duracao_minutos"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração por sessão</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* Frequency */}
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
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}x por semana</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Day selection */}
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

          {/* Per-day time inputs */}
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
                          form.setValue("horarios_por_dia", { ...current, [String(dia.value)]: e.target.value });
                        }}
                        className="w-32"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start date */}
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
                        className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
                      onSelect={(date) => { field.onChange(date); if (date) setCurrentMonth(date); }}
                      onMonthChange={setCurrentMonth}
                      locale={ptBR}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0}
                      className="rounded-md border shadow-sm"
                      components={{
                        Day: ({ date, ...props }: any) => {
                          const vacancies = monthlyAvail[date.getDate()];
                          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                          const isSunday = date.getDay() === 0;
                          return (
                            <div {...props} className="relative w-full h-full flex flex-col items-center justify-center pt-1">
                              <span>{date.getDate()}</span>
                              {watchedProfId && !isPast && !isSunday && (
                                <span className={cn(
                                  "text-[9px] mt-0.5 px-1 rounded-full",
                                  vacancies > 0 ? "bg-green-100 text-green-700 font-bold" : "bg-red-100 text-red-600"
                                )}>
                                  {vacancies}v
                                </span>
                              )}
                            </div>
                          );
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Recurring financials */}
          <FinancialSection form={form} formasPagamento={formasPagamento} showValorMensal />

          {/* Preview */}
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
  );
}
