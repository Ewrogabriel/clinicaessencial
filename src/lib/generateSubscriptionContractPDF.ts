import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionContractData {
  clinicaNome: string;
  clinicaCNPJ: string;
  clinicaEndereco: string;
  clinicaCidade: string;
  clinicaEstado: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelTelefone: string;
  planoNome: string;
  planoValor: number;
  recursos: string[];
  dataContrato: string;
}

export async function generateSubscriptionContractPDF(data: SubscriptionContractData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addText = (text: string, size: number, bold = false, align: "left" | "center" = "left") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    if (align === "center") {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, y, { align: "center" });
        y += size * 0.5;
      });
    } else {
      doc.text(lines, margin, y);
      y += lines.length * size * 0.5;
    }
    y += 2;
  };

  const checkPage = () => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  addText("CONTRATO DE ASSINATURA DE PLATAFORMA", 16, true, "center");
  addText("Sistema de Gestão de Clínicas", 12, false, "center");
  y += 6;

  // Intro
  addText("Pelo presente instrumento particular, de um lado:", 10);
  y += 2;

  addText("CONTRATADA: Essencial Fisio Pilates - Sistema de Gestão, plataforma digital de gestão de clínicas de fisioterapia e pilates, doravante denominada CONTRATADA.", 10);
  y += 4;

  addText("E, de outro lado:", 10);
  y += 2;

  const enderecoCompleto = [
    data.clinicaEndereco,
    data.clinicaCidade && data.clinicaEstado ? `${data.clinicaCidade} - ${data.clinicaEstado}` : null
  ].filter(Boolean).join(", ");

  addText(`CONTRATANTE: ${data.clinicaNome}${data.clinicaCNPJ ? `, CNPJ: ${data.clinicaCNPJ}` : ""}${enderecoCompleto ? `, ${enderecoCompleto}` : ""}, representada por ${data.responsavelNome}${data.responsavelEmail ? `, e-mail: ${data.responsavelEmail}` : ""}${data.responsavelTelefone ? `, telefone: ${data.responsavelTelefone}` : ""}.`, 10, true);
  y += 4;

  addText("As partes resolvem firmar o presente contrato de assinatura, que se regerá pelas cláusulas seguintes:", 10);
  y += 6;

  // Clauses
  const clauses = [
    {
      title: "CLÁUSULA 1ª – DO OBJETO",
      text: "A CONTRATADA se compromete a fornecer acesso à plataforma de gestão de clínicas, conforme o plano contratado, incluindo todos os recursos e funcionalidades descritos neste contrato."
    },
    {
      title: "CLÁUSULA 2ª – DO PLANO CONTRATADO",
      text: `Plano: ${data.planoNome}\nValor mensal: R$ ${data.planoValor.toFixed(2)}\n\nRecursos incluídos:\n${data.recursos && data.recursos.length > 0 ? data.recursos.map(r => `• ${r}`).join('\n') : '• Todos os recursos da plataforma'}`
    },
    {
      title: "CLÁUSULA 3ª – DO PAGAMENTO",
      text: "O pagamento da assinatura deverá ser realizado mensalmente, no valor especificado no plano contratado.\n\n§1º O vencimento ocorrerá todo dia 10 de cada mês.\n\n§2º O não pagamento no prazo estabelecido resultará em suspensão temporária do acesso à plataforma.\n\n§3º Após 15 (quinze) dias de inadimplência, a conta poderá ser definitivamente bloqueada."
    },
    {
      title: "CLÁUSULA 4ª – DAS OBRIGAÇÕES DA CONTRATADA",
      text: "§1º Manter a plataforma disponível 24/7, exceto em casos de manutenção programada.\n\n§2º Garantir a segurança e privacidade dos dados conforme LGPD.\n\n§3º Fornecer suporte técnico durante horário comercial.\n\n§4º Realizar backups periódicos dos dados."
    },
    {
      title: "CLÁUSULA 5ª – DAS OBRIGAÇÕES DO CONTRATANTE",
      text: "§1º Efetuar o pagamento nas datas estabelecidas.\n\n§2º Utilizar a plataforma de forma ética e legal.\n\n§3º Manter seus dados de acesso em sigilo.\n\n§4º Não compartilhar ou revender o acesso à plataforma."
    },
    {
      title: "CLÁUSULA 6ª – DA VIGÊNCIA E RENOVAÇÃO",
      text: "O contrato tem vigência mensal e renovação automática, salvo cancelamento expresso por qualquer das partes com antecedência mínima de 30 (trinta) dias."
    },
    {
      title: "CLÁUSULA 7ª – DO CANCELAMENTO",
      text: "§1º O CONTRATANTE pode solicitar cancelamento a qualquer momento, sem multa, respeitando o prazo de 30 dias.\n\n§2º Após o cancelamento, os dados permanecerão disponíveis por 90 dias para eventual reativação.\n\n§3º Não haverá reembolso proporcional do período já pago."
    },
    {
      title: "CLÁUSULA 8ª – DA PROPRIEDADE DOS DADOS",
      text: "Todos os dados cadastrados na plataforma são de propriedade exclusiva do CONTRATANTE, garantindo-se o direito de exportação a qualquer momento."
    },
    {
      title: "CLÁUSULA 9ª – DA PRIVACIDADE",
      text: "A CONTRATADA compromete-se a tratar todos os dados de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)."
    },
    {
      title: "CLÁUSULA 10ª – DAS DISPOSIÇÕES GERAIS",
      text: "§1º Este contrato pode ser alterado mediante acordo entre as partes.\n\n§2º A tolerância de uma parte para com a outra não implica em renúncia de direitos.\n\n§3º Todas as comunicações oficiais devem ser feitas por e-mail."
    },
    {
      title: "CLÁUSULA 11ª – DO FORO",
      text: "Fica eleito o foro da comarca de Barbacena/MG para dirimir quaisquer dúvidas oriundas deste contrato."
    }
  ];

  clauses.forEach((c) => {
    checkPage();
    addText(c.title, 10, true);
    addText(c.text, 10);
    y += 4;
  });

  // Contract summary
  checkPage();
  y += 4;
  addText("RESUMO DO CONTRATO", 12, true, "center");
  y += 4;
  const bullets = [
    `✔ Plano: ${data.planoNome}`,
    `✔ Valor: R$ ${data.planoValor.toFixed(2)}/mês`,
    `✔ Vencimento: Todo dia 10`,
    `✔ Renovação automática mensal`,
    `✔ Cancelamento com 30 dias de antecedência`,
    `✔ Dados protegidos conforme LGPD`,
    `✔ Backup automático dos dados`,
    `✔ Suporte técnico incluído`,
  ];
  bullets.forEach((b) => {
    addText(b, 10);
  });

  y += 6;
  addText("Declaro que li, entendi e concordo com as condições acima.", 10, true);
  y += 10;

  // Signatures
  checkPage();
  addText(`Data: ${data.dataContrato}`, 10);
  y += 12;

  doc.setFontSize(10);
  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("CONTRATADA", 9);
  addText("Essencial Fisio Pilates - Sistema", 9);
  y += 8;

  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("CONTRATANTE", 9);
  addText(data.clinicaNome, 9);
  addText(data.responsavelNome, 9);

  return doc;
}
