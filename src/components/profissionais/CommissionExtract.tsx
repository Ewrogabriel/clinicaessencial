import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, Calculator, Lock, CheckCircle2, AlertTriangle, Gift } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { getClinicSettings, addLogoToPDF, formatClinicAddress } from "@/lib/pdfLogo";

interface ProfSummary {
  nome: string;
  userId: string;
  totalAtendimentos: number;
  realizados: number;
  totalValor: number;
  comissao: number;
  regras: any[];
  modalidades: Record<string, number>;
  atendimentosDetail: any[];
}

export function CommissionExtract() {
  const { user, isAdmin, isGestor, isProfissional } = useAuth();
  const canManage = isAdmin || isGestor;
  const queryClient = useQueryClient();

  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));
  const [filterProf, setFilterProf] = useState("todos");
  const [filterModalidade, setFilterModalidade] = useState("todos");
  const [closingProf, setClosingProf] = useState<ProfSummary | null>(null);
  const [closingNotes, setClosingNotes] = useState("");
  const [compensacaoValor, setCompensacaoValor] = useState("");
  const [compensacaoDesc, setCompensacaoDesc] = useState("");
  const [bonusValor, setBonusValor] = useState("");
  const [bonusDesc, setBonusDesc] = useState("");

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
      // Get professionals from roles table
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const roleIds = roles?.map(r => r.user_id) ?? [];

      // Also get all distinct profissional_ids from agendamentos (covers admins who also attend)
      const { data: agendProfs } = await supabase.from("agendamentos").select("profissional_id");
      const agendIds = [...new Set((agendProfs || []).map((a: any) => a.profissional_id))];

      const allIds = [...new Set([...roleIds, ...agendIds])];
      if (!allIds.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", allIds).order("nome");
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-comissoes-extract", mesRef],
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

  const { data: planosData = [] } = useQuery({
    queryKey: ["planos-comissoes-extract", mesRef],
    queryFn: async () => {
      const { data } = await (supabase.from("planos") as any).select("id, valor, total_sessoes");
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ["fechamentos-comissao", mesRef],
    queryFn: async () => {
      const mesDate = `${mesRef}-01`;
      const { data } = await (supabase.from("fechamentos_comissao" as any) as any)
        .select("*")
        .eq("mes_referencia", mesDate);
      return data ?? [];
    },
    enabled: canManage,
  });

  // Previous month fechamentos for auto-compensation
  const prevMonth = (() => {
    const [y, m] = mesRef.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return format(d, "yyyy-MM");
  })();

  const { data: fechamentosPrev = [] } = useQuery({
    queryKey: ["fechamentos-comissao-prev", prevMonth],
    queryFn: async () => {
      const mesDate = `${prevMonth}-01`;
      const { data } = await (supabase.from("fechamentos_comissao" as any) as any)
        .select("*")
        .eq("mes_referencia", mesDate);
      return data ?? [];
    },
    enabled: canManage,
  });

  // Previous month agendamentos to calculate auto-compensation
  const { data: agendamentosPrev = [] } = useQuery({
    queryKey: ["agendamentos-comissoes-prev", prevMonth],
    queryFn: async () => {
      const startDate = `${prevMonth}-01T00:00:00`;
      const endMonth = new Date(parseInt(prevMonth.split("-")[0]), parseInt(prevMonth.split("-")[1]), 0);
      const endDate = `${prevMonth}-${endMonth.getDate()}T23:59:59`;
      const { data } = await (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome)")
        .in("status", ["agendado", "confirmado", "pendente", "realizado", "cancelado", "falta"])
        .gte("data_horario", startDate)
        .lte("data_horario", endDate);
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ["my-fechamentos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("fechamentos_comissao" as any) as any)
        .select("*").eq("profissional_id", user.id).order("mes_referencia", { ascending: false });
      return data ?? [];
    },
    enabled: isProfissional && !canManage,
  });

  const isClosed = (profId: string) => fechamentos.some((f: any) => f.profissional_id === profId);

  // Calculate commission for a set of appointments for a professional
  const calcCommissionForAppointments = (profId: string, atendimentos: any[]) => {
    const prof = profissionais.find((p: any) => p.user_id === profId);
    if (!prof) return 0;
    const profRegras = regrasComissao.filter((r: any) => r.profissional_id === profId && r.ativo);
    let comissaoTotal = 0;
    let totalValor = 0;

    for (const a of atendimentos) {
      let valorSessao = Number(a.valor_sessao || 0);
      if (valorSessao === 0 && a.observacoes?.startsWith("plano:")) {
        const planoId = a.observacoes.replace("plano:", "").trim();
        const plano = planosData.find((pl: any) => pl.id === planoId);
        if (plano && plano.total_sessoes > 0) {
          valorSessao = Number(plano.valor) / plano.total_sessoes;
        }
      }
      totalValor += valorSessao;

      if (profRegras.length > 0) {
        const tipoRegra = profRegras.find((r: any) => r.tipo_atendimento === a.tipo_atendimento)
          || profRegras.find((r: any) => r.tipo_atendimento === "geral");
        if (tipoRegra) {
          comissaoTotal += (valorSessao * Number(tipoRegra.percentual || 0) / 100) + Number(tipoRegra.valor_fixo || 0);
        }
      }
    }

    if (profRegras.length === 0 && prof) {
      const rate = Number(prof.commission_rate || 0);
      const fixed = Number(prof.commission_fixed || 0);
      comissaoTotal = (totalValor * rate / 100) + (fixed * atendimentos.length);
    }

    return comissaoTotal;
  };

  // Auto-calculate compensation: difference between what was closed and current state of prev month
  const calcAutoCompensation = (profId: string): { valor: number; descricao: string } => {
    const prevFechamento = fechamentosPrev.find((f: any) => f.profissional_id === profId);
    if (!prevFechamento) return { valor: 0, descricao: "" };

    // Recalculate prev month commission with current agenda state (cancellations/changes after closing)
    const prevAtendimentos = agendamentosPrev.filter((a: any) =>
      a.profissional_id === profId && ["agendado", "confirmado", "pendente", "realizado"].includes(a.status)
    );
    const currentComissao = calcCommissionForAppointments(profId, prevAtendimentos);
    const closedComissao = Number(prevFechamento.total_comissao);
    const diff = currentComissao - closedComissao;

    if (Math.abs(diff) < 0.01) return { valor: 0, descricao: "" };

    return {
      valor: diff,
      descricao: `Compensação automática: alterações na agenda de ${format(new Date(`${prevMonth}-01`), "MMMM/yyyy", { locale: ptBR })} após fechamento`,
    };
  };

  // Calculate summary
  const calcSummary = (): ProfSummary[] => {
    const summaryMap: Record<string, ProfSummary> = {};
    const profsToCalc = filterProf === "todos" ? profissionais : profissionais.filter((p: any) => p.user_id === filterProf);

    profsToCalc.forEach((p: any) => {
      const profRegras = regrasComissao.filter((r: any) => r.profissional_id === p.user_id && r.ativo);
      let atendimentos = agendamentos.filter((a: any) => a.profissional_id === p.user_id);

      if (filterModalidade !== "todos") {
        atendimentos = atendimentos.filter((a: any) => a.tipo_atendimento === filterModalidade);
      }

      let comissaoTotal = 0;
      let totalValor = 0;
      const modalidadesMap: Record<string, number> = {};

      for (const a of atendimentos) {
        const tipo = a.tipo_atendimento || "outro";
        modalidadesMap[tipo] = (modalidadesMap[tipo] || 0) + 1;

        let valorSessao = Number(a.valor_sessao || 0);
        if (valorSessao === 0 && a.observacoes?.startsWith("plano:")) {
          const planoId = a.observacoes.replace("plano:", "").trim();
          const plano = planosData.find((pl: any) => pl.id === planoId);
          if (plano && plano.total_sessoes > 0) {
            valorSessao = Number(plano.valor) / plano.total_sessoes;
          }
        }
        totalValor += valorSessao;

        if (profRegras.length > 0) {
          const tipoRegra = profRegras.find((r: any) => r.tipo_atendimento === a.tipo_atendimento)
            || profRegras.find((r: any) => r.tipo_atendimento === "geral");
          if (tipoRegra) {
            comissaoTotal += (valorSessao * Number(tipoRegra.percentual || 0) / 100) + Number(tipoRegra.valor_fixo || 0);
          }
        }
      }

      if (profRegras.length === 0) {
        const rate = Number(p.commission_rate || 0);
        const fixed = Number(p.commission_fixed || 0);
        comissaoTotal = (totalValor * rate / 100) + (fixed * atendimentos.length);
      }

      if (atendimentos.length > 0) {
        summaryMap[p.user_id] = {
          nome: p.nome,
          userId: p.user_id,
          totalAtendimentos: atendimentos.length,
          realizados: atendimentos.filter((a: any) => a.status === "realizado").length,
          totalValor,
          comissao: comissaoTotal,
          regras: profRegras,
          modalidades: modalidadesMap,
          atendimentosDetail: atendimentos,
        };
      }
    });
    return Object.values(summaryMap);
  };

  const summary = calcSummary();
  const totalComissoes = summary.reduce((s, item) => s + item.comissao, 0);

  // Close commission mutation
  const closeMutation = useMutation({
    mutationFn: async (prof: ProfSummary) => {
      if (!user) throw new Error("Não autenticado");
      const mesDate = `${mesRef}-01`;
      const comp = parseFloat(compensacaoValor) || 0;
      const bonus = parseFloat(bonusValor) || 0;
      const valorFinal = prof.comissao + comp + bonus;

      const { error } = await (supabase.from("fechamentos_comissao" as any) as any).insert({
        profissional_id: prof.userId,
        mes_referencia: mesDate,
        total_atendimentos: prof.totalAtendimentos,
        total_valor: prof.totalValor,
        total_comissao: prof.comissao,
        compensacao_anterior: comp,
        descricao_compensacao: compensacaoDesc || null,
        bonus_valor: bonus,
        bonus_descricao: bonusDesc || null,
        valor_final: valorFinal,
        status: "fechado",
        fechado_por: user.id,
      });
      if (error) throw error;

      // Send notification
      const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });
      const titulo = `Comissão Fechada — ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`;
      let resumo = `Sua comissão de ${mesLabel} foi fechada. Valor: R$ ${valorFinal.toFixed(2)}.`;
      if (comp !== 0) resumo += ` Compensação: R$ ${comp.toFixed(2)}.`;
      if (bonus !== 0) resumo += ` Bônus: R$ ${bonus.toFixed(2)} (${bonusDesc || "bônus"}).`;

      let conteudo = `Atendimentos: ${prof.totalAtendimentos}\nValor Total: R$ ${prof.totalValor.toFixed(2)}\nComissão Base: R$ ${prof.comissao.toFixed(2)}`;
      if (comp !== 0) conteudo += `\nCompensação: R$ ${comp.toFixed(2)} (${compensacaoDesc || "ajuste agenda"})`;
      if (bonus !== 0) conteudo += `\nBônus: R$ ${bonus.toFixed(2)} (${bonusDesc || "bônus"})`;
      conteudo += `\nValor Final: R$ ${valorFinal.toFixed(2)}`;

      await supabase.from("notificacoes").insert({
        user_id: prof.userId,
        titulo,
        resumo,
        conteudo,
        tipo: "comissao",
        link: "/comissoes",
      });

      return { prof, valorFinal, comp, bonus };
    },
    onSuccess: async ({ prof, valorFinal, comp, bonus }) => {
      queryClient.invalidateQueries({ queryKey: ["fechamentos-comissao"] });
      toast({ title: "Comissão fechada!", description: `${prof.nome} — R$ ${valorFinal.toFixed(2)}` });
      await generateClosingReceipt(prof, valorFinal, comp, bonus);
      setClosingProf(null);
      setClosingNotes("");
      setCompensacaoValor("");
      setCompensacaoDesc("");
      setBonusValor("");
      setBonusDesc("");
    },
    onError: (e: any) => toast({ title: "Erro ao fechar comissão", description: e.message, variant: "destructive" }),
  });

  const generateClosingReceipt = async (prof: ProfSummary, valorFinal: number, comp: number, bonus: number) => {
    const doc = new jsPDF();
    const settings = await getClinicSettings();
    const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });

    let y = 15;
    y = await addLogoToPDF(doc, 85, y, 40, 25);
    y += 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE COMISSÃO", 105, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(settings.nome, 105, y, { align: "center" });
    y += 4;
    if (settings.cnpj) { doc.text(`CNPJ: ${settings.cnpj}`, 105, y, { align: "center" }); y += 4; }
    const addr = formatClinicAddress(settings);
    if (addr) { doc.text(addr, 105, y, { align: "center" }); y += 4; }

    y += 4;
    doc.setDrawColor(180);
    doc.line(20, y, 190, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Profissional: ${prof.nome}`, 20, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Referência: ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 20, y); y += 7;
    doc.text(`Total de Atendimentos: ${prof.totalAtendimentos} (${prof.realizados} realizados)`, 20, y); y += 7;
    doc.text(`Valor Total dos Atendimentos: R$ ${prof.totalValor.toFixed(2)}`, 20, y); y += 7;
    doc.text(`Comissão Base: R$ ${prof.comissao.toFixed(2)}`, 20, y); y += 7;

    if (comp !== 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(comp > 0 ? 0 : 200, comp > 0 ? 100 : 0, 0);
      doc.text(`Compensação: R$ ${comp.toFixed(2)}`, 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      if (compensacaoDesc) {
        doc.setFontSize(9);
        doc.text(`Motivo: ${compensacaoDesc}`, 20, y);
        y += 5;
      }
      doc.setTextColor(0);
      doc.setFontSize(11);
      y += 3;
    }

    if (bonus !== 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 0);
      doc.text(`Bônus: R$ ${bonus.toFixed(2)}`, 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      if (bonusDesc) {
        doc.setFontSize(9);
        doc.text(`Descrição: ${bonusDesc}`, 20, y);
        y += 5;
      }
      doc.setTextColor(0);
      doc.setFontSize(11);
      y += 3;
    }

    doc.line(20, y, 190, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`VALOR FINAL: R$ ${valorFinal.toFixed(2)}`, 20, y);
    y += 12;

    // Detailed sessions table
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DETALHADO", 20, y);
    y += 6;

    doc.setFontSize(8);
    doc.text("Data", 20, y);
    doc.text("Paciente", 50, y);
    doc.text("Tipo", 120, y);
    doc.text("Status", 150, y);
    doc.text("Valor", 175, y);
    y += 2;
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const a of prof.atendimentosDetail.sort((x: any, y: any) => x.data_horario.localeCompare(y.data_horario))) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(format(new Date(a.data_horario), "dd/MM HH:mm"), 20, y);
      doc.text((a.pacientes?.nome || "—").substring(0, 30), 50, y);
      doc.text((a.tipo_atendimento || "—").substring(0, 15), 120, y);
      doc.text(a.status, 150, y);
      doc.text(`R$ ${Number(a.valor_sessao || 0).toFixed(2)}`, 175, y);
      y += 5;
    }

    y += 5;
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFontSize(9);
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 20, y);
    y += 20;

    doc.line(20, y, 90, y);
    doc.text("Profissional", 55, y + 5, { align: "center" });
    doc.line(110, y, 190, y);
    doc.text("Clínica", 150, y + 5, { align: "center" });

    doc.save(`Comissao_${prof.nome.replace(/\s+/g, "_")}_${mesRef}.pdf`);
    toast({ title: "Recibo PDF gerado!" });
  };

  const generateGlobalPDF = async () => {
    const doc = new jsPDF();
    const settings = await getClinicSettings();
    const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });

    let y = 15;
    y = await addLogoToPDF(doc, 85, y, 40, 25);
    y += 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE COMISSÕES", 105, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${settings.nome} — ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 105, y, { align: "center" });
    y += 10;

    doc.setDrawColor(180);
    doc.line(20, y, 190, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Profissional", 20, y);
    doc.text("Atend.", 100, y);
    doc.text("Valor Total", 120, y);
    doc.text("Comissão", 155, y);
    doc.text("Status", 180, y);
    y += 3;
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const s of summary) {
      const closed = isClosed(s.userId);
      doc.text(s.nome, 20, y);
      doc.text(String(s.totalAtendimentos), 100, y);
      doc.text(`R$ ${s.totalValor.toFixed(2)}`, 120, y);
      doc.text(`R$ ${s.comissao.toFixed(2)}`, 155, y);
      doc.text(closed ? "Fechado" : "Aberto", 180, y);
      y += 6;
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

  const openClosing = (prof: ProfSummary) => {
    // Auto-calculate compensation from agenda changes after previous closing
    const autoComp = calcAutoCompensation(prof.userId);
    setClosingProf(prof);
    setClosingNotes("");
    setCompensacaoValor(autoComp.valor !== 0 ? autoComp.valor.toFixed(2) : "");
    setCompensacaoDesc(autoComp.descricao);
    setBonusValor("");
    setBonusDesc("");
  };

  // Professional-only view
  if (isProfissional && !canManage) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Meus Fechamentos de Comissão
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {minhasComissoes.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">Nenhum fechamento de comissão registrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Atendimentos</TableHead>
                    <TableHead>Comissão Base</TableHead>
                    <TableHead>Compensação</TableHead>
                    <TableHead>Bônus</TableHead>
                    <TableHead>Valor Final</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {minhasComissoes.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {format(new Date(c.mes_referencia), "MMMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{c.total_atendimentos}</TableCell>
                      <TableCell>R$ {Number(c.total_comissao).toFixed(2)}</TableCell>
                      <TableCell>
                        {Number(c.compensacao_anterior) !== 0 ? (
                          <span className={Number(c.compensacao_anterior) > 0 ? "text-green-600" : "text-destructive"}>
                            R$ {Number(c.compensacao_anterior).toFixed(2)}
                            {c.descricao_compensacao && (
                              <span className="text-xs text-muted-foreground ml-1">({c.descricao_compensacao})</span>
                            )}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {Number(c.bonus_valor) !== 0 ? (
                          <span className="text-green-600">
                            R$ {Number(c.bonus_valor).toFixed(2)}
                            {c.bonus_descricao && (
                              <span className="text-xs text-muted-foreground ml-1">({c.bonus_descricao})</span>
                            )}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-primary">R$ {Number(c.valor_final).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Fechado
                        </Badge>
                      </TableCell>
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
            <Button variant="outline" onClick={generateGlobalPDF} className="gap-2">
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s) => {
                    const closed = isClosed(s.userId);
                    const fechamento = fechamentos.find((f: any) => f.profissional_id === s.userId);
                    return (
                      <TableRow key={s.userId}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell className="text-center">
                          {s.totalAtendimentos}
                          {s.realizados < s.totalAtendimentos && (
                            <span className="text-xs text-muted-foreground ml-1">({s.realizados} realizados)</span>
                          )}
                        </TableCell>
                        <TableCell>R$ {s.totalValor.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-primary">
                          R$ {closed ? Number(fechamento?.valor_final || s.comissao).toFixed(2) : s.comissao.toFixed(2)}
                          {closed && Number(fechamento?.compensacao_anterior) !== 0 && (
                            <span className="text-xs text-muted-foreground block">
                              (comp. R$ {Number(fechamento.compensacao_anterior).toFixed(2)})
                            </span>
                          )}
                          {closed && Number(fechamento?.bonus_valor) !== 0 && (
                            <span className="text-xs text-green-600 block">
                              (bônus R$ {Number(fechamento.bonus_valor).toFixed(2)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.regras.length > 0 ? "default" : "secondary"}>
                            {s.regras.length > 0 ? "Regra" : "Perfil"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {closed ? (
                            <Badge variant="default" className="gap-1">
                              <Lock className="h-3 w-3" /> Fechado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> Aberto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!closed && (
                              <Button size="sm" variant="default" onClick={() => openClosing(s)} className="gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Fechar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => generateClosingReceipt(s, closed ? Number(fechamento?.valor_final || s.comissao) : s.comissao, closed ? Number(fechamento?.compensacao_anterior || 0) : 0, closed ? Number(fechamento?.bonus_valor || 0) : 0)} className="gap-1">
                              <Download className="h-3.5 w-3.5" /> PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Closing Dialog */}
      <Dialog open={!!closingProf} onOpenChange={(o) => !o && setClosingProf(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Fechar Comissão — {closingProf?.nome}
            </DialogTitle>
            <DialogDescription>
              Ao fechar, o profissional será notificado com o extrato e recibo.
            </DialogDescription>
          </DialogHeader>
          {closingProf && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Mês</p>
                  <p className="font-medium">{format(new Date(`${mesRef}-01`), "MMMM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atendimentos</p>
                  <p className="font-medium">{closingProf.totalAtendimentos} ({closingProf.realizados} realizados)</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-medium">R$ {closingProf.totalValor.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comissão Base</p>
                  <p className="font-bold text-primary">R$ {closingProf.comissao.toFixed(2)}</p>
                </div>
              </div>

              {/* Auto-compensation */}
              <div className="space-y-3 border rounded-lg p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Compensação (automática)
                </p>
                <p className="text-xs text-muted-foreground">
                  Calculada automaticamente com base em alterações na agenda do mês anterior após o fechamento. Pode ser ajustada manualmente.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={compensacaoValor}
                      onChange={(e) => setCompensacaoValor(e.target.value)}
                      placeholder="Ex: 50.00 ou -30.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Motivo</Label>
                    <Input
                      value={compensacaoDesc}
                      onChange={(e) => setCompensacaoDesc(e.target.value)}
                      placeholder="Ex: Ajuste cancelamento"
                    />
                  </div>
                </div>
              </div>

              {/* Bonus */}
              <div className="space-y-3 border rounded-lg p-3 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-600" />
                  Bônus
                </p>
                <p className="text-xs text-muted-foreground">
                  Valor adicional como bonificação para o profissional.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bonusValor}
                      onChange={(e) => setBonusValor(e.target.value)}
                      placeholder="Ex: 100.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={bonusDesc}
                      onChange={(e) => setBonusDesc(e.target.value)}
                      placeholder="Ex: Meta atingida"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">Valor Final</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {(closingProf.comissao + (parseFloat(compensacaoValor) || 0) + (parseFloat(bonusValor) || 0)).toFixed(2)}
                </p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <p>Comissão base: R$ {closingProf.comissao.toFixed(2)}</p>
                  {(parseFloat(compensacaoValor) || 0) !== 0 && (
                    <p>Compensação: R$ {(parseFloat(compensacaoValor) || 0).toFixed(2)}</p>
                  )}
                  {(parseFloat(bonusValor) || 0) !== 0 && (
                    <p>Bônus: R$ {(parseFloat(bonusValor) || 0).toFixed(2)}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setClosingProf(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => closeMutation.mutate(closingProf)}
                  disabled={closeMutation.isPending}
                >
                  <Lock className="h-4 w-4" />
                  {closeMutation.isPending ? "Fechando..." : "Confirmar Fechamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
