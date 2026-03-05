import { useState, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type WeeklyScheduleEntry = {
    weekday: number;
    time: string;
    professional_id: string;
    session_duration: number;
};

export type EnrollmentFormData = {
    paciente_id: string;
    monthly_value: string;
    due_day: string;
    start_date: string;
    auto_renew: boolean;
    tipo_atendimento: string;
    desconto: string;
    desconto_tipo: string;
    observacoes: string;
    weekly_schedules: WeeklyScheduleEntry[];
};

const WEEKDAYS = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda-feira" },
    { value: 2, label: "Terça-feira" },
    { value: 3, label: "Quarta-feira" },
    { value: 4, label: "Quinta-feira" },
    { value: 5, label: "Sexta-feira" },
    { value: 6, label: "Sábado" },
];

const WEEKDAY_SHORT: Record<number, string> = {
    0: "Dom",
    1: "Seg",
    2: "Ter",
    3: "Qua",
    4: "Qui",
    5: "Sex",
    6: "Sáb",
};

type Props = {
    formData: EnrollmentFormData;
    setFormData: (data: EnrollmentFormData) => void;
    pacientes: { id: string; nome: string }[];
    profissionais: { user_id: string; nome: string }[];
};

export function EnrollmentForm({ formData, setFormData, pacientes, profissionais }: Props) {
    const [newWeekday, setNewWeekday] = useState<string>("");
    const [newTime, setNewTime] = useState("08:00");
    const [newProfessional, setNewProfessional] = useState("");
    const [newDuration, setNewDuration] = useState("60");
    const [modalidades, setModalidades] = useState<{ id: string; nome: string }[]>([]);

    useEffect(() => {
        const fetchModalidades = async () => {
            const { data } = await supabase
                .from("modalidades")
                .select("id, nome")
                .eq("ativo", true)
                .order("nome");
            setModalidades(data ?? []);
        };
        fetchModalidades();
    }, []);

    const valor = parseFloat(formData.monthly_value) || 0;
    const desconto = parseFloat(formData.desconto) || 0;
    const desconto_valor = formData.desconto_tipo === "percentual" ? (valor * desconto) / 100 : desconto;
    const valor_final = valor - desconto_valor;
    const totalSessoes = formData.weekly_schedules.length > 0
        ? Math.round(formData.weekly_schedules.length * 4.33) // avg weeks/month
        : 0;
    const valorPorSessao = totalSessoes > 0 ? (valor_final / totalSessoes).toFixed(2) : "0.00";

    const addSchedule = () => {
        if (newWeekday === "" || !newTime || !newProfessional) return;
        const weekday = Number(newWeekday);
        // Allow same weekday with different professionals
        const updated = [
            ...formData.weekly_schedules,
            {
                weekday,
                time: newTime,
                professional_id: newProfessional,
                session_duration: parseInt(newDuration) || 60,
            },
        ];
        setFormData({ ...formData, weekly_schedules: updated });
        setNewWeekday("");
        setNewTime("08:00");
        setNewProfessional("");
        setNewDuration("60");
    };

    const removeSchedule = (index: number) => {
        const updated = formData.weekly_schedules.filter((_, i) => i !== index);
        setFormData({ ...formData, weekly_schedules: updated });
    };

    const getProfessionalName = (id: string) => {
        return profissionais.find((p) => p.user_id === id)?.nome || "—";
    };

    return (
        <div className="space-y-5">
            {/* Paciente */}
            <div>
                <Label>Paciente *</Label>
                <Select value={formData.paciente_id} onValueChange={(v) => setFormData({ ...formData, paciente_id: v })}>
                    <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione um paciente" />
                    </SelectTrigger>
                    <SelectContent>
                        {pacientes.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Tipo + Due Day */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Tipo de Atendimento *</Label>
                    <Select value={formData.tipo_atendimento} onValueChange={(v) => setFormData({ ...formData, tipo_atendimento: v })}>
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            {modalidades.map((mod) => (
                                <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Dia do Vencimento (1-31)</Label>
                    <Input
                        type="number"
                        min={1}
                        max={31}
                        className="mt-1"
                        value={formData.due_day}
                        onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                        placeholder="ex: 10"
                    />
                </div>
            </div>

            {/* Valor + Desconto */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Valor Mensal (R$) *</Label>
                    <Input
                        type="number"
                        step="0.01"
                        className="mt-1"
                        value={formData.monthly_value}
                        onChange={(e) => setFormData({ ...formData, monthly_value: e.target.value })}
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <Label>Desconto</Label>
                    <div className="flex gap-2 mt-1">
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.desconto}
                            onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                            placeholder="0"
                        />
                        <Select value={formData.desconto_tipo} onValueChange={(v) => setFormData({ ...formData, desconto_tipo: v })}>
                            <SelectTrigger className="w-20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="percentual">%</SelectItem>
                                <SelectItem value="fixo">R$</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Valor calculado */}
            {valor > 0 && (
                <div className="rounded-md bg-muted/50 border p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor final mensal:</span>
                        <span className="font-semibold">R$ {valor_final.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Sessões estimadas/mês:</span>
                        <span className="font-semibold">{totalSessoes} sessões</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor médio por sessão:</span>
                        <span className="font-semibold text-primary">R$ {valorPorSessao}</span>
                    </div>
                </div>
            )}

            {/* Data de Início */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Data de Início</Label>
                    <Input
                        type="date"
                        className="mt-1"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                </div>
                <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={formData.auto_renew}
                            onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                        />
                        <span className="text-sm font-medium">Renovação automática</span>
                    </label>
                </div>
            </div>

            {/* Frequência Semanal com Múltiplos Profissionais */}
            <div className="space-y-3 border rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Frequência Semanal</Label>
                    {formData.weekly_schedules.length > 0 && (
                        <Badge variant="secondary">{formData.weekly_schedules.length}x / semana</Badge>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs">Dia da Semana</Label>
                        <Select value={newWeekday} onValueChange={setNewWeekday}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {WEEKDAYS.map((d) => (
                                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Horário</Label>
                        <Input type="time" className="mt-1" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs">Profissional</Label>
                        <Select value={newProfessional} onValueChange={setNewProfessional}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {profissionais.map((p) => (
                                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Duração (min)</Label>
                        <Input
                            type="number"
                            className="mt-1"
                            value={newDuration}
                            min={15}
                            step={15}
                            onChange={(e) => setNewDuration(e.target.value)}
                        />
                    </div>
                </div>

                <Button type="button" size="sm" variant="secondary" className="gap-2 w-full" onClick={addSchedule}
                    disabled={newWeekday === "" || !newTime || !newProfessional}>
                    <Plus className="h-4 w-4" />
                    Adicionar horário
                </Button>

                {formData.weekly_schedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhum horário configurado ainda.</p>
                ) : (
                    <div className="space-y-2 mt-2">
                        {formData.weekly_schedules.map((s, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 border">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="font-mono text-xs">{WEEKDAY_SHORT[s.weekday]}</Badge>
                                    <span className="text-sm font-medium">{s.time}</span>
                                    <span className="text-sm text-muted-foreground">• {getProfessionalName(s.professional_id)}</span>
                                    <span className="text-xs text-muted-foreground">{s.session_duration}min</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeSchedule(index)}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Observações */}
            <div>
                <Label>Observações</Label>
                <Textarea
                    className="mt-1"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Notas sobre a matrícula..."
                    rows={3}
                />
            </div>
        </div>
    );
}
