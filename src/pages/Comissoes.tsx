import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Calculator, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const Comissoes = () => {
  const { user, isAdmin, isGestor, isProfissional } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProf, setSelectedProf] = useState("");
  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"modalidade" | "profissional">("modalidade");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [ruleForm, setRuleForm] = useState({ percentual: "", valorFixo: "", observacoes: "" });

  // Fetch professionals
  const { data: profissionais = [] } = useQuery({
    queryKey: ["prof-for-comissoes"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids).order("nome");
      return data ?? [];
    },
    enabled: isAdmin || isGestor,
  });

  // Fetch appointments for commission calc
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-comissoes", mesRef],
    queryFn: async () => {
      const startDate = `${mesRef}-01T00:00:00`;
      const endMonth = new Date(parseInt(mesRef.split("-")[0]), parseInt(mesRef.split("-")[1]), 0);
      const endDate = `${mesRef}-${endMonth.getDate()}T23:59:59`;
      const { data } = await (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome)")
        .eq("status", "realizado")
        .gte("data_horario", startDate)
        .lte("data_horario", endDate);
      return data ?? [];
    },
    enabled: isAdmin || isGestor,
  });

  // Existing commissions
  const { data: comissoes = [] } = useQuery({
    queryKey: ["commissions-list"],
    queryFn: async () => {
      const { data } = await (supabase.from("commissions") as any).select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch modalidades
  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-comissoes"],
    queryFn: async () => {
      const { data } = await (supabase.from("modalidades") as any).select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // Fetch commission rules
  const { data: regrasComissao = [] } = useQuery({
    queryKey: ["regras-comissao"],
    queryFn: async () => {
      const { data } = await (supabase.from("regras_comissao") as any).select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin || isGestor,
  });

  // My commissions (for professional view)
  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ["my-commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("commissions") as any)
        .select("*")
        .eq("professional_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isProfissional,
  });

  // Save commission rule
  const saveRule = useMutation({
    mutationFn: async () => {
      if (!selectedEntity || !ruleForm.percentual && !ruleForm.valorFixo) {
        throw new Error("Preencha os campos obrigatórios");
      }

      const { error } = await (supabase.from("regras_comissao").insert([{
        tipo: selectedType,
        entidade_id: selectedEntity,
        percentual: ruleForm.percentual ? parseFloat(ruleForm.percentual) : null,
        valor_fixo: ruleForm.valorFixo ? parseFloat(ruleForm.valorFixo) : null,
        observacoes: ruleForm.observacoes || null
      }]) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Regra de comissão salva com sucesso!" });
      setRuleDialogOpen(false);
      setRuleForm({ percentual: "", valorFixo: "", observacoes: "" });
      queryClient.invalidateQueries({ queryKey: ["regras-comissao"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar regra", description: err.message, variant: "destructive" });
    }
  });

  // Calculate summary per professional
  const calcSummary = () => {
    const summary: Record<string, { nome: string; userId: string; totalAtendimentos: number; totalValor: number; rate: number; fixed: number; comissao: number }> = {};
    profissionais.forEach((p: any) => {
      const atendimentos = agendamentos.filter((a: any) => a.profissional_id === p.user_id);
      const totalValor = atendimentos.reduce((s: number, a: any) => s + Number(a.valor_sessao || 0), 0);
      const rate = Number(p.commission_rate || 0);
      const fixed = Number(p.commission_fixed || 0);
      const comissao = (totalValor * rate / 100) + (fixed * atendimentos.length);
      summary[p.user_id] = {
        nome: p.nome, userId: p.user_id,
        totalAtendimentos: atendimentos.length,
        totalValor, rate, fixed, comissao,
      };
    });
    return Object.values(summary).filter(s => s.totalAtendimentos > 0);
  };

  const summary = calcSummary();

  const generateCommissionReceipt = (prof: typeof summary[0]) => {
    const doc = new jsPDF();
    const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE COMISSÃO", 105, 25, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Essencial Fisio Pilates", 105, 35, { align: "center" });
    doc.text("CNPJ: 61.080.977/0001-50", 105, 40, { align: "center" });
    
    doc.setDrawColor(200);
    doc.line(20, 48, 190, 48);
    
    let y = 58;
    doc.setFontSize(11);
    doc.text(`Profissional: ${prof.nome}`, 20, y); y += 8;
    doc.text(`Referência: ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 20, y); y += 8;
    doc.text(`Total de Atendimentos Realizados: ${prof.totalAtendimentos}`, 20, y); y += 8;
    doc.text(`Valor Total dos Atendimentos: R$ ${prof.totalValor.toFixed(2)}`, 20, y); y += 8;
    
    doc.line(20, y, 190, y); y += 8;
    
    doc.text(`Percentual de Comissão: ${prof.rate}%`, 20, y); y += 7;
    doc.text(`Valor Fixo por Atendimento: R$ ${prof.fixed.toFixed(2)}`, 20, y); y += 7;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    y += 5;
    doc.text(`VALOR DA COMISSÃO: R$ ${prof.comissao.toFixed(2)}`, 20, y); y += 15;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Data de emissão: ${format(new Date(), "dd/MM/yyyy")}`, 20, y); y += 20;
    
    doc.line(20, y, 90, y);
    doc.text("Assinatura do Profissional", 55, y + 6, { align: "center" });
    doc.line(110, y, 190, y);
    doc.text("Assinatura da Clínica", 150, y + 6, { align: "center" });
    
    doc.save(`Comissao_${prof.nome.replace(/\s+/g, "_")}_${mesRef}.pdf`);
    toast({ title: "Recibo de comissão gerado!" });
  };

  // Professional-only view
  if (isProfissional && !isAdmin && !isGestor) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Minhas Comissões</h1>
        <Card>
          <CardContent className="p-0">
            {minhasComissoes.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">Nenhuma comissão registrada.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {minhasComissoes.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>R$ {Number(c.valor).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={c.status === "pago" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Comissões</h1>
          <p className="text-muted-foreground">Calcule, gere recibos e configure regras de comissão</p>
        </div>
        <div className="flex gap-3 items-center">
          <Label className="text-sm">Mês:</Label>
          <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-auto" />
        </div>
      </div>

      {/* Regras de Comissão */}
      {(isAdmin || isGestor) && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Configurar Regras de Comissão
              </CardTitle>
              <Button onClick={() => setRuleDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Nova Regra
              </Button>
            </div>
            <CardDescription>Estabeleça regras de comissão por modalidade ou profissional</CardDescription>
          </CardHeader>
          <CardContent>
            {regrasComissao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma regra configurada. Crie uma para começar.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {regrasComissao.map((regra: any) => (
                  <div key={regra.id} className="p-4 rounded-lg border bg-white">
                    <p className="font-semibold text-sm mb-2 capitalize">{regra.tipo}</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {regra.percentual && <p>Percentual: <span className="font-medium text-foreground">{regra.percentual}%</span></p>}
                      {regra.valor_fixo && <p>Valor Fixo: <span className="font-medium text-foreground">R$ {Number(regra.valor_fixo).toFixed(2)}</span></p>}
                      {regra.observacoes && <p className="text-xs italic mt-2">{regra.observacoes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog para nova regra */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Regra de Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={selectedType} onValueChange={(val: any) => setSelectedType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modalidade">Por Modalidade</SelectItem>
                  <SelectItem value="profissional">Por Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{selectedType === "modalidade" ? "Modalidade" : "Profissional"}</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione uma ${selectedType}`} />
                </SelectTrigger>
                <SelectContent>
                  {selectedType === "modalidade" ? (
                    modalidades.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))
                  ) : (
                    profissionais.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Percentual de Comissão (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={ruleForm.percentual}
                onChange={(e) => setRuleForm({ ...ruleForm, percentual: e.target.value })}
                placeholder="Ex: 10.5"
              />
            </div>

            <div>
              <Label>Valor Fixo por Atendimento (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={ruleForm.valorFixo}
                onChange={(e) => setRuleForm({ ...ruleForm, valorFixo: e.target.value })}
                placeholder="Ex: 25.00"
              />
            </div>

            <div>
              <Label>Observações (opcional)</Label>
              <Input
                value={ruleForm.observacoes}
                onChange={(e) => setRuleForm({ ...ruleForm, observacoes: e.target.value })}
                placeholder="Notas sobre esta regra"
              />
            </div>

            <Button onClick={() => saveRule.mutate()} disabled={saveRule.isPending} className="w-full">
              {saveRule.isPending ? "Salvando..." : "Salvar Regra"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo de Comissões — {format(new Date(`${mesRef}-01`), "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {summary.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum atendimento realizado neste mês.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-center">Atendimentos</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead>Fixo/Atend.</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.userId}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-center">{s.totalAtendimentos}</TableCell>
                    <TableCell>R$ {s.totalValor.toFixed(2)}</TableCell>
                    <TableCell>{s.rate}%</TableCell>
                    <TableCell>R$ {s.fixed.toFixed(2)}</TableCell>
                    <TableCell className="font-bold">R$ {s.comissao.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => generateCommissionReceipt(s)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Recibo
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        * As taxas de comissão são configuradas na página de Profissionais (editar profissional → comissão % e valor fixo).
      </p>
    </div>
  );
};

export default Comissoes;
