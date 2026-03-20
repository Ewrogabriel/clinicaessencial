import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addLogoToPDF, getClinicSettings, formatClinicAddress, addWatermarkToAllPages } from "./pdfLogo";

interface ReportData {
  resumoExecutivo: string;
  destaques: string[];
  alertas: string[];
  analiseFinanceira: string;
  analiseOperacional: string;
  analisePacientes: string;
  recomendacoes: { prioridade: string; acao: string; impacto: string }[];
  projecaoProximoMes: string;
  notaGeral: number;
}

interface Metrics {
  totalPatients: number;
  activePatients: number;
  newPatientsThisMonth: number;
  totalSessions: number;
  completedSessions: number;
  missedSessions: number;
  cancelledSessions: number;
  missRate: string;
  cancelRate: string;
  revenue: number;
  pendingPayments: number;
  totalExpenses: number;
  totalCommissions: number;
  profit: number;
  profitMargin: string;
  ticketMedio: string;
  revenueGrowth: string;
  sessionGrowth: string;
  activeEnrollments: number;
  cancelledEnrollments: number;
  churnRate: string;
  mrrFromEnrollments: number;
  paymentMethods: Record<string, number>;
  expenseCategories: Record<string, number>;
  serviceTypes: Record<string, number>;
  monthName: string;
}

