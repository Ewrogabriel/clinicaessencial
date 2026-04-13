import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, Calculator, Lock, CheckCircle2, AlertTriangle, Gift, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Clock, Edit, UserCircle, ArrowRightLeft, CreditCard, DollarSign } from "lucide-react";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import jsPDF from "jspdf";
import { getClinicSettings, addLogoToPDF, formatClinicAddress } from "@/lib/pdfLogo";
import { calculateSessionValue, calculateSessionCommission } from "@/lib/calculations";
import { toast } from "sonner";

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

/** Parse "YYYY-MM-01" as local date to avoid UTC timezone shift */
function parseMesRefDate(mesRef: string): Date {
  const [year, month] = mesRef.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function CommissionExtract() {
  const { user, isAdmin, isGestor, isProfissional } = useAuth();
  const { activeClinicId } = useClinic();
  const canManage = isAdmin || isGestor;
  const queryClient = useQueryClient();

  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));
  const [filterProf, setFilterProf] = useState("todos");
  const [filterModalidade, setFilterModalidade] = useState("todos");
  const [expandedProf, setExpandedProf] = useState<string | null>(null);
  const [closingProf, setClosingProf] = useState<ProfSummary | null>(null);
  const [closingNotes, setClosingNotes] = useState("");
  const [compensacaoValor, setCompensacaoValor] = useState("");
  const [compensacaoDesc, setCompensacaoDesc] = useState("");
  const [bonusValor, setBonusValor] = useState("");
  const [bonusDesc, setBonusDesc] = useState("");
  const [editingCommission, setEditingCommission] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    valor: "",
    professional_id: "",
    observacoes: ""
  });

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
    enabled: canManage || isProfissional,
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-comissoes-extract"],
    queryFn: async () => {
      const { data } = await supabase.from("matriculas").select("id, paciente_id, valor_mensal");
      return data ?? [];
    },
    enabled: canManage || isProfissional,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-comissoes-extract", mesRef],
    queryFn: async () => {
      const startDate = `${mesRef}-01T00:00:00`;
      const endMonth = new Date(parseInt(mesRef.split("-")[0]), parseInt(mesRef.split("-")[1]), 0);
      const endDate = `${mesRef}-${String(endMonth.getDate()).padStart(2, "0")}T23:59:59`;
      const { data } = await (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome)")
        .in("status", ["agendado", "confirmado", "pendente", "realizado", "falta", "cancelado"])
        .gte("data_horario", startDate)
        .lte("data_horario", endDate);
      return data ?? [];
    },
    enabled: canManage || isProfissional,
  });

  const { data: regrasComissao = [] } = useQuery({
    queryKey: ["regras-comissao"],
    queryFn: async () => {
      const { data } = await (supabase.from("regras_comissao" as any) as any)
        .select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: canManage || isProfissional,
  });

  const { data: planosData = [] } = useQuery({
    queryKey: ["planos-comissoes-extract", mesRef],
    queryFn: async () => {
      const { data } = await (supabase.from("planos") as any).select("id, valor, total_sessoes");
      return data ?? [];
    },
    enabled: canManage || isProfissional,
  });

  const { data: commissionsData = [] } = useQuery({
    queryKey: ["commissions-table-extract", mesRef],
    queryFn: async () => {
      const mesDate = `${mesRef}-01`;
      const { data } = await (supabase as any)
        .from("commissions")
        .select("*")
        .eq("mes_referencia", mesDate);
      return (data ?? []) as any[];
    },
    enabled: canManage || isProfissional,
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
    enabled: canManage || isProfissional,
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
    enabled: canManage || isProfissional,
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
    enabled: canManage || isProfissional,
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

  // Fetch own appointments for the selected month (professional preview)
  const { data: meusAgendamentos = [] } = useQuery({
    queryKey: ["my-agendamentos-comissoes", user?.id, mesRef],
    queryFn: async () => {
      if (!user) return [];
      const startDate = `${mesRef}-01T00:00:00`;
      const endMonth = new Date(parseInt(mesRef.split("-")[0]), parseInt(mesRef.split("-")[1]), 0);
      const endDate = `${mesRef}-${String(endMonth.getDate()).padStart(2, "0")}T23:59:59`;
      const { data } = await supabase
        .from("agendamentos")
        .select(`
          *,
          pacientes(nome),
          matriculas(id, valor_mensalidade),
          pagamentos(status, valor)
        `)
        .eq("profissional_id", user.id)
        .in("status", ["agendado", "confirmado", "pendente", "realizado", "falta", "cancelado"] as any[])
        .gte("data_horario", startDate)
        .lte("data_horario", endDate)
        .order("data_horario", { ascending: true });
      return data ?? [];
    },
    enabled: isProfissional && !canManage,
  });

  // Fetch own commission rules (professional preview)
  const { data: minhasRegrasComissao = [] } = useQuery({
    queryKey: ["my-regras-comissao", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("regras_comissao" as any) as any)
        .select("*").eq("profissional_id", user.id).eq("ativo", true);
      return data ?? [];
    },
    enabled: isProfissional && !canManage,
  });

  // Per-session commission detail calculator
  const getSessionCommission = (profId: string, atendimento: any) => {
    // 1. Tentar pegar da tabela de comissões (calculado pelo motor)
    const existingComm = commissionsData.find(c => c.agendamento_id === atendimento.id);
    
    if (existingComm) {
      return { 
        valorSessao: Number(existingComm.session_value || 0), 
        percentual: Number(existingComm.commission_pct || 0), 
        fixo: Number(existingComm.valor_fixo_regra || 0), 
        comissao: Number(existingComm.valor || 0),
        status_liberacao: existingComm.status_liberacao || "bloqueado",
        isConfirmed: true
      };
    }

    // 2. Fallback para cálculo local (preview para sessões futuras ou sem motor processado)
    const prof = profissionais.find((p: any) => p.user_id === profId);
    const profRegras = regrasComissao.filter((r: any) => r.profissional_id === profId && r.ativo);
    
    const valorSessao = calculateSessionValue(atendimento, matriculas, agendamentos, planosData);
    const { percentual, fixo, commission } = calculateSessionCommission(valorSessao, atendimento.tipo_atendimento, prof, profRegras);
    
    return { 
      valorSessao, 
      percentual, 
      fixo, 
      comissao: commission,
      status_liberacao: "bloqueado", // Default para preview
      isConfirmed: false
    };
  };

  // Calculate own preview commission
  const minhaPreviewComissao = useMemo(() => {
    if (!user || meusAgendamentos.length === 0) return { total: 0, realizados: 0, totalValor: 0 };
    let comissaoTotal = 0;
    let totalValor = 0;
    const realizados = meusAgendamentos.filter((a: any) => a.status === "realizado").length;
    
    for (const a of meusAgendamentos) {
      const sc = getSessionCommission(user.id, a);
      totalValor += sc.valorSessao;
      comissaoTotal += sc.comissao;
    }
    return { total: comissaoTotal, realizados, totalValor };
  }, [user, meusAgendamentos, minhasRegrasComissao]);

  const isClosed = (profId: string) => fechamentos.some((f: any) => f.profissional_id === profId);

  // Calculate commission for a set of appointments for a professional
  const calcCommissionForAppointments = (profId: string, atendimentos: any[]) => {
    const prof = profissionais.find((p: any) => p.user_id === profId);
    if (!prof) return 0;
    const profRegras = regrasComissao.filter((r: any) => r.profissional_id === profId && r.ativo);
    let comissaoTotal = 0;

    for (const a of atendimentos) {
      const sc = getSessionCommission(profId, a);
      comissaoTotal += sc.comissao;
    }

    return comissaoTotal;
  };

  // Auto-calculate compensation: difference between what was closed and current state of prev month
  const calcAutoCompensation = (profId: string): { valor: number; descricao: string } => {
    const prevFechamento = fechamentosPrev.find((f: any) => f.profissional_id === profId);
    if (!prevFechamento) return { valor: 0, descricao: "" };

    // Recalculate prev month commission with current agenda state (cancellations/changes after closing)
    const prevAtendimentos = agendamentosPrev.filter((a: any) =>
      a.profissional_id === profId && ["agendado", "confirmado", "pendente", "realizado", "falta", "cancelado"].includes(a.status)
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
      // Filter sessions for this professional
      let atendimentos = agendamentos.filter((a: any) => a.profissional_id === p.user_id);

      if (filterModalidade !== "todos") {
        atendimentos = atendimentos.filter((a: any) => (a.tipo_atendimento || "").toLowerCase() === filterModalidade.toLowerCase());
      }

      let comissaoTotal = 0;
      let totalValor = 0;
      const modalidadesMap: Record<string, number> = {};

      for (const a of atendimentos) {
        const { valorSessao, comissao } = getSessionCommission(p.user_id, a);
        totalValor += valorSessao;
        comissaoTotal += comissao;

        const tipo = a.tipo_atendimento || "outro";
        modalidadesMap[tipo] = (modalidadesMap[tipo] || 0) + 1;
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


  const updateCommissionStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "liberado" | "bloqueado" }) => {
      const { error } = await (supabase as any)
        .from("commissions")
        .update({ status_liberacao: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissions-table-extract"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error("Erro ao atualizar status", { description: e.message }),
  });

  // Omitindo batchReleaseMutation já que a funcionalidade foi removida a pedido do usuário

  const editCommissionMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, agendamento_id, oldProfId, newProfId, oldValor, newValor, oldObs, syntheticData } = data;
      const now = new Date().toLocaleString("pt-BR");
      const adminName = user?.email || "Admin";
      
      let auditLog = `\n[Audit ${now}]: Alterado por ${adminName}.`;
      if (oldValor !== newValor) auditLog += ` Valor original R$ ${Number(oldValor).toFixed(2)}.`;
      if (oldProfId !== newProfId) {
        const newProf = profissionais.find((p: any) => p.user_id === newProfId);
        auditLog += ` Transferido para ${newProf?.nome || newProfId}.`;
      }
      
      const updatedObs = (oldObs || "") + auditLog;

      if (id) {
        // 1. Update commission
        const { error: commError } = await (supabase as any)
          .from("commissions")
          .update({
            valor: parseFloat(newValor),
            professional_id: newProfId,
            observacoes: updatedObs,
            status_liberacao: "liberado"
          })
          .eq("id", id);
        if (commError) throw commError;
      } else {
        // 2. Insert new commission (from simulation)
        const { error: commError } = await (supabase as any)
          .from("commissions")
          .insert({
            ...syntheticData,
            valor: parseFloat(newValor),
            professional_id: newProfId,
            observacoes: updatedObs,
            status_liberacao: "liberado",
            status: "pendente"
          });
        if (commError) throw commError;
      }

      // 3. Update agendamento (transfer ownership if changed)
      if (oldProfId !== newProfId && agendamento_id) {
        const { error: agendError } = await supabase
          .from("agendamentos")
          .update({ profissional_id: newProfId })
          .eq("id", agendamento_id);
        if (agendError) throw agendError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissions-table-extract"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-comissoes-extract"] });
      toast.success("Comissão atualizada com sucesso!");
      setEditingCommission(null);
    },
    onError: (e: any) => toast.error("Erro na atualização", { description: e.message }),
  });

  const closeMutation = useMutation({
    mutationFn: async (prof: ProfSummary) => {
      if (!user) throw new Error("Não autenticado");
      const mesDate = `${mesRef}-01`;
      const comp = parseFloat(compensacaoValor) || 0;
      const bonus = parseFloat(bonusValor) || 0;
      const valorFinal = prof.comissao + comp + bonus;

      const { error } = await (supabase as any).from("fechamentos_comissao").insert({
        clinic_id: activeClinicId,
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

      // Enviar notificação
      const mesLabel = format(parseMesRefDate(mesRef), "MMMM 'de' yyyy", { locale: ptBR });
      const titulo = `Comissão Fechada — ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`;
      let resumo = `Sua comissão de ${mesLabel} foi fechada. Valor: R$ ${valorFinal.toFixed(2)}.`;
      if (comp !== 0) resumo += ` Compensação: R$ ${comp.toFixed(2)}.`;
      if (bonus !== 0) resumo += ` Bônus: R$ ${bonus.toFixed(2)} (${bonusDesc || "bônus"}).`;

      let conteudo = `Atendimentos: ${prof.totalAtendimentos}\nValor Total: R$ ${prof.totalValor.toFixed(2)}\nComissão Base: R$ ${prof.comissao.toFixed(2)}`;
      if (comp !== 0) conteudo += `\nCompensação: R$ ${comp.toFixed(2)} (${compensacaoDesc || "ajuste agenda"})`;
      if (bonus !== 0) conteudo += `\nBônus: R$ ${bonus.toFixed(2)} (${bonusDesc || "bônus"})`;
      conteudo += `\nValor Final: R$ ${valorFinal.toFixed(2)}`;

      await (supabase as any).from("notificacoes").insert({
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
      toast.success("Comissão fechada!", { description: `${prof.nome} — R$ ${valorFinal.toFixed(2)}` });
      await generateClosingReceipt(prof, valorFinal, comp, bonus);
      setClosingProf(null);
      setClosingNotes("");
      setCompensacaoValor("");
      setCompensacaoDesc("");
      setBonusValor("");
      setBonusDesc("");
    },
    onError: (e: any) => toast.error("Erro ao fechar comissão", { description: e.message }),
  });

  const pagarMutation = useMutation({
    mutationFn: async (fechamento: any) => {
      if (!user || !activeClinicId) throw new Error("Não autenticado ou clínica não selecionada");

      const profName = summary.find(s => s.userId === fechamento.profissional_id)?.nome || "Profissional";
      const mesLabel = format(new Date(fechamento.mes_referencia), "MMMM/yyyy", { locale: ptBR });
      
      // 1. Criar Despesa
      const { data: despesa, error: expError } = await (supabase as any).from("expenses").insert({
        clinic_id: activeClinicId,
        descricao: `Pagamento Comissão - ${profName} - ${mesLabel}`,
        valor: fechamento.valor_final,
        data_vencimento: format(new Date(), "yyyy-MM-dd"),
        data_pagamento: new Date().toISOString(),
        status: "pago",
        categoria: "pessoal"
      }).select("id").single();

      if (expError) throw expError;

      // 2. Atualizar Fechamento
      const { error: fechError } = await (supabase as any)
        .from("fechamentos_comissao")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString(),
        })
        .eq("id", fechamento.id);

      if (fechError) throw fechError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fechamentos-comissao"] });
      toast.success("Pagamento registrado e despesa criada no financeiro!");
    },
    onError: (e: any) => toast.error("Erro ao registrar pagamento", { description: e.message }),
  });

  const handleOpenEdit = (comm: any, synthetic?: any) => {
    setEditingCommission(comm || synthetic);
    setEditForm({
      valor: String(comm?.valor || synthetic?.valor || ""),
      professional_id: comm?.professional_id || synthetic?.professional_id,
      observacoes: comm?.observacoes || synthetic?.observacoes || ""
    });
  };

  const generateClosingReceipt = async (prof: ProfSummary, valorFinal: number, comp: number, bonus: number) => {
    const doc = new jsPDF();
    const settings = await getClinicSettings();
    const mesLabel = format(parseMesRefDate(mesRef), "MMMM 'de' yyyy", { locale: ptBR });

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
    doc.text("Paciente", 45, y);
    doc.text("Origem", 100, y);
    doc.text("Tipo", 135, y);
    doc.text("Status", 160, y);
    doc.text("Valor", 185, y);
    y += 2;
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const a of prof.atendimentosDetail.sort((x: any, y: any) => x.data_horario.localeCompare(y.data_horario))) {
      if (y > 270) { doc.addPage(); y = 20; }
      const dateStr = format(new Date(a.data_horario), "dd/MM HH:mm");
      const pacName = (a.pacientes?.nome || "—").substring(0, 25);
      const isPlano = (a.observacoes || "").toLowerCase().includes("plano:");
      const origem = isPlano ? "Plano" : (a.enrollment_id || a.matricula_id ? "Matrícula" : "Avulsa");
      const tipo = (a.tipo_atendimento || "—").substring(0, 12);
      
      doc.text(dateStr, 20, y);
      doc.text(pacName, 45, y);
      doc.text(origem, 100, y);
      doc.text(tipo, 135, y);
      doc.text(a.status, 160, y);
      doc.text(`R$ ${Number(a.valor_sessao || 0).toFixed(2)}`, 185, y);
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
    toast.success("Recibo PDF gerado!");
  };

  const generateGlobalPDF = async () => {
    const doc = new jsPDF();
    const settings = await getClinicSettings();
    const mesLabel = format(parseMesRefDate(mesRef), "MMMM 'de' yyyy", { locale: ptBR });

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
    toast.success("PDF gerado!");
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

  // Receipt download for a closed commission
  const downloadReceiptPDF = async (c: any) => {
    const doc = new jsPDF();
    const settings = await getClinicSettings();
    const mesLabel = format(new Date(c.mes_referencia), "MMMM 'de' yyyy", { locale: ptBR });
    const profName = c.nome_profissional || user?.email || "Profissional";

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
    doc.text(`Profissional: ${profName}`, 20, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Referência: ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 20, y); y += 7;
    doc.text(`Total de Atendimentos: ${c.total_atendimentos}`, 20, y); y += 7;
    doc.text(`Comissão Base: R$ ${Number(c.total_comissao).toFixed(2)}`, 20, y); y += 7;

    const comp = Number(c.compensacao_anterior || 0);
    const bonus = Number(c.bonus_valor || 0);

    if (comp !== 0) {
      doc.text(`Compensação: R$ ${comp.toFixed(2)}`, 20, y); y += 5;
      if (c.descricao_compensacao) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Motivo: ${c.descricao_compensacao}`, 20, y); y += 5;
        doc.setTextColor(0);
        doc.setFontSize(11);
      }
      y += 3;
    }
    if (bonus !== 0) {
      doc.text(`Bônus: R$ ${bonus.toFixed(2)}`, 20, y); y += 5;
      if (c.bonus_descricao) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Descrição: ${c.bonus_descricao}`, 20, y); y += 5;
        doc.setTextColor(0);
        doc.setFontSize(11);
      }
      y += 3;
    }

    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`TOTAL A RECEBER: R$ ${Number(c.valor_final).toFixed(2)}`, 20, y); y += 10;

    if (c.observacoes) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const obs = doc.splitTextToSize(`Observações: ${c.observacoes}`, 170);
      doc.text(obs, 20, y); y += obs.length * 5;
      doc.setTextColor(0);
    }

    doc.save(`recibo-comissao-${mesLabel.replace(/ /g, "-")}.pdf`);
  };

  // Professional-only view
  if (isProfissional && !canManage) {
    const mesAtualIsClosed = minhasComissoes.some((c: any) => {
      const refDate = new Date(c.mes_referencia);
      return format(refDate, "yyyy-MM") === mesRef;
    });
    return (
      <div className="space-y-4">
        {/* Month selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm shrink-0">Mês de referência:</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const [y, m] = mesRef.split("-").map(Number);
                const d = new Date(y, m - 2, 1);
                setMesRef(format(d, "yyyy-MM"));
              }}
            >
              ←
            </Button>
            <div className="px-3 py-1.5 text-sm font-medium bg-muted rounded-md min-w-[140px] text-center capitalize">
              {format(parseMesRefDate(mesRef), "MMMM/yyyy", { locale: ptBR })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const [y, m] = mesRef.split("-").map(Number);
                const d = new Date(y, m, 1);
                setMesRef(format(d, "yyyy-MM"));
              }}
            >
              →
            </Button>
          </div>
        </div>

        {/* Open commission preview */}
        {!mesAtualIsClosed && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-5 w-5 text-amber-600" />
                Prévia de Comissão Aberta — {format(parseMesRefDate(mesRef), "MMMM/yyyy", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                Estimativa baseada nos atendimentos do mês. Sujeita a fechamento pelo administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-background border p-3">
                  <p className="text-2xl font-bold">{meusAgendamentos.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Atendimentos</p>
                  <p className="text-xs text-muted-foreground">({minhaPreviewComissao.realizados} realizados)</p>
                </div>
                <div className="rounded-lg bg-background border p-3">
                  <p className="text-2xl font-bold">R$ {minhaPreviewComissao.totalValor.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Valor Total</p>
                </div>
                <div className="rounded-lg bg-background border p-3">
                  <p className="text-2xl font-bold text-amber-600">R$ {minhaPreviewComissao.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Comissão Estimada</p>
                </div>
              </div>
              {meusAgendamentos.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Detalhes dos atendimentos:</p>
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Paciente</TableHead>
                          <TableHead className="text-xs">Origem</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {meusAgendamentos.map((a: any) => {
                            const isPlano = (a.observacoes || "").toLowerCase().includes("plano:");
                            const origem = isPlano ? "Plano" : (a.enrollment_id || a.matricula_id ? "Matrícula" : "Avulsa");
                            return (
                              <TableRow key={a.id}>
                                <TableCell className="text-xs py-1.5">{format(new Date(a.data_horario), "dd/MM HH:mm")}</TableCell>
                                <TableCell className="text-xs py-1.5">{a.pacientes?.nome ?? "—"}</TableCell>
                                <TableCell className="text-xs py-1.5">
                                  <Badge variant="outline" className="text-[10px] py-0 font-normal">
                                    {origem}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs py-1.5 capitalize">{a.tipo_atendimento}</TableCell>
                                <TableCell className="text-xs py-1.5">R$ {Number(a.valor_sessao || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-xs py-1.5">
                                  <Badge variant={a.status === "realizado" ? "default" : "secondary"} className="text-xs py-0">
                                    {a.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Closed commissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Comissões Fechadas
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
                    <TableHead>Comissão</TableHead>
                    <TableHead>Comp.</TableHead>
                    <TableHead>Bônus</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Ações</TableHead>
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
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {Number(c.bonus_valor) !== 0 ? (
                          <span className="text-green-600">R$ {Number(c.bonus_valor).toFixed(2)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-primary">R$ {Number(c.valor_final).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Baixar recibo"
                          onClick={() => downloadReceiptPDF(c)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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
              Extrato — {format(parseMesRefDate(mesRef), "MMMM yyyy", { locale: ptBR })}
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-center">Atend.</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s) => {
                    const closed = isClosed(s.userId);
                    const fechamento = fechamentos.find((f: any) => f.profissional_id === s.userId);
                    const isExpanded = expandedProf === s.userId;
                    const sortedAtendimentos = [...s.atendimentosDetail].sort((a: any, b: any) => a.data_horario.localeCompare(b.data_horario));

                    return (
                      <React.Fragment key={s.userId}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedProf(isExpanded ? null : s.userId)}
                        >
                          <TableCell className="w-8 px-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">{s.nome}</TableCell>
                          <TableCell className="text-center">
                            {s.totalAtendimentos}
                            {s.realizados < s.totalAtendimentos && (
                              <span className="text-xs text-muted-foreground ml-1">({s.realizados} real.)</span>
                            )}
                          </TableCell>
                          <TableCell>R$ {s.totalValor.toFixed(2)}</TableCell>
                          <TableCell className="font-bold text-primary">
                            R$ {closed ? Number(fechamento?.valor_final || s.comissao).toFixed(2) : s.comissao.toFixed(2)}
                            {closed && Number(fechamento?.bonus_valor) !== 0 && (
                              <span className="text-xs text-green-600 block">
                                (bônus R$ {Number(fechamento.bonus_valor).toFixed(2)})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {fechamento?.status === "pago" ? (
                              <Badge variant="default" className="gap-1 bg-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> Pago
                              </Badge>
                            ) : closed ? (
                              <Badge variant="default" className="gap-1 bg-blue-600">
                                <Lock className="h-3 w-3" /> Fechado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> Aberto
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {fechamento?.status === "fechado" && (
                                <Button 
                                  size="sm" 
                                  variant="default" 
                                  className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1"
                                  onClick={() => pagarMutation.mutate(fechamento)}
                                  disabled={pagarMutation.isPending}
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Pagar
                                </Button>
                              )}
                              {!closed && (
                                <div className="flex gap-1">
                                  {/* Liberar Todos removido a pedido do usuário */}
                                  <Button size="sm" variant="default" onClick={() => openClosing(s)} className="gap-1 h-8">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Fechar
                                  </Button>
                                </div>
                              )}
                              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => generateClosingReceipt(s, closed ? Number(fechamento?.valor_final || s.comissao) : s.comissao, closed ? Number(fechamento?.compensacao_anterior || 0) : 0, closed ? Number(fechamento?.bonus_valor || 0) : 0)}>
                                <Download className="h-3.5 w-3.5" /> PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded detail rows */}
                        {isExpanded && (
                          <>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-8"></TableHead>
                                <TableHead className="text-xs">Data / Hora</TableHead>
                                <TableHead className="text-xs">Paciente</TableHead>
                                <TableHead className="text-xs">Tipo</TableHead>
                                <TableHead className="text-xs">Valor Sessão</TableHead>
                                <TableHead className="text-xs">% / Fixo</TableHead>
                                <TableHead className="text-xs text-right">Comissão</TableHead>
                              </TableRow>
                            {sortedAtendimentos.map((a: any) => {
                              const sc = getSessionCommission(s.userId, a);
                              return (
                                <TableRow key={a.id} className="bg-muted/10 text-sm">
                                  <TableCell className="w-8">
                                    {sc.isConfirmed && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                        </TooltipTrigger>
                                        <TooltipContent>Cálculo processado pelo motor oficial</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {format(new Date(a.data_horario), "dd/MM HH:mm")}
                                  </TableCell>
                                  <TableCell className="text-xs">{a.pacientes?.nome || "—"}</TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className="text-[10px] truncate max-w-[80px]">
                                      {a.tipo_atendimento || "—"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">R$ {sc.valorSessao.toFixed(2)}</TableCell>
                                  <TableCell className="text-xs">
                                    {sc.percentual > 0 ? (
                                      <span className="flex items-center gap-1">
                                        {sc.percentual.toFixed(0)}%
                                        {a.status === "falta" && <span className="text-[10px] text-amber-600">(falta)</span>}
                                      </span>
                                    ) : sc.fixo > 0 ? (
                                      <span className="flex items-center gap-1">
                                        R$ {sc.fixo.toFixed(2)}
                                        {a.status === "falta" && <span className="text-[10px] text-amber-600">(falta)</span>}
                                      </span>
                                    ) : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium text-right text-primary whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span>R$ {sc.comissao.toFixed(2)}</span>
                                      {canManage && (
                                        <Button
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-muted-foreground/60 hover:text-primary"
                                          onClick={() => {
                                            const existing = commissionsData.find(c => c.agendamento_id === a.id);
                                            if (existing) {
                                              handleOpenEdit(existing);
                                            } else {
                                              handleOpenEdit(null, {
                                                agendamento_id: a.id,
                                                professional_id: a.profissional_id,
                                                valor: sc.comissao,
                                                mes_referencia: `${mesRef}-01`,
                                                clinic_id: activeClinicId,
                                                status_liberacao: "liberado"
                                              });
                                            }
                                          }}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/20 border-b-2">
                              <TableCell colSpan={5}></TableCell>
                              <TableCell className="text-xs font-bold text-right">Subtotal:</TableCell>
                              <TableCell className="text-xs font-bold text-right text-primary">
                                R$ {s.comissao.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </React.Fragment>
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
                  <p className="font-medium">{format(parseMesRefDate(mesRef), "MMMM/yyyy", { locale: ptBR })}</p>
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

              {/* Observação */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Observações</Label>
                <Textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Observações sobre este fechamento..."
                  rows={3}
                />
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

      {/* Edit Commission Dialog */}
      <Dialog open={!!editingCommission} onOpenChange={(o) => !o && setEditingCommission(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" /> Editar Comissão
            </DialogTitle>
            <DialogDescription>
              Ajuste o valor ou transfira esta comissão para outro profissional.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Valor da Comissão (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-10 font-bold text-primary"
                    type="number"
                    step="0.01"
                    value={editForm.valor}
                    onChange={(e) => setEditForm(prev => ({ ...prev, valor: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Profissional Responsável</Label>
                <Select
                  value={editForm.professional_id}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, professional_id: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
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
            </div>

            {editForm.professional_id !== editingCommission?.professional_id && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2">
                <ArrowRightLeft className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-tight">
                  <strong>Atenção:</strong> Ao alterar o profissional, o <strong>Agendamento</strong> na agenda também será transferido automaticamente.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Histórico / Observações</Label>
              <Textarea
                className="text-xs min-h-[80px]"
                value={editForm.observacoes}
                readOnly
                placeholder="O histórico de alterações será adicionado automaticamente aqui."
              />
              <p className="text-[10px] text-muted-foreground italic">
                O sistema gravará automaticamente quem realizou a alteração e os valores originais.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingCommission(null)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => editCommissionMutation.mutate({
                  id: editingCommission.id,
                  agendamento_id: editingCommission.agendamento_id,
                  oldProfId: editingCommission.professional_id,
                  newProfId: editForm.professional_id,
                  oldValor: editingCommission.valor,
                  newValor: editForm.valor,
                  oldObs: editingCommission.observacoes
                })}
                disabled={editCommissionMutation.isPending}
              >
                {editCommissionMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
