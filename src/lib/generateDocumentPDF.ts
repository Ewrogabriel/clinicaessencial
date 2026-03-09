import jsPDF from "jspdf";
import { addLogoToPDF, addWatermarkToAllPages, getClinicSettings, formatClinicAddress } from "@/lib/pdfLogo";

interface DocumentData {
  tipo: string;
  titulo: string;
  conteudo: string;
  profissionalNome: string;
  profissionalRegistro?: string;
  pacienteNome: string;
  pacienteCpf?: string;
  data: string;
}

const tipoLabels: Record<string, string> = {
  receituario: "RECEITUÁRIO",
  relatorio: "RELATÓRIO CLÍNICO",
  atestado: "ATESTADO",
  encaminhamento: "ENCAMINHAMENTO",
};

export async function generateDocumentPDF(docData: DocumentData) {
  const doc = new jsPDF("p", "mm", "a4");
  const settings = await getClinicSettings();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header with logo
  let y = 15;
  y = await addLogoToPDF(doc, margin, y, 35, 25);

  // Clinic name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(settings.nome || "Clínica", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (settings.cnpj) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${settings.cnpj}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  const addr = formatClinicAddress(settings);
  if (addr) {
    doc.setFontSize(8);
    doc.text(addr, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  const contacts: string[] = [];
  if (settings.telefone) contacts.push(`Tel: ${settings.telefone}`);
  if (settings.whatsapp) contacts.push(`WhatsApp: ${settings.whatsapp}`);
  if (settings.email) contacts.push(settings.email);
  if (contacts.length) {
    doc.text(contacts.join(" • "), pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  // Separator
  y += 3;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Document type title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const label = tipoLabels[docData.tipo] || docData.tipo.toUpperCase();
  doc.text(label, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Patient info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Paciente: ", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(docData.pacienteNome, margin + doc.getTextWidth("Paciente: "), y);
  y += 6;

  if (docData.pacienteCpf) {
    doc.setFont("helvetica", "bold");
    doc.text("CPF: ", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(docData.pacienteCpf, margin + doc.getTextWidth("CPF: "), y);
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Data: ", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(docData.data, margin + doc.getTextWidth("Data: "), y);
  y += 10;

  // Content
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(docData.conteudo, contentWidth);
  for (const line of lines) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += 6;
  }

  // Professional signature area
  y = Math.max(y + 20, 220);
  if (y > 260) {
    doc.addPage();
    y = 80;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  const sigX = pageWidth / 2 - 40;
  doc.line(sigX, y, sigX + 80, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(docData.profissionalNome, pageWidth / 2, y, { align: "center" });
  y += 5;

  if (docData.profissionalRegistro) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(docData.profissionalRegistro, pageWidth / 2, y, { align: "center" });
  }

  // Watermark
  await addWatermarkToAllPages(doc);

  doc.save(`${label.toLowerCase().replace(/\s+/g, "_")}_${docData.pacienteNome.split(" ")[0]}.pdf`);
}
