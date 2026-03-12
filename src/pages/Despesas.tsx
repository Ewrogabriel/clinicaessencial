import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, Trash2, Filter, Receipt, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

const categorias = ["aluguel", "luz", "agua", "internet", "limpeza", "pessoal", "impostos", "insumos", "marketing", "outros"];

const Despesas = () => {
    const { activeClinicId } = useClinic();
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const deferredBusca = useMemo(() => busca, [busca]); // Placeholder se não quiser useDeferredValue direto
    const [dialogOpen, setDialogOpen] = useState(false);

    const [formData, setFormData] = useState({
        descricao: "",
        valor: "",
        data_vencimento: format(new Date(), "yyyy-MM-dd"),
        categoria: "outros",
        status: "pendente" as "pendente" | "pago",
    });

    const { data: despesas = [], isLoading } = useQuery({
        queryKey: ["despesas", activeClinicId],
        queryFn: async () => {
            if (!activeClinicId) return [];
            const { data, error } = await supabase
                .from("expenses")
                .select("id, descricao, valor, data_vencimento, categoria, status")
                .eq("clinic_id", activeClinicId)
                .order("data_vencimento", { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from("expenses").insert({
                clinic_id: activeClinicId || "",
                descricao: formData.descricao,
                valor: parseFloat(formData.valor),
                data_vencimento: formData.data_vencimento,
                categoria: formData.categoria,
                status: formData.status,
                data_pagamento: formData.status === "pago" ? new Date().toISOString() : null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["despesas"] });
            toast({ title: "Despesa registrada!" });
            setDialogOpen(false);
            setFormData({ descricao: "", valor: "", data_vencimento: format(new Date(), "yyyy-MM-dd"), categoria: "outros", status: "pendente" });
        },
        onError: (error: Error) => {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("expenses").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["despesas"] });
            toast({ title: "Despesa excluída" });
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async (despesa: { id: string; status: string }) => {
            const newStatus = despesa.status === "pendente" ? "pago" : "pendente";
            const { error } = await supabase.from("expenses")
                .update({ status: newStatus, data_pagamento: newStatus === "pago" ? new Date().toISOString() : null })
                .eq("id", despesa.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["despesas"] });
            toast({ title: "Status atualizado" });
        },
    });

    const filtrados = (despesas || []).filter((d) =>
        d.descricao?.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Despesas</h1>
                    <p className="text-muted-foreground">Controle de custos fixos e variáveis da clínica</p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Despesa
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar despesa..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando...</div>
                    ) : filtrados.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Nenhuma despesa encontrada.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Vencimento</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtrados.map((d) => (
                                    <TableRow key={d.id}>
                                        <TableCell className="font-medium">{d.descricao}</TableCell>
                                        <TableCell className="capitalize">
                                            <Badge variant="outline">{d.categoria}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3 w-3 opacity-50" />
                                                {d.data_vencimento ? new Date(d.data_vencimento).toLocaleDateString() : "—"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            R$ {Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent" onClick={() => toggleStatusMutation.mutate(d)}>
                                                <Badge variant={d.status === "pago" ? "default" : "destructive"}>
                                                    {d.status === "pago" ? "Pago" : "Pendente"}
                                                </Badge>
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Lançar Despesa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Descrição *</Label>
                            <Input value={formData.descricao} onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Aluguel, Luz, Papelaria..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor (R$) *</Label>
                                <Input type="number" step="0.01" value={formData.valor} onChange={(e) => setFormData(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Vencimento *</Label>
                                <Input type="date" value={formData.data_vencimento} onChange={(e) => setFormData(p => ({ ...p, data_vencimento: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select value={formData.categoria} onValueChange={(v) => setFormData(p => ({ ...p, categoria: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {categorias.map(c => (
                                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={(v: "pendente" | "pago") => setFormData(p => ({ ...p, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendente">Pendente</SelectItem>
                                        <SelectItem value="pago">Pago</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={!formData.descricao || !formData.valor}>
                            Salvar Despesa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Despesas;
