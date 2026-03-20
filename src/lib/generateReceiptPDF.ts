import jsPDF from "jspdf";
import { addLogoToPDF, getClinicSettings, formatClinicAddress, addWatermarkToAllPages } from "./pdfLogo";

interface ReceiptData {
  numero: string;
  pacienteNome: string;
  cpf: string;
  descricao: string;
  valor: number;
  formaPagamento: string;
  dataPagamento: string;
  referencia: string;
}

const formaLabel: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export async function generateReceiptPDF(data: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Get clinic settings
  const settings = await getClinicSettings();

  // Border
  doc.setDrawColor(0, 120, 120);
  doc.setLineWidth(0.8);
  doc.roundedRect(12, 12, pw - 24, 160, 4, 4);

  // Logo
  const logoX = pw / 2 - 15;
  y = await addLogoToPDF(doc, logoX, y, 30, 25);
  y += 2;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(settings.nome.toUpperCase(), pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (settings.cnpj) {
    doc.text(`CNPJ: ${settings.cnpj}`, pw / 2, y, { align: "center" });
    y += 4;
  }
  const endereco = formatClinicAddress(settings);
  if (endereco) {
    doc.text(endereco, pw / 2, y, { align: "center" });
    y += 4;
  }
  const contato = [
    settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : null,
    settings.instagram || null,
  ].filter(Boolean).join(" | ");
  if (contato) {
    doc.text(contato, pw / 2, y, { align: "center" });
    y += 4;
  }
  y += 4;

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE PAGAMENTO", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${data.numero}`, pw / 2, y, { align: "center" });
  y += 10;

  // Fields
  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + doc.getTextWidth(`${label}: `) + 2, y);
    y += 7;
  };

  addField("Recebi de", data.pacienteNome);
  addField("CPF", data.cpf || "Não informado");
  addField("Referência", data.referencia);
  addField("Descrição", data.descricao);
  addField("Forma de pagamento", formaLabel[data.formaPagamento] || data.formaPagamento || "—");
  addField("Data do pagamento", data.dataPagamento);

  y += 4;

  // Amount box
  doc.setFillColor(240, 249, 249);
  doc.roundedRect(margin, y - 2, pw - margin * 2, 16, 3, 3, "F");
  doc.setDrawColor(0, 120, 120);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y - 2, pw - margin * 2, 16, 3, 3, "S");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("VALOR RECEBIDO:", margin + 6, y + 8);
  doc.setFontSize(16);
  doc.text(`R$ ${data.valor.toFixed(2)}`, pw - margin - 6, y + 8, { align: "right" });
  y += 24;

  // Valor por extenso
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Para maior clareza, firmo o presente recibo para que produza os efeitos legais necessários.",
    pw / 2, y, { align: "center" }
  );
  y += 14;

  // Signature
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const cidade = settings.cidade || "Barbacena";
  const estado = settings.estado || "MG";
  doc.text(`${cidade}/${estado}, ${data.dataPagamento}`, margin, y);
  y += 16;

  doc.line(margin, y, margin + 70, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(settings.nome, margin, y);
  y += 4;
  if (settings.cnpj) {
    doc.text(`CNPJ: ${settings.cnpj}`, margin, y);
  }

  await addWatermarkToAllPages(doc);
  return doc;
}

export function getReceiptNumber(pagamentoId: string, createdAt: string): string {
  const date = new Date(createdAt);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const short = pagamentoId.slice(0, 6).toUpperCase();
  return `${yy}${mm}-${short}`;
}