const COLORS = {
  primary: [20, 120, 100] as [number, number, number],
  primaryLight: [230, 245, 240] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  accentLight: [219, 234, 254] as [number, number, number],
  danger: [220, 53, 69] as [number, number, number],
  dangerLight: [254, 226, 226] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  warningLight: [254, 243, 199] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  successLight: [209, 250, 229] as [number, number, number],
  dark: [30, 30, 30] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [240, 240, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Página ${pageNum} de ${totalPages}`, pw / 2, ph - 8, { align: "center" });
  doc.text("Relatório gerado por IA · Essencial Clinic Platform", pw / 2, ph - 4, { align: "center" });
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: [number, number, number]) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

function checkPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return 15;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, emoji: string, y: number): number {
  y = checkPage(doc, y, 15);
  drawRoundedRect(doc, 12, y - 1, doc.internal.pageSize.getWidth() - 24, 10, 2, COLORS.primaryLight);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(`${emoji}  ${title}`, 16, y + 6);
  return y + 14;
}

function drawWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    y = checkPage(doc, y, 6);
    doc.text(line, x, y);
    y += 5;
  }
  return y + 2;
}

export async function generateClinicReportPDF(report: ReportData, metrics: Metrics) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const contentWidth = pw - 30;
  const settings = await getClinicSettings();

  // ===== PAGE 1 - COVER =====
  // Background gradient effect
  drawRoundedRect(doc, 0, 0, pw, 90, 0, COLORS.primary);

  // Logo
  let y = 12;
  try {
    y = await addLogoToPDF(doc, pw / 2 - 15, y, 30, 22);
  } catch { y = 35; }

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text("RELATÓRIO GERENCIAL", pw / 2, y + 5, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(settings.nome || "Clínica", pw / 2, y + 14, { align: "center" });

  doc.setFontSize(11);
  doc.text(metrics.monthName.charAt(0).toUpperCase() + metrics.monthName.slice(1), pw / 2, y + 22, { align: "center" });

  // Score badge
  const scoreY = 100;
  const score = report.notaGeral || 0;
  const scoreColor = score >= 8 ? COLORS.success : score >= 6 ? COLORS.warning : COLORS.danger;
  drawRoundedRect(doc, pw / 2 - 22, scoreY, 44, 30, 6, COLORS.lightGray);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...scoreColor);
  doc.text(score.toFixed(1), pw / 2, scoreY + 18, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text("NOTA GERAL DA CLÍNICA", pw / 2, scoreY + 26, { align: "center" });

  y = scoreY + 38;

  // KPI Cards Row
  const kpis = [
    { label: "Receita", value: `R$ ${fmt(metrics.revenue)}`, color: COLORS.success, bg: COLORS.successLight },
    { label: "Lucro", value: `R$ ${fmt(metrics.profit)}`, color: metrics.profit >= 0 ? COLORS.success : COLORS.danger, bg: metrics.profit >= 0 ? COLORS.successLight : COLORS.dangerLight },
    { label: "Pacientes Ativos", value: String(metrics.activePatients), color: COLORS.accent, bg: COLORS.accentLight },
    { label: "Sessões", value: String(metrics.totalSessions), color: COLORS.primary, bg: COLORS.primaryLight },
  ];

  const cardW = (contentWidth - 9) / 4;
  kpis.forEach((kpi, i) => {
    const cx = 15 + i * (cardW + 3);
    drawRoundedRect(doc, cx, y, cardW, 28, 3, kpi.bg);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text(kpi.label, cx + cardW / 2, y + 8, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, cx + cardW / 2, y + 20, { align: "center" });
  });
  y += 36;

  // Executive Summary
  y = drawSectionTitle(doc, "Resumo Executivo", "📋", y);
  y = drawWrappedText(doc, report.resumoExecutivo || "Sem dados suficientes.", 16, y, contentWidth);

  // Highlights
  if (report.destaques?.length) {
    y += 3;
    y = drawSectionTitle(doc, "Destaques Positivos", "⭐", y);
    report.destaques.forEach((d) => {
      y = checkPage(doc, y, 8);
      drawRoundedRect(doc, 16, y - 3, contentWidth, 8, 2, COLORS.successLight);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(`✅  ${d}`, 20, y + 2);
      y += 10;
    });
  }

  // Alerts
  if (report.alertas?.length) {
    y += 2;
    y = drawSectionTitle(doc, "Pontos de Atenção", "⚠️", y);
    report.alertas.forEach((a) => {
      y = checkPage(doc, y, 8);
      drawRoundedRect(doc, 16, y - 3, contentWidth, 8, 2, COLORS.dangerLight);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(`🔴  ${a}`, 20, y + 2);
      y += 10;
    });
  }

  // ===== PAGE 2 - FINANCIAL =====
  doc.addPage();
  y = 15;

  y = drawSectionTitle(doc, "Análise Financeira", "💰", y);
  y = drawWrappedText(doc, report.analiseFinanceira || "", 16, y, contentWidth);

  // Financial Table
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Receita Bruta", `R$ ${fmt(metrics.revenue)}`],
      ["Receita Pendente", `R$ ${fmt(metrics.pendingPayments)}`],
      ["Despesas", `R$ ${fmt(metrics.totalExpenses)}`],
      ["Comissões", `R$ ${fmt(metrics.totalCommissions)}`],
      ["Lucro Líquido", `R$ ${fmt(metrics.profit)}`],
      ["Margem de Lucro", `${metrics.profitMargin}%`],
      ["Ticket Médio", `R$ ${metrics.ticketMedio}`],
      ["MRR (Matrículas)", `R$ ${fmt(metrics.mrrFromEnrollments)}`],
      ["Crescimento Receita", `${metrics.revenueGrowth}%`],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 16, right: 16 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Payment methods
  const pmEntries = Object.entries(metrics.paymentMethods);
  if (pmEntries.length > 0) {
    y = drawSectionTitle(doc, "Formas de Pagamento", "💳", y);
    autoTable(doc, {
      startY: y,
      head: [["Forma", "Valor (R$)", "% do Total"]],
      body: pmEntries.map(([method, value]) => [
        method,
        `R$ ${fmt(value)}`,
        `${metrics.revenue > 0 ? ((value / metrics.revenue) * 100).toFixed(1) : 0}%`,
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.accent, textColor: 255 },
      margin: { left: 16, right: 16 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Expense categories
  const ecEntries = Object.entries(metrics.expenseCategories);
  if (ecEntries.length > 0) {
    y = checkPage(doc, y, 30);
    y = drawSectionTitle(doc, "Categorias de Despesa", "📊", y);
    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Valor (R$)", "% do Total"]],
      body: ecEntries.map(([cat, value]) => [
        cat,
        `R$ ${fmt(value)}`,
        `${metrics.totalExpenses > 0 ? ((value / metrics.totalExpenses) * 100).toFixed(1) : 0}%`,
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.warning, textColor: 255 },
      margin: { left: 16, right: 16 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== PAGE 3 - OPERATIONAL =====
  doc.addPage();
  y = 15;

  y = drawSectionTitle(doc, "Análise Operacional", "📈", y);
  y = drawWrappedText(doc, report.analiseOperacional || "", 16, y, contentWidth);

  // Sessions table
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de Sessões", String(metrics.totalSessions)],
      ["Sessões Realizadas", String(metrics.completedSessions)],
      ["Faltas", `${metrics.missedSessions} (${metrics.missRate}%)`],
      ["Cancelamentos", `${metrics.cancelledSessions} (${metrics.cancelRate}%)`],
      ["Variação vs Mês Anterior", `${metrics.sessionGrowth}%`],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Service types
  const stEntries = Object.entries(metrics.serviceTypes);
  if (stEntries.length > 0) {
    y = drawSectionTitle(doc, "Distribuição por Modalidade", "🏋️", y);
    // Visual bars
    const maxSessions = Math.max(...stEntries.map(([, v]) => v));
    stEntries.forEach(([tipo, count]) => {
      y = checkPage(doc, y, 12);
      const barWidth = maxSessions > 0 ? (count / maxSessions) * (contentWidth - 60) : 0;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(tipo.charAt(0).toUpperCase() + tipo.slice(1), 16, y + 4);

      drawRoundedRect(doc, 60, y, barWidth, 7, 2, COLORS.primary);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gray);
      doc.text(`${count} sessões`, 62 + barWidth + 2, y + 5);
      y += 11;
    });
    y += 4;
  }

  // Patient analysis
  y = drawSectionTitle(doc, "Análise de Pacientes", "👥", y);
  y = drawWrappedText(doc, report.analisePacientes || "", 16, y, contentWidth);

  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total Cadastrados", String(metrics.totalPatients)],
      ["Pacientes Ativos", String(metrics.activePatients)],
      ["Novos este Mês", String(metrics.newPatientsThisMonth)],
      ["Matrículas Ativas", String(metrics.activeEnrollments)],
      ["Matrículas Canceladas", String(metrics.cancelledEnrollments)],
      ["Taxa de Churn", `${metrics.churnRate}%`],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: COLORS.accent, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ===== PAGE 4 - RECOMMENDATIONS =====
  doc.addPage();
  y = 15;

  y = drawSectionTitle(doc, "Recomendações Estratégicas", "🎯", y);

  if (report.recomendacoes?.length) {
    report.recomendacoes.forEach((rec, i) => {
      y = checkPage(doc, y, 20);
      const prioColor = rec.prioridade === "alta" ? COLORS.danger : rec.prioridade === "media" ? COLORS.warning : COLORS.success;
      const prioBg = rec.prioridade === "alta" ? COLORS.dangerLight : rec.prioridade === "media" ? COLORS.warningLight : COLORS.successLight;
      const prioLabel = rec.prioridade === "alta" ? "ALTA" : rec.prioridade === "media" ? "MÉDIA" : "BAIXA";

      drawRoundedRect(doc, 16, y - 2, contentWidth, 22, 3, [250, 250, 255]);

      // Priority badge
      drawRoundedRect(doc, 18, y, 22, 6, 2, prioBg);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...prioColor);
      doc.text(prioLabel, 29, y + 4, { align: "center" });

      // Action
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(`${i + 1}. ${rec.acao}`, 44, y + 4);

      // Impact
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      const impactLines = doc.splitTextToSize(`Impacto: ${rec.impacto}`, contentWidth - 32);
      impactLines.forEach((line: string, li: number) => {
        doc.text(line, 20, y + 12 + li * 4);
      });

      y += 26;
    });
  }

  // Projection
  y += 4;
  y = drawSectionTitle(doc, "Projeção para o Próximo Mês", "🔮", y);
  y = drawWrappedText(doc, report.projecaoProximoMes || "", 16, y, contentWidth);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  // Address line on first page
  doc.setPage(1);
  const address = formatClinicAddress(settings);
  if (address) {
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(address, pw / 2, 88, { align: "center" });
  }
  await addWatermarkToAllPages(doc);
  
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`relatorio-gerencial-${dateStr}.pdf`);
}
