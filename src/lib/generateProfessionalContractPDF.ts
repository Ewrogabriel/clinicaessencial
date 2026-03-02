import jsPDF from "jspdf";

interface ProfessionalContractData {
  profissionalNome: string;
  registroProfissional: string;
  tipoContratacao: string;
  cnpj: string;
  commissionRate: number;
}

export function generateProfessionalContractPDF(data: ProfessionalContractData) {
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
  addText("ESSENCIAL FISIO PILATES", 16, true, "center");
  addText("CNPJ: 61.080.977/0001-50", 9, false, "center");
  y += 4;
  addText("CONTRATO DE PRESTACAO DE SERVICOS PROFISSIONAIS", 13, true, "center");
  y += 6;

  // Intro
  addText("Pelo presente instrumento particular, de um lado:", 10);
  y += 2;

  addText(
    'CLINICA: Essencial Fisio Pilates, pessoa juridica de direito privado, com sede a Rua Capitao Antonio Ferreira Campos, n 46 - Bairro Carmo - Barbacena/MG, telefone/WhatsApp (32) 98415-2802, doravante denominada CLINICA.',
    10
  );
  y += 4;

  addText("E, de outro lado:", 10);
  y += 2;

  const tipoLabel =
    data.tipoContratacao === "clt"
      ? "CLT"
      : data.tipoContratacao === "mei"
      ? "MEI"
      : data.tipoContratacao === "pj"
      ? "Pessoa Juridica"
      : "Autonomo";

  addText(
    `PROFISSIONAL: ${data.profissionalNome}, Registro Profissional: ${data.registroProfissional || "_______________"}, atuando como ${tipoLabel}${data.tipoContratacao === "pj" && data.cnpj ? ` - CNPJ n ${data.cnpj}` : ""}, doravante denominado PROFISSIONAL.`,
    10,
    true
  );
  y += 4;

  addText("As partes resolvem firmar o presente contrato, que se regera pelas clausulas seguintes:", 10);
  y += 6;

  // CLAUSULA 1
  checkPage();
  addText("CLAUSULA 1a - DO OBJETO", 10, true);
  addText(
    "O presente contrato tem por objeto a prestacao de servicos profissionais na area de Fisioterapia/Pilates pelo PROFISSIONAL, nas dependencias da CLINICA, conforme horarios e condicoes previamente acordados.",
    10
  );
  y += 4;

  // CLAUSULA 2
  checkPage();
  addText("CLAUSULA 2a - DA NATUREZA JURIDICA", 10, true);
  addText(
    "Paragrafo 1. O presente instrumento possui natureza estritamente civil, inexistindo vinculo empregaticio, subordinacao juridica, pessoalidade ou habitualidade nos termos da legislacao trabalhista.",
    10
  );
  addText("Paragrafo 2. O PROFISSIONAL atuara com autonomia tecnica, sendo responsavel pelos atendimentos realizados.", 10);
  y += 2;
  addText("Paragrafo 3. O PROFISSIONAL declara atuar como:", 10);
  y += 2;

  const opcoes = [
    { label: "Autonomo", checked: data.tipoContratacao === "autonomo" },
    { label: "MEI", checked: data.tipoContratacao === "mei" },
    { label: `Pessoa Juridica - CNPJ n ${data.cnpj || "______________________"}`, checked: data.tipoContratacao === "pj" },
    { label: "CLT", checked: data.tipoContratacao === "clt" },
  ];
  opcoes.forEach((o) => {
    addText(`(${o.checked ? "X" : " "}) ${o.label}`, 10);
  });
  y += 4;

  // CLAUSULA 3
  checkPage();
  addText("CLAUSULA 3a - DA REMUNERACAO", 10, true);
  addText(
    `Paragrafo 1. O PROFISSIONAL recebera comissao correspondente a ${data.commissionRate}% (${data.commissionRate} por cento) sobre os valores efetivamente pagos pelos pacientes a CLINICA, relativos a consultas, aulas avulsas ou mensalidades.`,
    10
  );
  addText("Paragrafo 2. A comissao incidira exclusivamente sobre valores efetivamente recebidos e compensados.", 10);
  addText("Paragrafo 3. O pagamento sera realizado ate o dia 10 do mes subsequente, mediante demonstrativo financeiro.", 10);
  addText("Paragrafo 4. Em caso de inadimplencia do paciente, a comissao somente sera devida apos a quitacao.", 10);
  addText("Paragrafo 5. Nao havera pagamento de comissao sobre descontos concedidos, cortesias ou valores nao recebidos.", 10);
  y += 4;

  // CLAUSULA 4
  checkPage();
  addText("CLAUSULA 4a - DAS OBRIGACOES DO PROFISSIONAL", 10, true);
  const obrigacoes = [
    "I - Realizar atendimentos com etica, zelo e observancia as normas tecnicas;",
    "II - Manter registro profissional regular;",
    "III - Zelar pelos equipamentos e estrutura da CLINICA;",
    "IV - Cumprir horarios previamente agendados;",
    "V - Manter sigilo sobre informacoes comerciais e clinicas;",
    "VI - Cumprir integralmente a legislacao vigente, inclusive sanitaria e profissional.",
  ];
  obrigacoes.forEach((o) => addText(o, 10));
  y += 4;

  // CLAUSULA 5
  checkPage();
  addText("CLAUSULA 5a - DAS OBRIGACOES DA CLINICA", 10, true);
  const obrigacoesClinica = [
    "I - Disponibilizar espaco fisico adequado e equipamentos;",
    "II - Realizar a cobranca dos pacientes;",
    "III - Fornecer relatorio mensal para conferencia;",
    "IV - Efetuar o pagamento da comissao conforme pactuado.",
  ];
  obrigacoesClinica.forEach((o) => addText(o, 10));
  y += 4;

  // CLAUSULA 6
  checkPage();
  addText("CLAUSULA 6a - DA NAO CAPTACAO E NAO DESVIO DE PACIENTES", 10, true);
  addText("Paragrafo 1. O PROFISSIONAL compromete-se a nao captar, aliciar ou desviar pacientes da CLINICA para atendimento particular ou em outro estabelecimento.", 10);
  addText("Paragrafo 2. A vedacao aplica-se durante a vigencia do contrato e por 12 (doze) meses apos sua rescisao.", 10);
  addText("Paragrafo 3. Considera-se infracao qualquer forma de incentivo, convite, oferta de atendimento externo ou fornecimento de contato para fins particulares.", 10);
  addText("Paragrafo 4. O descumprimento sujeitara o PROFISSIONAL ao pagamento de multa equivalente a 10 (dez) vezes o valor medio da mensalidade por paciente desviado, sem prejuizo de perdas e danos.", 10);
  y += 4;

  // CLAUSULA 7
  checkPage();
  addText("CLAUSULA 7a - DA CONFIDENCIALIDADE E LGPD", 10, true);
  addText("Paragrafo 1. O PROFISSIONAL obriga-se a manter absoluto sigilo sobre:", 10);
  const sigiloItens = [
    "- Dados pessoais e sensiveis de pacientes",
    "- Prontuarios e informacoes clinicas",
    "- Lista de pacientes",
    "- Valores, estrategias e dados financeiros",
  ];
  sigiloItens.forEach((s) => addText(s, 10));
  y += 2;
  addText("Paragrafo 2. O tratamento de dados devera observar a Lei n 13.709/2018 (Lei Geral de Protecao de Dados - LGPD).", 10);
  addText("Paragrafo 3. E vedado:", 10);
  addText("I - Compartilhar dados por meios nao seguros;", 10);
  addText("II - Utilizar dados para fins particulares;", 10);
  addText("III - Manter copia de prontuarios apos o termino do contrato.", 10);
  addText("Paragrafo 4. O dever de confidencialidade permanece por prazo indeterminado.", 10);
  addText("Paragrafo 5. O descumprimento implicara multa, sem prejuizo das medidas judiciais cabiveis.", 10);
  y += 4;

  // CLAUSULA 8
  checkPage();
  addText("CLAUSULA 8a - DA RESPONSABILIDADE TECNICA", 10, true);
  addText("O PROFISSIONAL e responsavel tecnico pelos atendimentos realizados, respondendo civil, etica e administrativamente por sua conduta.", 10);
  y += 4;

  // CLAUSULA 9
  checkPage();
  addText("CLAUSULA 9a - DA RESCISAO", 10, true);
  addText("O contrato podera ser rescindido por qualquer das partes mediante aviso previo de 30 (trinta) dias, por escrito.", 10);
  addText("Paragrafo unico: As comissoes ja apuradas deverao ser quitadas normalmente.", 10);
  y += 4;

  // CLAUSULA 10
  checkPage();
  addText("CLAUSULA 10a - DO PRAZO", 10, true);
  addText("O presente contrato vigorara por prazo indeterminado, iniciando-se em ___/___/______.", 10);
  y += 4;

  // CLAUSULA 11
  checkPage();
  addText("CLAUSULA 11a - DO FORO", 10, true);
  addText("Fica eleito o foro da comarca de Barbacena/MG, com renuncia a qualquer outro.", 10);
  y += 8;

  // Date and signatures
  checkPage();
  const hoje = new Date();
  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  addText(`Barbacena/MG, ____ de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, 10);
  y += 12;

  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("CLINICA - Essencial Fisio Pilates", 9);
  y += 10;

  checkPage();
  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText(`PROFISSIONAL - ${data.profissionalNome}`, 9);
  if (data.registroProfissional) {
    addText(`Registro: ${data.registroProfissional}`, 9);
  }

  return doc;
}
