import jsPDF from "jspdf";
import QRCode from "qrcode";
import { addLogoToPDF, getClinicSettings, formatClinicAddress, addWatermarkToAllPages } from "./pdfLogo";

interface ContractData {
  pacienteNome: string;
  cpf: string;
  rg: string;
  pacienteEndereco?: string;
  pacienteTelefone?: string;
  planoNome: string;
  planoFrequencia: number;
  planoModalidade: string;
  planoValor: number;
  desconto: number;
  dataContrato: string;
  horarios?: string;
  pacienteSignature?: string;
  profissionalSignature?: string;
  profissionalRubrica?: string;
  rubricaNoCarimbo?: boolean;
  incluirRubrica?: boolean;
  incluirCarimbo?: boolean;
  profissionalNome?: string;
  profissionalRegistro?: string;
  conselhoProfissional?: string;
  contractId?: string;
  // Fallback fields
  contractMultaAtrasoPct?: number;
  contractJurosMensalPct?: number;
  contractPrazoCancelamentoH?: number;
  contractPrazoReposicaoDias?: number;
  contractVigenciaMeses?: number;
  contractCidadeForo?: string;
  contractEstadoForo?: string;
  contractEnrollmentFee?: number;
  contractPaymentMethod?: string;
  witness1Name?: string;
  witness1Cpf?: string;
  witness2Name?: string;
  witness2Cpf?: string;
}

export async function drawCarimbo(doc: jsPDF, x: number, y: number, nome: string, registro?: string, conselho?: string, rubricaUrl?: string) {
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
    const text = conselho ? `${conselho}: ${registro}` : registro;
    doc.text(text, x, y + 15, { align: "center" });
  }

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text("Profissional de Saúde", x, y + 22, { align: "center" });
  doc.setTextColor(0);
  doc.setDrawColor(0);
}

