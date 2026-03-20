import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Users, DollarSign, Calendar, FileDown, FileSpreadsheet, TrendingDown, UserX, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "@/modules/shared/hooks/use-toast";

const COLORS = ["hsl(168, 65%, 38%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(142, 71%, 45%)", "hsl(280, 60%, 55%)"];

const Relatorios = () => {
  const { activeClinicId } = useClinic();
  const [mesInicio, setMesInicio] = useState(format(subMonths(new Date(), 5), "yyyy-MM"));
  const [mesFim, setMesFim] = useState(format(new Date(), "yyyy-MM"));
  const [filterProfId, setFilterProfId] = useState("all");

  // Fetch data
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["rel-agendamentos", mesInicio, mesFim, activeClinicId],
    queryFn: async () => {
      let q = supabase.from("agendamentos")
        .select("id, data_horario, tipo_atendimento, tipo_sessao, status, profissional_id, paciente_id, valor_sessao, pacientes(nome, telefone)")
        .gte("data_horario", `${mesInicio}-01T00:00:00`)
        .lte("data_horario", `${mesFim}-31T23:59:59`)
        .order("data_horario", { ascending: true });
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["rel-pagamentos", mesInicio, mesFim, activeClinicId],
    queryFn: async () => {
      let q = supabase.from("pagamentos")
        .select("id, valor, data_pagamento, status, forma_pagamento, paciente_id, profissional_id, data_vencimento, pacientes(nome)")
        .gte("data_pagamento", `${mesInicio}-01`)
        .lte("data_pagamento", `${mesFim}-31`)
        .order("data_pagamento", { ascending: true });
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["rel-pacientes", activeClinicId],
    queryFn: async () => {
      if (activeClinicId) {
        const { data: cp } = await supabase.from("clinic_pacientes")
          .select("paciente_id").eq("clinic_id", activeClinicId);
        const ids = (cp || []).map(c => c.paciente_id);
        if (!ids.length) return [];
        const { data } = await supabase.from("pacientes")
          .select("id, nome, telefone, status, tipo_atendimento, profissional_id, created_at")
          .in("id", ids).order("nome");
        return data ?? [];
      }
      const { data } = await supabase.from("pacientes")
        .select("id, nome, telefone, status, tipo_atendimento, profissional_id, created_at").order("nome");
      return data ?? [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["rel-profissionais"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome, especialidade, commission_rate").in("user_id", ids).order("nome");
      return data ?? [];
    },
  });

  // Computed analytics
  const filtered = filterProfId === "all" ? agendamentos : agendamentos.filter((a: any) => a.profissional_id === filterProfId);
  const filteredPag = filterProfId === "all" ? pagamentos : pagamentos.filter((p: any) => p.profissional_id === filterProfId);

  const totalRecebido = filteredPag.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalPendente = filteredPag.filter((p: any) => p.status === "pendente").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalAtendimentos = filtered.filter((a: any) => a.status === "realizado").length;
  const totalFaltas = filtered.filter((a: any) => a.status === "falta").length;
  const totalCancelados = filtered.filter((a: any) => a.status === "cancelado").length;

  // Stats by professional
  const profStats = useMemo(() => {
    const stats: Record<string, { nome: string; realizados: number; faltas: number; cancelados: number; total: number; valor: number }> = {};
    (agendamentos as any[]).forEach(a => {
      const pid = a.profissional_id;
      if (!stats[pid]) stats[pid] = { nome: a.profiles?.nome || "—", realizados: 0, faltas: 0, cancelados: 0, total: 0, valor: 0 };
      stats[pid].total++;
      if (a.status === "realizado") { stats[pid].realizados++; stats[pid].valor += Number(a.valor_sessao || 0); }
      if (a.status === "falta") stats[pid].faltas++;
      if (a.status === "cancelado") stats[pid].cancelados++;
    });
    return Object.entries(stats).map(([id, s]) => ({ id, ...s, taxaPresenca: s.total > 0 ? Math.round((s.realizados / s.total) * 100) : 0 }));
  }, [agendamentos]);

  // Evasion: patients who stopped coming (active but no "realizado" in period)
  const evasionList = useMemo(() => {
    const activePatientIds = new Set((pacientes as any[]).filter(p => p.status === "ativo").map(p => p.id));
    const attendedIds = new Set((agendamentos as any[]).filter(a => a.status === "realizado").map(a => a.paciente_id));
    return (pacientes as any[]).filter(p => activePatientIds.has(p.id) && !attendedIds.has(p.id));
  }, [pacientes, agendamentos]);

  // Delinquency: pending payments past due
  const inadimplentes = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return (pagamentos as any[]).filter(p => p.status === "pendente" && p.data_vencimento && p.data_vencimento < today);
  }, [pagamentos]);

  // Monthly revenue chart
  const monthlyRevenue = useMemo(() => {
    const months: Record<string, number> = {};
    (filteredPag as any[]).filter(p => p.status === "pago").forEach(p => {
      const key = format(new Date(p.data_pagamento), "MMM/yy", { locale: ptBR });
      months[key] = (months[key] || 0) + Number(p.valor);
    });
    return Object.entries(months).map(([name, valor]) => ({ name, valor }));
  }, [filteredPag]);

  // Payment method breakdown
  const paymentMethodBreakdown = useMemo(() => {
    const methods: Record<string, number> = {};
    const labels: Record<string, string> = {
      pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito",
      cartao_debito: "Cartão Débito", boleto: "Boleto", transferencia: "Transferência",
    };
    (filteredPag as any[]).filter(p => p.status === "pago").forEach(p => {
      const key = p.forma_pagamento || "não informado";
      methods[key] = (methods[key] || 0) + Number(p.valor);
    });
    return Object.entries(methods).map(([key, valor]) => ({ name: labels[key] || key, valor }));
  }, [filteredPag]);

  // Absences by professional chart
  const absencesByProf = profStats.map(p => ({ name: p.nome.split(" ")[0], faltas: p.faltas, cancelados: p.cancelados }));

  // Export functions
  const exportPDF = (title: string, headers: string[], rows: string[][]) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(`Período: ${mesInicio} a ${mesFim} | Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 139, 115] },
    });
    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
    toast({ title: "PDF gerado!" });
  };

  const exportExcel = (title: string, headers: string[], rows: string[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}.xlsx`);
    toast({ title: "Planilha gerada!" });
  };

  const exportAtendimentos = (type: "pdf" | "xlsx") => {
    const title = "Relatório de Atendimentos";
    const headers = ["Data", "Paciente", "Profissional", "Tipo", "Status", "Valor"];
    const rows = (filtered as any[]).map(a => [
      format(new Date(a.data_horario), "dd/MM/yyyy HH:mm"),
      a.pacientes?.nome || "—",
      a.profiles?.nome || "—",
      a.tipo_atendimento,
      a.status,
      `R$ ${Number(a.valor_sessao || 0).toFixed(2)}`,
    ]);
    if (type === "pdf") { exportPDF(title, headers, rows); } else { exportExcel(title, headers, rows); }
  };

  const exportProfissionais = (type: "pdf" | "xlsx") => {
    const title = "Relatório por Profissional";
    const headers = ["Profissional", "Realizados", "Faltas", "Cancelados", "Total", "Taxa Presença", "Valor Total"];
    const rows = profStats.map(p => [p.nome, String(p.realizados), String(p.faltas), String(p.cancelados), String(p.total), `${p.taxaPresenca}%`, `R$ ${p.valor.toFixed(2)}`]);
    if (type === "pdf") { exportPDF(title, headers, rows); } else { exportExcel(title, headers, rows); }
  };

  const exportFinanceiro = (type: "pdf" | "xlsx") => {
    const title = "Relatório Financeiro";
    const headers = ["Data", "Paciente", "Profissional", "Valor", "Status", "Forma Pagamento", "Vencimento"];
    const rows = (filteredPag as any[]).map(p => [
      format(new Date(p.data_pagamento), "dd/MM/yyyy"),
      p.pacientes?.nome || "—",
      p.profiles?.nome || "—",
      `R$ ${Number(p.valor).toFixed(2)}`,
      p.status,
      p.forma_pagamento || "—",
      p.data_vencimento || "—",
    ]);
    if (type === "pdf") { exportPDF(title, headers, rows); } else { exportExcel(title, headers, rows); }
  };

  const exportPacientes = (type: "pdf" | "xlsx") => {
    const title = "Lista de Pacientes";
    const headers = ["Nome", "Telefone", "Status", "Tipo Atendimento"];
    const rows = (pacientes as any[]).map(p => [p.nome, p.telefone, p.status, p.tipo_atendimento]);
    if (type === "pdf") { exportPDF(title, headers, rows); } else { exportExcel(title, headers, rows); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Relatórios & Estatísticas</h1>
          <p className="text-muted-foreground">Análises detalhadas com exportação em PDF e planilha</p>
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="month" value={mesInicio} onChange={e => setMesInicio(e.target.value)} className="w-auto" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="month" value={mesFim} onChange={e => setMesFim(e.target.value)} className="w-auto" />
          </div>
          <Select value={filterProfId} onValueChange={setFilterProfId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(profissionais as any[]).map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Recebido", value: `R$ ${totalRecebido.toFixed(0)}`, icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
          { label: "Pendente", value: `R$ ${totalPendente.toFixed(0)}`, icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
          { label: "Realizados", value: totalAtendimentos, icon: Calendar, color: "text-blue-600 bg-blue-50" },
          { label: "Faltas", value: totalFaltas, icon: UserX, color: "text-red-600 bg-red-50" },
          { label: "Cancelados", value: totalCancelados, icon: TrendingDown, color: "text-orange-600 bg-orange-50" },
          { label: "Evasões", value: evasionList.length, icon: Users, color: "text-purple-600 bg-purple-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <div className={`rounded-md p-1.5 ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
              </div>
              <p className="text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="atendimentos" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
          <TabsTrigger value="profissionais">Por Profissional</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="evasao">Evasão & Inadimplência</TabsTrigger>
        </TabsList>

        {/* Atendimentos Tab */}
        <TabsContent value="atendimentos" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportAtendimentos("pdf")}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportAtendimentos("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Faturamento Mensal</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={v => `R$${v}`} />
                    <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
                    <Bar dataKey="valor" fill="hsl(168, 65%, 38%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Status dos Agendamentos</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Realizados", value: totalAtendimentos },
                        { name: "Faltas", value: totalFaltas },
                        { name: "Cancelados", value: totalCancelados },
                        { name: "Agendados", value: filtered.filter((a: any) => a.status === "agendado" || a.status === "confirmado").length },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" outerRadius={100} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[0, 1, 2, 3].map(i => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profissionais Tab */}
        <TabsContent value="profissionais" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportProfissionais("pdf")}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportProfissionais("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Faltas e Cancelamentos por Profissional</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={absencesByProf}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="faltas" fill="hsl(0, 72%, 51%)" name="Faltas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelados" fill="hsl(38, 92%, 50%)" name="Cancelados" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Desempenho por Profissional</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-center">Realizados</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-center">Presença</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profStats.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-center">{p.realizados}</TableCell>
                        <TableCell className="text-center">{p.faltas}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={p.taxaPresenca >= 80 ? "default" : p.taxaPresenca >= 50 ? "secondary" : "destructive"}>
                            {p.taxaPresenca}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">R$ {p.valor.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="financeiro" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportFinanceiro("pdf")}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportFinanceiro("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => exportPacientes("pdf")}><FileDown className="h-4 w-4 mr-1" />Lista Pacientes PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportPacientes("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Lista Pacientes Excel</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Pagamentos Recentes</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Forma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredPag as any[]).slice(0, 15).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.data_pagamento), "dd/MM/yy")}</TableCell>
                        <TableCell>{p.pacientes?.nome || "—"}</TableCell>
                        <TableCell>{p.profiles?.nome || "—"}</TableCell>
                        <TableCell className="font-medium">R$ {Number(p.valor).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={p.status === "pago" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                        <TableCell>{p.forma_pagamento || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recebimento por Forma de Pagamento</CardTitle></CardHeader>
              <CardContent>
                {paymentMethodBreakdown.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Sem dados de pagamento no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={paymentMethodBreakdown}
                        cx="50%" cy="50%" outerRadius={100} dataKey="valor"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {paymentMethodBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend /><Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evasão & Inadimplência Tab */}
        <TabsContent value="evasao" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserX className="h-5 w-5 text-purple-600" />
                  Pacientes em Evasão ({evasionList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evasionList.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum paciente em evasão no período.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-auto">
                    {evasionList.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{p.telefone}</p>
                        </div>
                        <Badge variant="outline" className="text-purple-600">Sem atendimento</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Inadimplentes ({inadimplentes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inadimplentes.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhuma inadimplência detectada.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-auto">
                    {inadimplentes.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/30">
                        <div>
                          <p className="text-sm font-medium">{p.pacientes?.nome || "—"}</p>
                          <p className="text-xs text-muted-foreground">Vencimento: {p.data_vencimento}</p>
                        </div>
                        <Badge variant="destructive">R$ {Number(p.valor).toFixed(2)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
