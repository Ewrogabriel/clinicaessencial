import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Calendar, DollarSign, Clock, User, AlertTriangle, CheckCircle2, Pause, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  vencido: { label: "Vencido", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  suspenso: { label: "Suspenso", variant: "secondary" },
};

const Matriculas = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPaciente, setFilterPaciente] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  const [formData, setFormData] = useState({
    paciente_id: "",
    profissional_id: "",
    tipo_atendimento: "pilates",
    valor: "",
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_vencimento: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
    desconto: "0",
    desconto_tipo: "percentual",
    duracao_minutos: 60,
    frequencia: "semanal",
    observacoes: "",
    ativo: true,
    total_sessoes: 4,
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas", filterPaciente, filterStatus],
    queryFn: async () => {
      let query = supabase.from("planos").select("*, pacientes(nome), profiles(nome)").eq("status", "ativo");
      
      if (filterPaciente) {
        query = query.ilike("pacientes.nome", `%${filterPaciente}%`);
      }
      if (filterStatus) {
        query = query.eq("status", filterStatus as any);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome");
      return data ?? [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .order("nome");
      return data ?? [];
    },
  });

  const createMatricula = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");

      const desconto = parseFloat(formData.desconto) || 0;
      const valor = parseFloat(formData.valor) || 0;
      const desconto_valor = formData.desconto_tipo === "percentual" 
        ? (valor * desconto) / 100 
        : desconto;
      const valor_final = valor - desconto_valor;

      const { data, error } = await supabase
        .from("planos")
        .insert({
          paciente_id: formData.paciente_id,
          profissional_id: formData.profissional_id || user.id,
          tipo_atendimento: formData.tipo_atendimento,
          valor: valor_final,
          data_inicio: formData.data_inicio,
          data_vencimento: formData.data_vencimento,
          total_sessoes: formData.total_sessoes,
          observacoes: formData.observacoes || null,
          created_by: user.id,
          status: "ativo",
        })
        .select()
        .single();

      if (error) throw error;

      // Criar pagamento associado
      if (valor_final > 0) {
        await supabase.from("pagamentos").insert({
          paciente_id: formData.paciente_id,
          plano_id: data.id,
          profissional_id: formData.profissional_id || user.id,
          valor: valor_final,
          data_vencimento: formData.data_vencimento,
          status: "pendente",
          forma_pagamento: null,
          descricao: `Matrícula - ${formData.tipo_atendimento}`,
          created_by: user.id,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      setFormOpen(false);
      setFormData({
        paciente_id: "",
        profissional_id: "",
        tipo_atendimento: "pilates",
        valor: "",
        data_inicio: format(new Date(), "yyyy-MM-dd"),
        data_vencimento: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
        desconto: "0",
        desconto_tipo: "percentual",
        duracao_minutos: 60,
        frequencia: "semanal",
        observacoes: "",
        ativo: true,
        total_sessoes: 4,
      });
      toast({ title: "Matrícula criada com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar matrícula", description: String(error), variant: "destructive" });
    },
  });

  const suspenderMatricula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("planos")
        .update({ status: "suspenso" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      toast({ title: "Matrícula suspensa com sucesso!" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Matrículas e Mensalidades</h1>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Matrícula
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Paciente</Label>
              <Input
                placeholder="Filtrar por nome..."
                value={filterPaciente}
                onChange={(e) => setFilterPaciente(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filterStatus || "todos"} onValueChange={(v) => setFilterStatus(v === "todos" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Matrículas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Matrículas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriculas.map((mat: any) => (
                  <TableRow key={mat.id}>
                    <TableCell className="font-medium">{mat.pacientes?.nome || "N/A"}</TableCell>
                    <TableCell>{mat.profiles?.nome || "N/A"}</TableCell>
                    <TableCell>{mat.tipo_atendimento}</TableCell>
                    <TableCell>R$ {parseFloat(mat.valor || 0).toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(mat.data_inicio), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>{format(new Date(mat.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[mat.status]?.variant || "outline"}>
                        {statusConfig[mat.status]?.label || mat.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {isAdmin && mat.status === "ativo" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => suspenderMatricula.mutate(mat.id)}
                          className="gap-1"
                        >
                          <Pause className="h-3 w-3" />
                          Suspender
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Nova Matrícula */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nova Matrícula</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-4 space-y-4">
            <div>
              <Label>Paciente *</Label>
              <Select
                value={formData.paciente_id}
                onValueChange={(value) => setFormData({ ...formData, paciente_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um paciente" />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Profissional</Label>
              <Select
                value={formData.profissional_id}
                onValueChange={(value) => setFormData({ ...formData, profissional_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seu perfil" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Atendimento *</Label>
                <Select
                  value={formData.tipo_atendimento}
                  onValueChange={(value) => setFormData({ ...formData, tipo_atendimento: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilates">Pilates</SelectItem>
                    <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                    <SelectItem value="yoga">Yoga</SelectItem>
                    <SelectItem value="personal">Personal Trainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Total de Sessões</Label>
                <Input
                  type="number"
                  value={formData.total_sessoes}
                  onChange={(e) => setFormData({ ...formData, total_sessoes: parseInt(e.target.value) || 4 })}
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Desconto</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.desconto}
                    onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                    placeholder="0"
                  />
                  <Select
                    value={formData.desconto_tipo}
                    onValueChange={(value) => setFormData({ ...formData, desconto_tipo: value })}
                  >
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>

              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Notas adicionais sobre a matrícula..."
                rows={3}
              />
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMatricula.mutate()}
              disabled={!formData.paciente_id || !formData.valor || createMatricula.isPending}
            >
              {createMatricula.isPending ? "Criando..." : "Criar Matrícula"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Matriculas;
