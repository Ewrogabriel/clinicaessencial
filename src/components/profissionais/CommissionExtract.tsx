import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

export function CommissionExtract() {
  const { user, isAdmin, isGestor, isProfissional } = useAuth();
  const canManage = isAdmin || isGestor;

  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));
  const [filterProf, setFilterProf] = useState("todos");
  const [filterModalidade, setFilterModalidade] = useState("todos");

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-comissoes"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["prof-for-comissoes"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids).order("nome");
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-comissoes", mesRef],
    queryFn: async () => {
      const startDate = `${mesRef}-01T00:00:00`;
      const endMonth = new Date(parseInt(mesRef.split("-")[0]), parseInt(mesRef.split("-")[1]), 0);
      const endDate = `${mesRef}-${endMonth.getDate()}T23:59:59`;
      const { data } = await (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome)")
        .in("status", ["agendado", "confirmado", "pendente", "realizado"])
        .gte("data_horario", startDate)
        .lte("data_horario", endDate);
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: regrasComissao = [] } = useQuery({
    queryKey: ["regras-comissao"],
    queryFn: async () => {
      const { data } = await (supabase.from("regras_comissao" as any) as any)
        .select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ["my-commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("commissions") as any)
        .select("*").eq("professional_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isProfissional && !canManage,
  });

  // Calculate summary
  const calcSummary = () => {
    const summary: Record<string, { nome: string; userId: string; totalAtendimentos: number; realizados: number; totalValor: number; comissao: number; regras: any[]; modalidades: Record<string, number> }> = {};
    
    const profsToCalc = filterProf === "todos" ? profissionais : profissionais.filter((p: any) => p.user_id === filterProf);
    
    profsToCalc.forEach((p: any) => {
      const profRegras = regrasComissao.filter((r: any) => r.profissional_id === p.user_id && r.ativo);
      let atendimentos = agendamentos.filter((a: any) => a.profissional_id === p.user_id);
      
      if (filterModalidade !== "todos") {
        atendimentos = atendimentos.filter((a: any) => a.tipo_atendimento === filterModalidade);
      }

      let comissaoTotal = 0;
      const totalValor = atendimentos.reduce((s: number, a: any) => s + Number(a.valor_sessao || 0), 0);
      const modalidadesMap: Record<string, number> = {};

      for (const a of atendimentos) {
        const tipo = a.tipo_atendimento || "outro";
        modalidadesMap[tipo] = (modalidadesMap[tipo] || 0) + 1;
      }

      if (profRegras.length > 0) {
        for (const a of atendimentos) {
          const tipoRegra = profRegras.find((r: any) => r.tipo_atendimento === a.tipo_atendimento)
            || profRegras.find((r: any) => r.tipo_atendimento === "geral");
          if (tipoRegra) {
            comissaoTotal += (Number(a.valor_sessao || 0) * Number(tipoRegra.percentual || 0) / 100) + Number(tipoRegra.valor_fixo || 0);
          }
        }
      } else {
        const rate = Number(p.commission_rate || 0);
        const fixed = Number(p.commission_fixed || 0);
        comissaoTotal = (totalValor * rate / 100) + (fixed * atendimentos.length);
      }

      if (atendimentos.length > 0) {
        summary[p.user_id] = {
          nome: p.nome,
          userId: p.user_id,
          totalAtendimentos: atendimentos.length,
          realizados: atendimentos.filter((a: any) => a.status === "realizado").length,
          totalValor,
          comissao: comissaoTotal,
          regras: profRegras,
          modalidades: modalidadesMap,
        };
      }
    });
    return Object.values(summary);
  };

  const summary = calcSummary();
  const totalComissoes = summary.reduce((s, item) => s + item.comissao, 0);

  const generatePDF = () => {
    const doc = new jsPDF();
    const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE COMISSÕES", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Referência: ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 105, 28, { align: "center" });
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 105, 34, { align: "center" });
    
    doc.setDrawColor(200);
    doc.line(20, 40, 190, 40);

    let y = 50;
    // Table header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Profissional", 20, y);
    doc.text("Atend.", 100, y);
    doc.text("Valor Total", 120, y);
    doc.text("Comissão", 155, y);
    y += 3;
    doc.line(20, y, 190, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    for (const s of summary) {
      doc.text(s.nome, 20, y);
      doc.text(String(s.totalAtendimentos), 100, y);
      doc.text(`R$ ${s.totalValor.toFixed(2)}`, 120, y);
      doc.text(`R$ ${s.comissao.toFixed(2)}`, 155, y);
      y += 7;
      if (y > 270) { doc.addPage(); y = 20; }
    }

    y += 3;
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`TOTAL COMISSÕES: R$ ${totalComissoes.toFixed(2)}`, 20, y);

    doc.save(`Extrato_Comissoes_${mesRef}.pdf`);
    toast({ title: "PDF gerado!" });
  };

  const generateReceipt = (prof: typeof summary[0]) => {
    const doc = new jsPDF();
    const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE COMISSÃO", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Essencial Fisio Pilates", 105, 35, { align: "center" });
    doc.setDrawColor(200);
    doc.line(20, 43, 190, 43);
    let y = 53;
    doc.setFontSize(11);
    doc.text(`Profissional: ${prof.nome}`, 20, y); y += 8;
    doc.text(`Referência: ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 20, y); y += 8;
    doc.text(`Total de Atendimentos: ${prof.totalAtendimentos}`, 20, y); y += 8;
    doc.text(`Valor Total Atendimentos: R$ ${prof.totalValor.toFixed(2)}`, 20, y); y += 8;
    doc.line(20, y, 190, y); y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`COMISSÃO: R$ ${prof.comissao.toFixed(2)}`, 20, y); y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy")}`, 20, y); y += 20;
    doc.line(20, y, 90, y);
    doc.text("Profissional", 55, y + 6, { align: "center" });
    doc.line(110, y, 190, y);
    doc.text("Clínica", 150, y + 6, { align: "center" });
    doc.save(`Comissao_${prof.nome.replace(/\s+/g, "_")}_${mesRef}.pdf`);
    toast({ title: "Recibo gerado!" });
  };

  // Professional-only view
  if (isProfissional && !canManage) {
    return (
      <div className="space-y-4">
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
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Mês de referência</Label>
              <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Profissional</Label>
              <Select value={filterProf} onValueChange={setFilterProf}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Modalidade</Label>
              <Select value={filterModalidade} onValueChange={setFilterModalidade}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {modalidades.map((m: any) => (
                    <SelectItem key={m.id} value={m.nome.toLowerCase()}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Extrato — {format(new Date(`${mesRef}-01`), "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <CardDescription>
              Comissões previstas para todas as sessões e consultas agendadas no mês.
            </CardDescription>
          </div>
          {summary.length > 0 && (
            <Button variant="outline" onClick={generatePDF} className="gap-2">
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {summary.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhuma sessão ou consulta agendada neste mês com os filtros selecionados.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-center">Atendimentos</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell className="font-medium">{s.nome}</TableCell>
                      <TableCell className="text-center">
                        {s.totalAtendimentos}
                        {s.realizados < s.totalAtendimentos && (
                          <span className="text-xs text-muted-foreground ml-1">({s.realizados} realizados)</span>
                        )}
                      </TableCell>
                      <TableCell>R$ {s.totalValor.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-primary">R$ {s.comissao.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={s.regras.length > 0 ? "default" : "secondary"}>
                          {s.regras.length > 0 ? "Regra" : "Perfil"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => generateReceipt(s)} className="gap-1">
                          <Download className="h-3.5 w-3.5" /> Recibo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center px-4 py-3 bg-muted/50 border-t">
                <span className="font-medium">Total Comissões</span>
                <span className="font-bold text-lg text-primary">R$ {totalComissoes.toFixed(2)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
