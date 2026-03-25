import jsPDF from "jspdf";
import QRCode from "qrcode";
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
  incluirCarimbo?: boolean;
  incluirRubrica?: boolean;
  profissionalSignature?: string;
  profissionalRubrica?: string;
  rubricaNoCarimbo?: boolean;
  documentId?: string;
  /** When true, only QR code authentication is shown (no signature/stamp) */
  apenasQrCode?: boolean;
}

const tipoLabels: Record<string, string> = {
  receituario: "RECEITUÁRIO",
  relatorio: "RELATÓRIO CLÍNICO",
  atestado: "ATESTADO",
  encaminhamento: "ENCAMINHAMENTO",
  comparecimento: "COMPROVANTE DE COMPARECIMENTO",
};

function drawCarimbo(doc: jsPDF, x: number, y: number, nome: string, registro?: string, rubricaUrl?: string) {
  const w = 70;
  const h = 28;
  const cx = x - w / 2;

  if (rubricaUrl) {
    try {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
      doc.addImage(rubricaUrl, "PNG", cx + 5, y + 2, w - 10, h - 10);
      doc.restoreGraphicsState();
    } catch (e) {
      console.error("Erro ao adicionar rubrica ao carimbo:", e);
    }
  }

  doc.setDrawColor(0, 90, 160);
  doc.setLineWidth(0.8);
  doc.roundedRect(cx, y, w, h, 2, 2);

  doc.setLineWidth(0.3);
  doc.line(cx + 3, y + 10, cx + w - 3, y + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 60, 120);
  doc.text(nome, x, y + 7, { align: "center" });

  if (registro) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 60, 120);
    doc.text(registro, x, y + 15, { align: "center" });
  }

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text("Profissional de Saúde", x, y + 22, { align: "center" });

  doc.setTextColor(0);
  doc.setDrawColor(0);
}

/** Ensures y position is within page bounds, adding a page if needed */
function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number = 20): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 50) { // 50mm reserved for footer/QR
    doc.addPage();
    return margin;
  }
  return y;
}

export async function generateDocumentPDF(docData: DocumentData) {
  const doc = new jsPDF("p", "mm", "a4");
  const settings = await getClinicSettings();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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
  const label = tipoLabels[docData.tipo] || docData.titulo?.toUpperCase() || docData.tipo.toUpperCase();
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

  // Content - with proper page break handling
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(docData.conteudo, contentWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, 6, margin);
    doc.text(line, margin, y);
    y += 6;
  }

  // Only show signature/stamp area if NOT "apenasQrCode" mode
  if (!docData.apenasQrCode) {
    // Professional signature area
    y += 15;
    y = ensureSpace(doc, y, 45, margin);

    const showSignature = !docData.incluirCarimbo || docData.incluirCarimbo === false;

    if (showSignature) {
      // Real Signature Image if available
      if (docData.profissionalSignature) {
        try {
          doc.addImage(docData.profissionalSignature, "PNG", pageWidth / 2 - 25, y - 2, 50, 20);
          y += 18;
        } catch (e) {}
      }

      // Signature line
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
        y += 5;
      }
    }

    // Carimbo (stamp) - when stamp is active, signature line is skipped to avoid duplication
    if (docData.incluirCarimbo !== false) {
      y += 3;
      y = ensureSpace(doc, y, 35, margin);
      drawCarimbo(
        doc, 
        pageWidth / 2, 
        y, 
        docData.profissionalNome, 
        docData.profissionalRegistro, 
        docData.rubricaNoCarimbo ? docData.profissionalRubrica : undefined
      );
      y += 35;
    }
  }

  // Watermark with professional profile for automatic rubrica
  if (docData.incluirRubrica && !docData.apenasQrCode) {
    await addWatermarkToAllPages(doc, { rubrica_url: docData.profissionalRubrica });
  }

  // QR Code for authenticity (always included when documentId is provided)
  if (docData.documentId) {
    try {
      const verifyUrl = `${window.location.origin}/verificar-documento/${docData.documentId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 120,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const totalPages = doc.getNumberOfPages();
      doc.setPage(totalPages);

      const qrSize = 26;
      const blockH = qrSize + 4;
      const blockY = pageHeight - blockH - 14;

      // Separator line above QR block
      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      doc.line(margin, blockY - 3, pageWidth - margin, blockY - 3);

      // QR code
      const qrX = margin;
      const qrY = blockY;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      // Text next to QR
      const textX = qrX + qrSize + 4;
      let ty = qrY + 5;

      const clinicName = settings.nome || "Clínica";
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(`${clinicName}`, textX, ty);
      doc.setFont("helvetica", "normal");
      doc.text(" - Verificação de autenticidade via QR Code", textX + doc.getTextWidth(`${clinicName}`), ty);
      ty += 5;

      const addr2 = formatClinicAddress(settings);
      if (addr2) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(`Endereço: ${addr2}`, textX, ty);
        ty += 5;
      }

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text("Assinado digitalmente por ", textX, ty);
      const prefixW = doc.getTextWidth("Assinado digitalmente por ");
      doc.setFont("helvetica", "bold");
      const assinadoTxt = docData.profissionalRegistro
        ? `${docData.profissionalNome} - ${docData.profissionalRegistro}`
        : docData.profissionalNome;
      doc.text(assinadoTxt, textX + prefixW, ty);
      ty += 5;

      const shortCode = docData.documentId.substring(0, 8).toUpperCase();
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text("Código de Autenticidade: ", textX, ty);
      const codePrefix = doc.getTextWidth("Código de Autenticidade: ");
      doc.setFont("helvetica", "bold");
      doc.text(shortCode, textX + codePrefix, ty);

      // Validation footer
      const footerY = pageHeight - 8;
      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(60);
      doc.text("*Para validar a autenticidade deste documento, acesse ", margin, footerY);
      const baseText = "*Para validar a autenticidade deste documento, acesse ";
      const baseW = doc.getTextWidth(baseText);

      doc.setTextColor(0, 80, 200);
      doc.setFont("helvetica", "italic");
      doc.text(verifyUrl, margin + baseW, footerY);
      const linkW = doc.getTextWidth(verifyUrl);
      doc.setDrawColor(0, 80, 200);
      doc.setLineWidth(0.2);
      doc.line(margin + baseW, footerY + 0.5, margin + baseW + linkW, footerY + 0.5);

      doc.setTextColor(60);
      doc.setDrawColor(0);
      doc.setFont("helvetica", "italic");
      doc.text(` | Código: ${shortCode}`, margin + baseW + linkW, footerY);

      doc.setTextColor(0);
    } catch (e) {
      console.error("Erro ao gerar QR Code no PDF:", e);
    }
  }

  const fileName = (tipoLabels[docData.tipo] || docData.titulo || docData.tipo).toLowerCase().replace(/\s+/g, "_");
  doc.save(`${fileName}_${docData.pacienteNome.split(" ")[0]}.pdf`);
}
