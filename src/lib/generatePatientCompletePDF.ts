import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addWatermarkToAllPages } from "./pdfLogo";

interface PatientPDFData {
  paciente: any;
  avaliacao?: any;
  evolucoes?: any[];
  agendamentos?: any[];
  pagamentos?: any[];
  anexos?: any[];
}

export const generatePatientCompletePDF = async (data: PatientPDFData) => {
  const doc = new jsPDF();
  const { paciente, avaliacao, evolucoes = [], agendamentos = [], pagamentos = [], anexos = [] } = data;
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Ficha Completa do Paciente", 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, y);
  y += 12;

  // Dados Pessoais
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("1. Dados Pessoais", 14, y);
  y += 6;
  
  const personalData = [
    ["Nome", paciente.nome || "—"],
    ["CPF", paciente.cpf || "—"],
    ["Telefone", paciente.telefone || "—"],
    ["Email", paciente.email || "—"],
    ["Data Nasc.", paciente.data_nascimento ? format(new Date(paciente.data_nascimento), "dd/MM/yyyy") : "—"],
    ["Tipo Atend.", paciente.tipo_atendimento || "—"],
    ["Status", paciente.status || "—"],
    ["Sexo", paciente.sexo || "—"],
    ["Endereço", paciente.endereco || "—"],
    ["Convênio", paciente.convenio || "—"],
    ["Observações", paciente.observacoes || "—"],
  ];

  autoTable(doc, {
    startY: y,
    body: personalData,
    theme: "grid",
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Responsável Legal
  if (paciente.tem_responsavel_legal) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("2. Responsável Legal", 14, y);
    y += 6;
    const respData = [
      ["Nome", paciente.responsavel_nome || "—"],
      ["Parentesco", paciente.responsavel_parentesco || "—"],
      ["CPF", paciente.responsavel_cpf || "—"],
      ["Telefone", paciente.responsavel_telefone || "—"],
      ["Email", paciente.responsavel_email || "—"],
    ];
    autoTable(doc, {
      startY: y,
      body: respData,
      theme: "grid",
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Avaliação Clínica
  const secNum = paciente.tem_responsavel_legal ? 3 : 2;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  if (y > 260) { doc.addPage(); y = 20; }
  doc.text(`${secNum}. Avaliação Clínica`, 14, y);
  y += 6;

  if (avaliacao) {
    const evalData = [
      ["Queixa Principal", avaliacao.queixa_principal || "—"],
      ["Histórico (HDA)", avaliacao.historico_doenca || "—"],
      ["Antecedentes", avaliacao.antecedentes_pessoais || "—"],
      ["Objetivos", avaliacao.objetivos_tratamento || "—"],
      ["Conduta Inicial", avaliacao.conduta_inicial || "—"],
      ["Data", avaliacao.data_avaliacao ? format(new Date(avaliacao.data_avaliacao), "dd/MM/yyyy") : "—"],
    ];
    autoTable(doc, {
      startY: y,
      body: evalData,
      theme: "grid",
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Nenhuma avaliação clínica registrada.", 14, y);
    y += 10;
  }

  // Evoluções
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${secNum + 1}. Evoluções Clínicas (${evolucoes.length})`, 14, y);
  y += 6;

  if (evolucoes.length > 0) {
    const evolData = evolucoes.map((e) => [
      e.data_evolucao ? format(new Date(e.data_evolucao), "dd/MM/yyyy") : "—",
      e.profissional_nome || "—",
      (e.descricao || "").substring(0, 120) + ((e.descricao || "").length > 120 ? "..." : ""),
      (e.conduta || "—").substring(0, 80),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Profissional", "Descrição", "Conduta"]],
      body: evolData,
      theme: "striped",
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Sem evoluções registradas.", 14, y);
    y += 10;
  }

  // Histórico de Sessões
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${secNum + 2}. Histórico de Sessões (${agendamentos.length})`, 14, y);
  y += 6;

  if (agendamentos.length > 0) {
    const sessData = agendamentos.slice(0, 50).map((a) => [
      a.data_horario ? format(new Date(a.data_horario), "dd/MM/yyyy HH:mm") : "—",
      a.tipo_atendimento || "—",
      a.status || "—",
      a.duracao_minutos ? `${a.duracao_minutos}min` : "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Data/Hora", "Tipo", "Status", "Duração"]],
      body: sessData,
      theme: "striped",
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Sem sessões registradas.", 14, y);
    y += 10;
  }

  // Pagamentos
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${secNum + 3}. Pagamentos (${pagamentos.length})`, 14, y);
  y += 6;

  if (pagamentos.length > 0) {
    const pagData = pagamentos.slice(0, 30).map((p) => [
      p.data_vencimento ? format(new Date(p.data_vencimento), "dd/MM/yyyy") : "—",
      `R$ ${Number(p.valor || 0).toFixed(2)}`,
      p.status || "—",
      p.forma_pagamento || "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Vencimento", "Valor", "Status", "Forma"]],
      body: pagData,
      theme: "striped",
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Anexos
  if (anexos.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`${secNum + 4}. Documentos Anexos (${anexos.length})`, 14, y);
    y += 6;
    const anexData = anexos.map((a) => [
      a.nome || a.file_name || "—",
      a.created_at ? format(new Date(a.created_at), "dd/MM/yyyy") : "—",
      a.tipo || "documento",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Nome", "Data", "Tipo"]],
      body: anexData,
      theme: "striped",
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  await addWatermarkToAllPages(doc);
  return doc;
};

export const downloadPatientCompletePDF = async (data: PatientPDFData) => {
  const doc = await generatePatientCompletePDF(data);
  const nome = (data.paciente.nome || "paciente").replace(/\s+/g, "_");
  doc.save(`ficha_completa_${nome}.pdf`);
};
