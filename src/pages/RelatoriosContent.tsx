import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Users, DollarSign, Calendar, FileDown, FileSpreadsheet, TrendingDown, UserX, AlertTriangle } from "lucide-react";
import { reportService } from "@/modules/reports/services/reportService";
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
import { toast } from "sonner";
const COLORS = ["hsl(168, 65%, 38%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(142, 71%, 45%)", "hsl(280, 60%, 55%)"];

const Relatorios = () => {
  const { activeClinicId } = useClinic();
  const [mesInicio, setMesInicio] = useState(format(subMonths(new Date(), 5), "yyyy-MM"));
  const [mesFim, setMesFim] = useState(format(new Date(), "yyyy-MM"));
  const [filterProfId, setFilterProfId] = useState("all");

  // Fetch data
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["rel-agendamentos", mesInicio, mesFim, activeClinicId],
    queryFn: () => reportService.getAgendamentos(mesInicio, mesFim, activeClinicId),
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["rel-pagamentos", mesInicio, mesFim, activeClinicId],
    queryFn: () => reportService.getPagamentos(mesInicio, mesFim, activeClinicId),
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["rel-pacientes", activeClinicId],
    queryFn: () => reportService.getPacientes(activeClinicId),
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["rel-profissionais"],
    queryFn: () => reportService.getProfissionais(),
  });

  // Advanced report: by patient (using RPC)
  const { data: relatorioPacientes = [] } = useQuery({
    queryKey: ["rel-por-paciente", mesInicio, mesFim, activeClinicId],
    queryFn: () => reportService.getRelatorioPorPaciente(mesInicio, mesFim, activeClinicId),
    enabled: !!activeClinicId,
  });

  // Advanced report: by professional (using RPC)
  const { data: relatorioProfissionais = [] } = useQuery({
    queryKey: ["rel-por-profissional", mesInicio, mesFim, activeClinicId],
    queryFn: () => reportService.getRelatorioPorProfissional(mesInicio, mesFim, activeClinicId),
    enabled: !!activeClinicId,
  });

  // Advanced report: monthly revenue (using RPC)
  const { data: faturamentoMensalData = [] } = useQuery({
    queryKey: ["rel-faturamento-mensal", mesInicio, mesFim, activeClinicId],
    queryFn: () => reportService.getRelatorioFaturamentoMensal(mesInicio, mesFim, activeClinicId),
    enabled: !!activeClinicId,
  });

  // Computed analytics
  const filtered = filterProfId === "all" ? agendamentos : agendamentos.filter(a => a.profissional_id === filterProfId);
  const filteredPag = filterProfId === "all" ? pagamentos : pagamentos.filter(p => p.profissional_id === filterProfId);

  const totalRecebido = filteredPag.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);
  const totalPendente = filteredPag.filter(p => p.status === "pendente").reduce((s, p) => s + Number(p.valor), 0);
  const totalAtendimentos = filtered.filter(a => a.status === "realizado").length;
  const totalFaltas = filtered.filter(a => a.status === "falta").length;
  const totalCancelados = filtered.filter(a => a.status === "cancelado").length;

  // Stats by professional (Using combined data from RPC + local filtered for other stats)
  const profStats = useMemo(() => {
    return relatorioProfissionais.map(p => ({
      id: p.profissional_id,
      nome: p.profissional_nome,
      realizados: Number(p.sessoes_realizadas),
      faltas: Number(p.total_sessoes - p.sessoes_realizadas),
      total: Number(p.total_sessoes),
      valor: Number(p.faturamento_recebido),
      taxaPresenca: Number(p.sessoes_realizadas) > 0 ? Math.round((Number(p.sessoes_realizadas) / Number(p.total_sessoes)) * 100) : 0
    }));
  }, [relatorioProfissionais]);

  // Evasion: patients who stopped coming (active but no "realizado" in period)
  const evasionList = useMemo(() => {
    const activePatientIds = new Set(pacientes.filter(p => p.status === "ativo").map(p => p.id));
    const attendedIds = new Set(agendamentos.filter(a => a.status === "realizado").map(a => a.paciente_id));
    return pacientes.filter(p => activePatientIds.has(p.id) && !attendedIds.has(p.id));
  }, [pacientes, agendamentos]);

  // Delinquency: pending payments past due
  const inadimplentes = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return pagamentos.filter(p => p.status === "pendente" && p.data_vencimento && p.data_vencimento < today);
  }, [pagamentos]);

  // Monthly revenue chart (Using RPC data)
  const monthlyRevenue = useMemo(() => {
    return faturamentoMensalData.map(d => ({
      name: d.mes,
      valor: Number(d.receita_paga),
      pendente: Number(d.receita_pendente)
    }));
  }, [faturamentoMensalData]);

  // Payment method breakdown
  const paymentMethodBreakdown = useMemo(() => {
    const methods: Record<string, number> = {};
    const labels: Record<string, string> = {
      pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito",
      cartao_debito: "Cartão Débito", boleto: "Boleto", transferencia: "Transferência",
    };
    filteredPag.filter(p => p.status === "pago").forEach(p => {
      const key = p.forma_pagamento || "não informado";
      methods[key] = (methods[key] || 0) + Number(p.valor);
    });
    return Object.entries(methods).map(([key, valor]) => ({ name: labels[key] || key, valor }));
  }, [filteredPag]);

  // Absences by professional chart
  const absencesByProf = profStats.map(p => ({ name: p.nome.split(" ")[0], faltas: p.faltas, cancelados: 0 })); // Note: cancelados changed to 0 natively as it's not present

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
    const rows = filtered.map(a => [
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
    const headers = ["Profissional", "Realizados", "Faltas", "Total", "Taxa Presença", "Valor Total"];
    const rows = profStats.map(p => [p.nome, String(p.realizados), String(p.faltas), String(p.total), `${p.taxaPresenca}%`, `R$ ${p.valor.toFixed(2)}`]);
    if (type === "pdf") { exportPDF(title, headers, rows); } else { exportExcel(title, headers, rows); }
  };

  const exportFinanceiro = (type: "pdf" | "xlsx") => {
    const title = "Relatório Financeiro";
    const headers = ["Data", "Paciente", "Profissional", "Valor", "Status", "Forma Pagamento", "Vencimento"];
    const rows = filteredPag.map(p => [
      p.data_pagamento ? format(new Date(p.data_pagamento), "dd/MM/yyyy") : "—",
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
    const rows = pacientes.map(p => [p.nome, p.telefone, p.status, p.tipo_atendimento]);
    if (type === "pdf") { exportPDF(title, headers, rows); } else { exportExcel(title, headers, rows); }
  };

  const exportPorPaciente = (type: "pdf" | "xlsx") => {
    const title = "Relatório por Paciente";
    const headers = ["Paciente", "Total Sessões", "Realizadas", "Faltas", "Taxa Falta %", "Total Pago", "Pendente", "Última Sessão"];
    const rows = relatorioPacientes.map(p => [
      p.paciente_nome || "—",
      String(p.total_sessoes),
      String(p.sessoes_realizadas),
      String(p.sessoes_falta),
      `${p.taxa_faltas ?? 0}%`,
      `R$ ${Number(p.total_pago ?? 0).toFixed(2)}`,
      `R$ ${Number(p.total_pendente ?? 0).toFixed(2)}`,
      p.ultima_sessao ? format(new Date(p.ultima_sessao), "dd/MM/yyyy") : "—",
    ]);
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
              {profissionais.map(p => (
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
          <TabsTrigger value="pacientes">Por Paciente</TabsTrigger>
          <TabsTrigger value="profissionais">Por Profissional</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="evasao">Evasão & Inadimplência</TabsTrigger>
        </TabsList>

        {/* Por Paciente Tab */}
        <TabsContent value="pacientes" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportPorPaciente("pdf")}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportPorPaciente("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Relatório por Paciente ({relatorioPacientes.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead className="text-center">Sessões</TableHead>
                    <TableHead className="text-center">Realizadas</TableHead>
                    <TableHead className="text-center">Faltas</TableHead>
                    <TableHead className="text-center">Taxa Falta</TableHead>
                    <TableHead className="text-right">Total Pago</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead>Última Sessão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorioPacientes.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum dado no período.</TableCell></TableRow>
                  ) : relatorioPacientes.map((p) => (
                    <TableRow key={p.paciente_id}>
                      <TableCell className="font-medium">{p.paciente_nome}</TableCell>
                      <TableCell className="text-center">{p.total_sessoes}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{p.sessoes_realizadas}</TableCell>
                      <TableCell className="text-center text-red-600">{p.sessoes_falta}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={Number(p.taxa_faltas) >= 30 ? "destructive" : Number(p.taxa_faltas) >= 15 ? "secondary" : "default"}>
                          {p.taxa_faltas ?? 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">R$ {Number(p.total_pago ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-amber-600">R$ {Number(p.total_pendente ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.ultima_sessao ? format(new Date(p.ultima_sessao), "dd/MM/yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`]} />
                    <Legend />
                    <Bar dataKey="valor" fill="hsl(168, 65%, 38%)" name="Receita Paga" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pendente" fill="hsl(38, 92%, 50%)" name="Pendente" radius={[4, 4, 0, 0]} />
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
                        { name: "Agendados", value: filtered.filter(a => a.status === "agendado" || a.status === "confirmado").length },
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
                    {filteredPag.slice(0, 15).map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.data_pagamento ? format(new Date(p.data_pagamento), "dd/MM/yy") : "—"}</TableCell>
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
                    {evasionList.map(p => (
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
                    {inadimplentes.map(p => (
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
