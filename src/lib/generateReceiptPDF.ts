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

const fallbackClinicSettings = {
  nome: "Essencial Fisio Pilates",
  cnpj: "61.080.977/0001-50",
  endereco: "Rua Capitão Antônio Ferreira Campos",
  numero: "46",
  bairro: "Carmo",
  cidade: "Barbacena",
  estado: "MG",
  whatsapp: "(32) 98415-2802",
  instagram: "@essencialfisiopilatesbq",
  email: null,
  telefone: null,
  logo_url: null,
  rubrica_url: null,
  assinatura_url: null,
};

async function runReceiptStep<T>(step: () => Promise<T>, fallback: T, timeoutMs = 4000): Promise<T> {
  try {
    return await Promise.race([
      step(),
      new Promise<T>((resolve) => {
        setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch {
    return fallback;
  }
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
  const ph = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pw - margin * 2;
  let y = 18;

  const settings = await runReceiptStep(() => getClinicSettings(), fallbackClinicSettings);

  // Outer border
  doc.setDrawColor(0, 120, 120);
  doc.setLineWidth(0.6);
  doc.roundedRect(12, 12, pw - 24, ph - 24, 4, 4);

  // Logo (centered)
  y = await runReceiptStep(() => addLogoToPDF(doc, pw / 2 - 15, y, 28, 22), y + 22);
  y += 2;

  // Clinic header
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 80);
  doc.text(settings.nome.toUpperCase(), pw / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  if (settings.cnpj) {
    doc.text(`CNPJ: ${settings.cnpj}`, pw / 2, y, { align: "center" });
    y += 3.5;
  }

  const endereco = formatClinicAddress(settings);
  if (endereco) {
    const enderecoLines = doc.splitTextToSize(endereco, contentWidth);
    doc.text(enderecoLines, pw / 2, y, { align: "center" });
    y += enderecoLines.length * 3.5;
  }

  const contato = [
    settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : null,
    settings.instagram || null,
  ].filter(Boolean).join(" | ");
  if (contato) {
    doc.text(contato, pw / 2, y, { align: "center" });
    y += 4;
  }
  y += 3;

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 80);
  doc.text("RECIBO DE PAGAMENTO", pw / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Nº ${data.numero}`, pw / 2, y, { align: "center" });
  y += 9;

  doc.setTextColor(0, 0, 0);

  // Field rendering with wrapping
  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const labelText = `${label}:`;
    doc.text(labelText, margin, y);
    const labelW = doc.getTextWidth(labelText) + 2;

    doc.setFont("helvetica", "normal");
    const valueWidth = contentWidth - labelW;
    const valueLines = doc.splitTextToSize(String(value || "—"), valueWidth);
    doc.text(valueLines, margin + labelW, y);
    y += Math.max(6, valueLines.length * 4.5);
  };

  addField("Recebi de", data.pacienteNome);
  addField("CPF", data.cpf || "Não informado");
  if (data.referencia) addField("Referência", data.referencia);
  addField("Descrição", data.descricao);
  addField("Forma de pagamento", formaLabel[data.formaPagamento] || data.formaPagamento || "—");
  addField("Data do pagamento", data.dataPagamento);

  y += 3;

  // Amount box
  doc.setFillColor(240, 249, 249);
  doc.roundedRect(margin, y, contentWidth, 16, 3, 3, "F");
  doc.setDrawColor(0, 120, 120);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 16, 3, 3, "S");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 80);
  doc.text("VALOR RECEBIDO:", margin + 5, y + 10);
  doc.setFontSize(15);
  doc.text(`R$ ${data.valor.toFixed(2)}`, pw - margin - 5, y + 10, { align: "right" });
  y += 22;

  doc.setTextColor(0, 0, 0);

  // Legal text
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  const legalText = "Para maior clareza, firmo o presente recibo para que produza os efeitos legais necessários.";
  const legalLines = doc.splitTextToSize(legalText, contentWidth);
  doc.text(legalLines, pw / 2, y, { align: "center" });
  y += legalLines.length * 4 + 8;

  // City/Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const cidade = settings.cidade || "Barbacena";
  const estado = settings.estado || "MG";
  doc.text(`${cidade}/${estado}, ${data.dataPagamento}`, margin, y);
  y += 14;

  // Signature line
  if (y > ph - 45) {
    // Avoid overlapping the bottom border/watermark contact info
    y = ph - 45;
  }
  doc.setDrawColor(80);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 75, y);
  y += 4.5;
  doc.setFontSize(8.5);
  doc.text(settings.nome, margin, y);
  y += 3.5;
  if (settings.cnpj) {
    doc.text(`CNPJ: ${settings.cnpj}`, margin, y);
  }

  // Watermark + bottom contact info on every page
  await runReceiptStep(() => addWatermarkToAllPages(doc), undefined);
  return doc;
}

export function getReceiptNumber(pagamentoId: string, createdAt: string): string {
  const date = new Date(createdAt);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const short = pagamentoId.slice(0, 6).toUpperCase();
  return `${yy}${mm}-${short}`;
}