export async function generateContractPDF(data: ContractData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 15;

  const settings = await getClinicSettings();

  const addText = (text: string, size: number, bold = false, align: "left" | "center" | "justify" = "left") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    
    if (align === "center") {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, y, { align: "center" });
        y += size * 0.5;
      });
    } else if (align === "justify") {
      doc.text(lines, margin, y, { align: "justify", maxWidth });
      y += lines.length * size * 0.5;
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
  addText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS – PILATES", 13, true, "center");
  y += 6;

  // Intro
  const clinicAddress = formatClinicAddress(settings);
  addText("CONTRATADA:", 11, true);
  addText(`${settings.nome}, com sede à ${clinicAddress}${settings.telefone ? `, telefone ${settings.telefone}` : ""}${settings.instagram ? `, Instagram ${settings.instagram}` : ""}.`, 10);
  y += 2;

  addText("CONTRATANTE (PACIENTE):", 11, true);
  const pacParts = [
    `Nome: ${data.pacienteNome}`,
    `CPF: ${data.cpf || "_______________"}`,
    `RG: ${data.rg || "_______________"}`,
    data.pacienteTelefone ? `Telefone: ${data.pacienteTelefone}` : null,
    data.pacienteEndereco ? `Endereço: ${data.pacienteEndereco}` : null
  ].filter(Boolean).join(" | ");
  addText(pacParts, 10);
  y += 4;

  const clauses = [
    { title: "CLÁUSULA 1ª – DO OBJETO", text: "Prestação de serviços de Pilates, conforme plano contratado, com horários previamente agendados." },
    { title: "CLÁUSULA 2ª – DA NATUREZA DO PLANO", text: "O CONTRATANTE declara ciência de que:\n✔ O serviço é mensal;\n✔ Não é vinculado a número de aulas frequentadas;\n✔ A vaga/horário é reservada mensalmente;\n✔ Faltas não geram desconto ou crédito." },
    { title: "CLÁUSULA 3ª – DO PLANO CONTRATADO", text: `Plano: ${data.planoNome}\nFrequência: ${data.planoFrequencia} vez(es) por semana\nHorário(s): ${data.horarios || "A definir"}\nValor mensal: R$ ${(data.desconto > 0 ? data.planoValor * (1 - data.desconto / 100) : data.planoValor).toFixed(2)}${data.contractEnrollmentFee && data.contractEnrollmentFee > 0 ? `\nTaxa de matrícula: R$ ${data.contractEnrollmentFee.toFixed(2)}` : ""}` },
    { title: "CLÁUSULA 4ª – DO PAGAMENTO", text: `§1º O pagamento será realizado no primeiro dia de aula do mês${data.contractPaymentMethod ? `, via ${data.contractPaymentMethod}` : ""}.\n§2º Em caso de atraso: Multa de ${data.contractMultaAtrasoPct || 2}% e Juros de ${data.contractJurosMensalPct || 1}% ao mês.\n§3º Após inadimplência: Aulas poderão ser suspensas imediatamente e o horário poderá ser liberado para outro paciente.` },
    { title: "CLÁUSULA 5ª – DAS FALTAS E REPOSIÇÕES", text: `§1º Reposição somente se avisado com mínimo de ${data.contractPrazoCancelamentoH || 3} horas de antecedência.\n§2º Aulas não desmarcadas no prazo serão consideradas realizadas.\n§3º Reposição deve ocorrer em até ${data.contractPrazoReposicaoDias || 30} dias.\n§4º A reposição depende de disponibilidade de vaga.\n§5º Após ${data.contractPrazoReposicaoDias || 30} dias -> aula perdida sem direito a compensação.` },
    { title: "CLÁUSULA 6ª – DOS FERIADOS E RECESSOS", text: "§1º Não haverá aulas em feriados ou recessos da clínica.\n§2º Não há reposição ou desconto nesses casos." },
    { title: "CLÁUSULA 7ª – DOS ATRASOS", text: "Atrasos do paciente não prolongam a aula e não geram reposição." },
    { title: "CLÁUSULA 8ª – DA SAÚDE E RESPONSABILIDADE DO PACIENTE", text: "§1º O paciente declara estar apto à prática.\n§2º Obriga-se a informar: Lesões, Doenças, Cirurgias, Gravidez ou uso de medicação relevante.\n§3º A omissão dessas informações transfere a responsabilidade ao paciente." },
    { title: "CLÁUSULA 9ª – DOS RISCOS DA ATIVIDADE", text: "O CONTRATANTE reconhece que o Pilates envolve atividade física e riscos inerentes, ainda que mínimos." },
    { title: "CLÁUSULA 10ª – DO SEGURO E LIMITAÇÃO DE RESPONSABILIDADE", text: "§1º A clínica poderá manter seguro de responsabilidade civil.\n§2º A responsabilidade da clínica e dos profissionais somente ocorrerá em caso de dolo ou culpa comprovada.\n§3º Não há responsabilidade nos casos de omissão de informações de saúde, descumprimento de orientações, execução inadequada ou limitações pré-existentes.\n§4º Eventuais indenizações seguirão os limites legais e da apólice (se houver)." },
    { title: "CLÁUSULA 11ª – DA PROTEÇÃO DOS PROFISSIONAIS", text: "O paciente compromete-se a respeitar os profissionais, seguir orientações técnicas e manter conduta adequada. Parágrafo único: Conduta inadequada pode gerar cancelamento imediato." },
    { title: "CLÁUSULA 12ª – DO DIREITO DE IMAGEM", text: "Autoriza o uso de imagem para divulgação da clínica. Pode revogar por escrito." },
    { title: "CLÁUSULA 13ª – DA LGPD (DADOS PESSOAIS)", text: "§1º Dados serão usados para cadastro, atendimento, comunicação e obrigações legais.\n§2º Dados de saúde são considerados sensíveis.\n§3º A clínica adota medidas de segurança." },
    { title: "CLÁUSULA 14ª – DO TRANCAMENTO", text: "§1º Deve ser solicitado com antecedência e depende de aprovação da clínica.\n§2º Não há devolução de valores." },
    { title: "CLÁUSULA 15ª – DO CANCELAMENTO", text: "§1º Pode ser solicitado a qualquer momento.\n§2º Não há devolução de valores pagos.\n§3º O paciente perde o direito ao horário reservado." },
    { title: "CLÁUSULA 16ª – DOS OBJETOS PESSOAIS", text: "A clínica não se responsabiliza por perdas ou danos a objetos pessoais." },
    { title: "CLÁUSULA 17ª – DO USO DA ESTRUTURA", text: "O paciente deve zelar pelos equipamentos, seguir orientações e não utilizar aparelhos sem autorização." },
    { title: "CLÁUSULA 18ª – DO CASO FORTUITO", text: "A clínica não se responsabiliza por interrupções externas (energia, força maior, etc.)." },
    { title: "CLÁUSULA 19ª – DA VIGÊNCIA", text: `Prazo indeterminado.` },
    { title: "CLÁUSULA 20ª – DO FORO", text: `Fica eleito o foro da comarca de ${data.contractCidadeForo || settings.cidade || "Barbacena"}/${data.contractEstadoForo || settings.estado || "MG"}.` },
    { title: "CLÁUSULA 21ª – DA VALIDADE DAS ASSINATURAS ELETRÔNICAS", text: "As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste contrato, conforme a Medida Provisória nº 2.200-2/2001 e o Código Civil Brasileiro, outorgando-lhe plena eficácia jurídica e executiva." },
  ];

  clauses.forEach((c) => {
    checkPage();
    addText(c.title, 10, true);
    addText(c.text, 10);
    y += 2;
  });

  y += 6;
  const signatureY = y;
  checkPage();
  if (y < signatureY) y = 20;

  addText("Assinaturas:", 11, true);
  y += 10;

  const currentY = y;
  // Patient Signature Left
  if (data.pacienteSignature) {
    try { doc.addImage(data.pacienteSignature, "PNG", margin, y, 45, 18); } catch {}
  }
  y += 20;
  doc.line(margin, y, margin + 70, y);
  doc.setFontSize(8);
  doc.text("CONTRATANTE", margin, y + 5);
  doc.text(data.pacienteNome, margin, y + 9);

  // Clinic Signature Right
  let rightY = currentY;
  if (data.profissionalSignature) {
    try { doc.addImage(data.profissionalSignature, "PNG", pageWidth - margin - 45, rightY, 45, 18); } catch {}
  }
  rightY += 20;
  doc.line(pageWidth - margin - 70, rightY, pageWidth - margin, rightY);
  doc.text("CONTRATADA", pageWidth - margin - 70, rightY + 5);
  doc.text(data.profissionalNome || settings.nome, pageWidth - margin - 70, rightY + 9);

  y = Math.max(y, rightY) + 10;

  // Witnesses
  if (data.witness1Name || data.witness2Name) {
    checkPage();
    addText("Testemunhas:", 11, true);
    y += 10;
    const witnessY = y;
    
    if (data.witness1Name) {
      doc.line(margin, y, margin + 70, y);
      doc.setFontSize(8);
      doc.text("1. ____________________________", margin, y + 5);
      doc.text(`Nome: ${data.witness1Name}`, margin, y + 9);
      if (data.witness1Cpf) doc.text(`CPF: ${data.witness1Cpf}`, margin, y + 13);
    }
    
    if (data.witness2Name) {
      const w2X = pageWidth - margin - 70;
      doc.line(w2X, witnessY, pageWidth - margin, witnessY);
      doc.setFontSize(8);
      doc.text("2. ____________________________", w2X, witnessY + 5);
      doc.text(`Nome: ${data.witness2Name}`, w2X, witnessY + 9);
      if (data.witness2Cpf) doc.text(`CPF: ${data.witness2Cpf}`, w2X, witnessY + 13);
    }
    y += 20;
  }

  y += 5;

  // Stamp if needed
  if (data.incluirCarimbo) {
    checkPage();
    await drawCarimbo(doc, pageWidth / 2, y, data.profissionalNome || settings.nome, data.profissionalRegistro || undefined, data.conselhoProfissional || undefined, data.rubricaNoCarimbo ? data.profissionalRubrica : undefined);
    y += 35;
  }

  // Verification QR Code
  if (data.contractId) {
    try {
      const verifyUrl = `${window.location.origin}/verificar-documento/${data.contractId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
      const qrSize = 25;
      const qrY = pageHeight - qrSize - 15;
      doc.addImage(qrDataUrl, "PNG", margin, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(`Código de Autenticidade: ${data.contractId.substring(0, 8).toUpperCase()}`, margin + qrSize + 5, qrY + 10);
      doc.text(`Verifique em: ${verifyUrl}`, margin + qrSize + 5, qrY + 15);
    } catch {}
  }

  // EXTRA PAGES
  // 1. Termo de Saúde
  doc.addPage(); y = 20;
  addText("TERMO DE SAÚDE E RESPONSABILIDADE DO PACIENTE", 14, true, "center");
  y += 10;
  addText("1. DECLARAÇÃO DE CONDIÇÃO DE SAÚDE", 11, true);
  addText("Declaro que fui orientado(a) a informar corretamente meu estado de saúde e afirmo que:", 10);
  addText("( ) Estou apto(a) para prática de exercícios físicos\n( ) Possuo restrições médicas (detalhar abaixo):", 10);
  doc.line(margin, y + 10, pageWidth - margin, y + 10); y += 15;
  doc.line(margin, y + 10, pageWidth - margin, y + 10); y += 15;

  addText("2. INFORMAÇÕES OBRIGATÓRIAS DE SAÚDE (Marque se possuir)", 11, true);
  const conditions = ["( ) Lesões atuais/antigas", "( ) Cirurgias prévias", "( ) Doenças cardiovasculares", "( ) Problemas ortopédicos", "( ) Gravidez/Pós-parto", "( ) Uso de medicamentos contínuos"];
  conditions.forEach(c => addText(c, 10));
  y += 6;

  addText("3. RESPONSABILIDADE E ISENÇÃO", 11, true);
  addText("O Pilates é uma atividade orientada, mas há riscos inerentes. A omissão de informações transfere a responsabilidade ao paciente. A clínica não se responsabiliza por lesões decorrentes de omissões ou descumprimento de orientações técnicas.", 10, false, "justify");
  y += 15;
  doc.line(margin, y, margin + 70, y);
  addText("Assinatura do Paciente", 9);

  // 2. Política Interna
  doc.addPage(); y = 20;
  addText("POLÍTICA INTERNA – PACIENTES", 14, true, "center");
  y += 10;
  const policies = [
    { t: "1. ORGANIZAÇÃO", d: "Aulas com horário agendado. Reserva exclusiva da vaga. Atrasos não prorrogam a aula." },
  { t: "2. FALTAS E REPOSIÇÕES", d: `Cancelamento com mín. ${data.contractPrazoCancelamentoH || 3}h de antecedência. Reposição em até ${data.contractPrazoReposicaoDias || 30} dias, conforme vaga disponível.` },
  { t: "3. PAGAMENTOS", d: `Mensalidade paga no primeiro dia de aula do mês. Atrasos incorrem em multa de ${data.contractMultaAtrasoPct || 2}% e juros de ${data.contractJurosMensalPct || 1}% ao mês.` },
    { t: "4. CONDUTA", d: "Respeito profissional. Vestimenta adequada. Proibido usar aparelhos sem orientação." },
    { t: "5. FERIADOS E RECESSOS", d: "Não há aulas em feriados e recessos. Não há reposição ou abatimento nesses períodos." }
  ];
  policies.forEach(p => {
    addText(p.t, 10, true);
    addText(p.d, 10);
    y += 2;
  });

  await addWatermarkToAllPages(doc, data.incluirRubrica ? { rubrica_url: data.profissionalRubrica } : undefined);
  return doc;
}
