import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addLogoToPDF, getClinicSettings, addWatermarkToAllPages } from "./pdfLogo";

interface AvailabilitySlot {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  max_pacientes: number;
}

const DIAS_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function generateAvailabilityPDF(slots: AvailabilitySlot[], professionalName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const settings = await getClinicSettings();

  let y = 10;

  // Add logo
  y = await addLogoToPDF(doc, 10, y, 25, 18);

  // Header
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(settings.nome, pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(11);
  doc.text(`Grade Semanal - ${professionalName}`, 14, Math.max(y, 28));
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, Math.max(y + 6, 34));

  // Group by day
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const headers = ["Horário", ...dayOrder.map(d => DIAS_LABELS[d])];

  // Find all unique time ranges
  const allTimes = [...new Set(slots.map(s => `${s.hora_inicio.slice(0, 5)} - ${s.hora_fim.slice(0, 5)}`))].sort();

  const bodyRows = allTimes.map(timeRange => {
    const [inicio] = timeRange.split(" - ");
    const cells = dayOrder.map(day => {
      const slot = slots.find(s => s.dia_semana === day && s.hora_inicio.slice(0, 5) === inicio);
      return slot ? `${slot.hora_inicio.slice(0, 5)} - ${slot.hora_fim.slice(0, 5)}\nMáx: ${slot.max_pacientes} pac.` : "";
    });
    return [timeRange, ...cells];
  });

  if (bodyRows.length === 0) {
    bodyRows.push(["Nenhum horário configurado", "", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    head: [headers],
    body: bodyRows,
    startY: Math.max(y + 12, 40),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
    headStyles: { fillColor: [34, 139, 115], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" },
    columnStyles: { 0: { cellWidth: 28, halign: "center", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0 && data.cell.raw) {
        data.cell.styles.fillColor = [245, 250, 248];
      }
    },
  });
  await addWatermarkToAllPages(doc);
  
  doc.save(`grade-semanal-${professionalName.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}
