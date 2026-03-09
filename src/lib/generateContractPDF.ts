import jsPDF from "jspdf";
import { addLogoToPDF, getClinicSettings, formatClinicAddress, addWatermarkToAllPages } from "./pdfLogo";

interface ContractData {
  pacienteNome: string;
  cpf: string;
  rg: string;
  planoNome: string;
  planoFrequencia: number;
  planoModalidade: string;
  planoValor: number;
  desconto: number;
  dataContrato: string;
}

export async function generateContractPDF(data: ContractData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 15;

  const settings = await getClinicSettings();

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

  // Logo
  const logoX = pageWidth / 2 - 15;
  y = await addLogoToPDF(doc, logoX, y, 30, 25);
  y += 2;

  // Header
  addText(settings.nome.toUpperCase(), 16, true, "center");
  if (settings.cnpj) {
    addText(`CNPJ: ${settings.cnpj}`, 9, false, "center");
  }
  y += 4;
  addText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PILATES", 13, true, "center");
  y += 6;

  // Intro
  addText("Pelo presente instrumento particular, de um lado:", 10);
  y += 2;

  const endereco = formatClinicAddress(settings);
  const contato = [
    settings.whatsapp ? `telefone/WhatsApp ${settings.whatsapp}` : null,
    settings.instagram ? `Instagram ${settings.instagram}` : null,
  ].filter(Boolean).join(", ");

  addText(`CONTRATADA: ${settings.nome}, pessoa jurídica de direito privado, com sede à ${endereco}${contato ? `, ${contato}` : ""}, doravante denominada CONTRATADA.`, 10);
  y += 4;

  addText("E, de outro lado:", 10);
  y += 2;

  addText(`CONTRATANTE (PACIENTE/ALUNO): ${data.pacienteNome}, CPF nº ${data.cpf || "_______________"}, RG nº ${data.rg || "_______________"}.`, 10, true);
  y += 4;

  addText("As partes resolvem firmar o presente contrato, que se regerá pelas cláusulas seguintes:", 10);
  y += 6;

  // Clauses
  const clauses = [
    { title: "CLÁUSULA 1ª – DO OBJETO", text: "Prestação de serviços de Pilates, conforme plano contratado, com dias e horários previamente agendados." },
    { title: "CLÁUSULA 2ª – DA NATUREZA DO SERVIÇO", text: "O CONTRATANTE declara estar ciente de que o Pilates é um serviço mensal, não sendo contratado por aula, por dia ou por comparecimento.\n\nParágrafo único: Faltas não geram desconto ou devolução de valores." },
    { title: "CLÁUSULA 3ª – DO VALOR E PAGAMENTO", text: "O valor da mensalidade será conforme o plano contratado.\n\n§1º A mensalidade deverá ser paga no primeiro dia de aula do mês.\n\n§2º O não pagamento autoriza a suspensão das aulas até a regularização." },
    { title: "CLÁUSULA 4ª – CANCELAMENTOS E REPOSIÇÕES", text: "§1º Somente haverá reposição de aulas desmarcadas com antecedência mínima de 3 (três) horas.\n\n§2º Cancelamentos fora desse prazo não geram reposição.\n\n§3º As reposições devem ocorrer em até 30 (trinta) dias, sob pena de perda da aula." },
    { title: "CLÁUSULA 5ª – DOS FERIADOS E RECESSOS", text: "Não haverá aulas em feriados ou durante recessos previamente comunicados pela clínica.\n\nParágrafo único: Feriados e recessos não geram reposição, abatimento ou compensação financeira." },
    { title: "CLÁUSULA 6ª – DAS CONDIÇÕES DE SAÚDE", text: "O CONTRATANTE declara estar apto à prática do Pilates e compromete-se a informar qualquer condição de saúde relevante." },
    { title: "CLÁUSULA 7ª – DO DIREITO DE IMAGEM", text: `O CONTRATANTE autoriza, de forma gratuita, o uso de sua imagem e voz para fins institucionais e de divulgação da ${settings.nome}.\n\nParágrafo único: A autorização poderá ser revogada mediante solicitação escrita.` },
    { title: "CLÁUSULA 8ª – DA SUSPENSÃO TEMPORÁRIA", text: "Suspensões somente serão aceitas mediante solicitação prévia e aprovação da CONTRATADA, sem devolução de valores já pagos." },
    { title: "CLÁUSULA 9ª – DA RESCISÃO", text: "O contrato poderá ser rescindido por qualquer das partes, não sendo devida devolução de mensalidades já quitadas." },
    { title: "CLÁUSULA 10ª – DO FORO", text: `Fica eleito o foro da comarca de ${settings.cidade || "Barbacena"}/${settings.estado || "MG"}.` },
  ];

  clauses.forEach((c) => {
    checkPage();
    addText(c.title, 10, true);
    addText(c.text, 10);
    y += 4;
  });

  // Plan details
  checkPage();
  y += 4;
  addText("PLANO CONTRATADO", 12, true, "center");
  y += 4;

  const valorFinal = data.desconto > 0
    ? data.planoValor * (1 - data.desconto / 100)
    : data.planoValor;

  addText(`Plano: ${data.planoNome}`, 10, true);
  addText(`Frequência: ${data.planoFrequencia}x por semana`, 10);
  addText(`Modalidade: ${data.planoModalidade === "individual" ? "Individual" : "Grupo"}`, 10);
  addText(`Valor mensal: R$ ${valorFinal.toFixed(2)}${data.desconto > 0 ? ` (desconto de ${data.desconto}% aplicado)` : ""}`, 10, true);
  y += 10;

  // Contract summary
  checkPage();
  addText("CONTRATO-RESUMO", 12, true, "center");
  y += 4;
  const bullets = [
    "✔ O Pilates é mensal, não é por aula ou por dia",
    "✔ A mensalidade é paga no primeiro dia de aula do mês",
    "✔ Faltas não geram desconto",
    "✔ Reposição somente se avisar com 3 horas de antecedência",
    "✔ Reposição deve ocorrer em até 30 dias",
    "✔ Feriados e recessos não têm reposição",
    "✔ Aulas sem aviso prévio são perdidas",
    "✔ Autorizo o uso de imagem para divulgação da clínica",
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
  addText(settings.nome, 9);
  y += 8;

  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("CONTRATANTE", 9);
  addText(data.pacienteNome, 9);

  await addWatermarkToAllPages(doc);
  return doc;
}
