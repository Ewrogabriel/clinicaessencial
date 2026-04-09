import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import { Textarea } from "@/components/ui/textarea";
import { SchedulePickerCards } from "./SchedulePickerCards";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

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
    tipo_sessao: 'individual' | 'grupo';
    desconto: string;
    desconto_tipo: string;
    observacoes: string;
    weekly_schedules: WeeklyScheduleEntry[];
    preco_plano_id?: string;
};

type Props = {
    formData: EnrollmentFormData;
    setFormData: (data: EnrollmentFormData) => void;
    pacientes: { id: string; nome: string; cpf?: string | null }[];
    profissionais: { user_id: string; nome: string }[];
};

export function EnrollmentForm({ formData, setFormData, pacientes, profissionais }: Props) {
    const { activeClinicId } = useClinic();
    const [modalidades, setModalidades] = useState<{ id: string; nome: string }[]>([]);
    const [precosPlanos, setPrecosPlanos] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const [modRes, planosRes] = await Promise.all([
                supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome"),
                supabase.from("precos_planos").select("*").eq("ativo", true).order("nome"),
            ]);
            setModalidades(modRes.data ?? []);
            setPrecosPlanos(planosRes.data ?? []);
        };
        fetchData();
    }, []);

    const handlePlanoChange = (planoId: string) => {
        if (planoId === "manual") {
            setFormData({ ...formData, preco_plano_id: undefined });
            return;
        }
        const plano = precosPlanos.find((p: any) => p.id === planoId);
        if (plano) {
            setFormData({
                ...formData,
                preco_plano_id: planoId,
                monthly_value: String(plano.valor),
                tipo_atendimento: plano.modalidade?.toLowerCase() || formData.tipo_atendimento,
            });
        }
    };

    const valor = parseFloat(formData.monthly_value) || 0;
    const desconto = parseFloat(formData.desconto) || 0;
    const desconto_valor = formData.desconto_tipo === "percentual" ? (valor * desconto) / 100 : desconto;
    const valor_final = valor - desconto_valor;
    const totalSessoes = formData.weekly_schedules.length > 0
        ? Math.round(formData.weekly_schedules.length * 4.33)
        : 0;
    const valorPorSessao = totalSessoes > 0 ? (valor_final / totalSessoes).toFixed(2) : "0.00";

    return (
        <div className="space-y-5">
            {/* Paciente */}
            <div>
                <Label>Paciente *</Label>
                <PatientCombobox
                    patients={pacientes}
                    value={formData.paciente_id}
                    onValueChange={(v) => setFormData({ ...formData, paciente_id: v })}
                />
            </div>

            {/* Tipo + Sessão + Due Day */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label>Modalidade *</Label>
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
                    <Label>Tipo de Sessão *</Label>
                    <Select value={formData.tipo_sessao} onValueChange={(v: any) => setFormData({ ...formData, tipo_sessao: v })}>
                        <SelectTrigger className="mt-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="individual">Individual</SelectItem>
                            <SelectItem value="grupo">Grupo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Vencimento (1-31)</Label>
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
                        onChange={(e) => setFormData({ ...formData, monthly_value: e.target.value, preco_plano_id: undefined })}
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

            {/* Schedule Picker with Cards */}
            <div className="border rounded-xl p-4">
                <SchedulePickerCards
                    schedules={formData.weekly_schedules}
                    onSchedulesChange={(updated) => setFormData({ ...formData, weekly_schedules: updated })}
                    profissionais={profissionais}
                    clinicId={activeClinicId}
                />
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
