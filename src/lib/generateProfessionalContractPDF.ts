import jsPDF from "jspdf";
import { addLogoToPDF, getClinicSettings, formatClinicAddress, addWatermarkToAllPages } from "./pdfLogo";

interface ProfessionalContractData {
  profissionalNome: string;
  registroProfissional: string;
  tipoContratacao: string;
  cnpj: string;
  commissionRate: number;
  cpf?: string;
  rg?: string;
  endereco?: string;
  estadoCivil?: string;
  telefone?: string;
  conselhoProfissional?: string;
  dataInicio?: string;
  diaPagamento?: number;
  raioNaoConcorrencia?: number;
  multaNaoCaptacaoFator?: number;
  multaNaoCaptacaoValor?: number;
  prazoAvisoPrevio?: number;
  multaUsoMarca?: number;
  valorSessaoFixo?: number;
  witness1Name?: string;
  witness1Cpf?: string;
  witness2Name?: string;
  witness2Cpf?: string;
}

export async function generateProfessionalContractPDF(data: ProfessionalContractData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
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
    if (y > 270) { doc.addPage(); y = 20; }
  };

  // Logo
  const logoX = pageWidth / 2 - 15;
  y = await addLogoToPDF(doc, logoX, y, 30, 25);
  y += 2;

  // Header
  addText(settings.nome.toUpperCase(), 16, true, "center");
  addText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS – PILATES", 13, true, "center");
  y += 6;

  // Parties
  addText("CONTRATANTE:", 11, true);
  const clinicAddress = formatClinicAddress(settings);
  addText(`${settings.nome}, com sede à ${clinicAddress}${settings.telefone ? `, telefone ${settings.telefone}` : ""}, doravante denominada CLÍNICA.`, 10);
  y += 2;

  addText("CONTRATADO(A):", 11, true);
  const profParts = [
    `Nome: ${data.profissionalNome}`,
    `CPF: ${data.cpf || "_______________"}`,
    `RG: ${data.rg || "_______________"}`,
    data.registroProfissional ? `${data.conselhoProfissional || "REGISTRO"}: ${data.registroProfissional}` : "REGISTRO: _______________",
    data.endereco ? `Endereço: ${data.endereco}` : "Endereço: _______________",
    `, doravante denominado(a) PROFISSIONAL.`
  ].join(" | ");
  addText(profParts, 10);
  y += 4;

  const clauses = [
    { title: "CLÁUSULA 1ª – DO OBJETO", text: "Prestação de serviços profissionais de Pilates e/ou atendimentos correlatos nas dependências da CLÍNICA ou em local por ela indicado." },
    { title: "CLÁUSULA 2ª – DA NATUREZA JURÍDICA", text: `§1º Este contrato possui natureza civil/autônoma, não gerando vínculo empregatício.\n§2º Não há subordinação jurídica, controle de jornada ou exclusividade obrigatória, salvo previsão expressa.\n§3º O PROFISSIONAL declara atuar como: (${data.tipoContratacao === "autonomo" ? "X" : " "}) Autônomo | (${data.tipoContratacao === "mei" ? "X" : " "}) MEI | (${data.tipoContratacao === "pj" ? "X" : " "}) Pessoa Jurídica${data.cnpj ? ` – CNPJ nº ${data.cnpj}` : ""}` },
    { title: "CLÁUSULA 3ª – DA REMUNERAÇÃO (COMISSÃO)", text: `§1º O PROFISSIONAL receberá ${data.commissionRate}% sobre os valores efetivamente pagos pelos pacientes.\n§2º A comissão incidirá sobre: Mensalidades, Sessões avulsas e Pacotes efetivamente quitados.\n§3º Não incide comissão sobre: Cortesias, Descontos, Valores inadimplentes e Taxas administrativas.\n§4º O pagamento será realizado até o dia ${data.diaPagamento || 10} do mês seguinte.\n§5º A CLÍNICA poderá reter valores em caso de: Estorno, Chargeback ou Reembolso ao paciente.` },
    { title: "CLÁUSULA 4ª – DA ORGANIZAÇÃO DOS ATENDIMENTOS", text: "§1º A agenda será organizada em conjunto.\n§2º O atendimento deve respeitar padrões da clínica.\n§3º Atrasos recorrentes poderão gerar advertência ou rescisão." },
    { title: "CLÁUSULA 5ª – DAS OBRIGAÇÕES DO PROFISSIONAL", text: "I – Atuar com ética e técnica;\nII – Manter registro profissional regular;\nIII – Seguir protocolos da clínica;\nIV – Zelar por equipamentos;\nV – Não prestar orientações fora de sua competência;\nVI – Utilizar uniforme/padrão quando exigido;\nVII – Cumprir LGPD e sigilo absoluto." },
    { title: "CLÁUSULA 6ª – DAS OBRIGAÇÕES DA CLÍNICA", text: "I – Disponibilizar estrutura e equipamentos;\nII – Realizar cobrança dos pacientes;\nIII – Fornecer demonstrativo financeiro;\nIV – Efetuar pagamento da comissão." },
    { title: "CLÁUSULA 7ª – DA NÃO CAPTAÇÃO DE PACIENTES", text: `§1º É proibido captar ou desviar pacientes.\n§2º Vigência: durante o contrato e até 12 meses após saída.\n§3º Inclui: Oferecer atendimento particular, Passar contato pessoal com finalidade profissional e Levar paciente para outro local.\n§4º Multa: ${data.multaNaoCaptacaoValor ? `R$ ${data.multaNaoCaptacaoValor.toFixed(2)}` : `${data.multaNaoCaptacaoFator || 10}x valor médio da mensalidade`} por paciente desviado, podendo acumular.` },
    { title: "CLÁUSULA 8ª – DA NÃO CONCORRÊNCIA", text: `§1º O PROFISSIONAL não poderá atuar em clínica concorrente no raio de ${data.raioNaoConcorrencia || 5} km durante a vigência do contrato.` },
    { title: "CLÁUSULA 9ª – CONFIDENCIALIDADE E LGPD", text: `§1º O PROFISSIONAL compromete-se a proteger: Dados pessoais e sensíveis, Prontuários, Lista de pacientes, Dados financeiros e estratégicos.\n§2º Deverá cumprir a Lei nº 13.709/2018 (LGPD).\n§3º É proibido: Tirar fotos de prontuários, Compartilhar dados via WhatsApp pessoal sem segurança e Armazenar dados sem proteção.\n§4º Vazamento gera responsabilidade civil.\n§5º Sigilo é vitalício (mesmo após saída).\n§6º Multa: R$ ${(data.multaUsoMarca || 5000).toFixed(2)} + perdas e danos.` },
    { title: "CLÁUSULA 10ª – DO USO DA MARCA E IMAGEM", text: "§1º O PROFISSIONAL não pode usar a marca da clínica sem autorização.\n§2º Não pode divulgar pacientes ou atendimentos sem consentimento.\n§3º Autoriza a clínica a usar sua imagem institucionalmente." },
    { title: "CLÁUSULA 11ª – DOS DANOS E RESPONSABILIDADES", text: "§1º Danos causados por negligência serão de responsabilidade do PROFISSIONAL.\n§2º Danos a equipamentos poderão ser cobrados." },
    { title: "CLÁUSULA 12ª – DAS FALTAS E CANCELAMENTOS", text: "§1º Comissão só é devida sobre atendimento realizado e pago.\n§2º Falta do profissional sem aviso pode gerar penalidade.\n§3º Reposição segue regras da clínica." },
    { title: "CLÁUSULA 13ª – DA AUDITORIA E CONTROLE", text: "A CLÍNICA poderá auditar atendimentos, agenda e registros para conferência de comissões." },
    { title: "CLÁUSULA 14ª – DA RESCISÃO", text: `§1º Aviso prévio: ${data.prazoAvisoPrevio || 30} dias.\n§2º Rescisão imediata em caso de: Quebra de sigilo, Desvio de pacientes ou Conduta antiética.` },
    { title: "CLÁUSULA 15ª – DAS PENALIDADES", text: "Podem ser aplicadas: Advertência, Suspensão, Multa ou Rescisão." },
    { title: "CLÁUSULA 16ª – DO PRAZO", text: `Prazo indeterminado, iniciando em ${data.dataInicio || new Date().toLocaleDateString("pt-BR")}.` },
    { title: "CLÁUSULA 17ª – DO FORO", text: `Foro de ${settings.cidade || "Barbacena"}/${settings.estado || "MG"}.` },
    { title: "CLÁUSULA 18ª – DA VALIDADE DAS ASSINATURAS ELETRÔNICAS", text: "As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste contrato, conforme a Medida Provisória nº 2.200-2/2001 e o Código Civil Brasileiro, outorgando-lhe plena eficácia jurídica e executiva." },
  ];

  clauses.forEach(c => {
    checkPage();
    addText(c.title, 10, true);
    addText(c.text, 10);
    y += 2;
  });

  y += 10;
  addText("Assinaturas:", 10, true);
  y += 12;

  checkPage();
  doc.line(margin, y, margin + 70, y);
  addText("CLÍNICA", 9);
  addText(settings.nome, 8);
  y += 12;

  checkPage();
  doc.line(margin, y, margin + 70, y);
  addText("PROFISSIONAL", 9);
  addText(data.profissionalNome, 8);

  // Witnesses
  if (data.witness1Name || data.witness2Name) {
    y += 10;
    checkPage();
    addText("Testemunhas:", 10, true);
    y += 10;
    const witnessY = y;

    if (data.witness1Name) {
      doc.line(margin, y, margin + 70, y);
      doc.text("1. ____________________________", margin, y + 5);
      doc.text(`Nome: ${data.witness1Name}`, margin, y + 9);
      if (data.witness1Cpf) doc.text(`CPF: ${data.witness1Cpf}`, margin, y + 12);
    }

    if (data.witness2Name) {
      const w2X = pageWidth - margin - 70;
      doc.line(w2X, witnessY, pageWidth - margin, witnessY);
      doc.text("2. ____________________________", w2X, witnessY + 5);
      doc.text(`Nome: ${data.witness2Name}`, w2X, witnessY + 9);
      if (data.witness2Cpf) doc.text(`CPF: ${data.witness2Cpf}`, w2X, witnessY + 12);
    }
  }

  // EXTRA PAGE: Política Interna Profissional
  doc.addPage(); y = 20;
  addText("POLÍTICA INTERNA – PROFISSIONAIS", 14, true, "center");
  y += 10;
  const profPolicies = [
    { t: "1. CONDUTA", d: "Ética e respeito. Seguir protocolos técnicos. Postura profissional irrepreensível." },
    { t: "2. CONFIDENCIALIDADE", d: "Proibido compartilhar dados, fotografar prontuários ou usar dados fora da clínica." },
    { t: "3. RELACIONAMENTO", d: "Vedado atendimento particular de pacientes da clínica ou desvio para outros locais." },
    { t: "4. ESTRUTURA", d: "Zelo absoluto pelos equipamentos. Notificar danos imediatamente." },
    { t: "5. AGENDA", d: "Cumprimento rigoroso de horários. Aviso prévio obrigatório para ausências." },
    { t: "6. LGPD", d: "Tratamento de dados com sigilo absoluto. Não armazenar dados em dispositivos pessoais." }
  ];
  profPolicies.forEach(p => {
    addText(p.t, 10, true);
    addText(p.d, 10);
    y += 2;
  });

  await addWatermarkToAllPages(doc);
  return doc;
}
