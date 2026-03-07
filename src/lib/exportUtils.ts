import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Exporta dados para CSV e dispara o download
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  options?: { separator?: string; encoding?: "utf-8" | "utf-8-bom" }
): void {
  const { separator = ";", encoding = "utf-8-bom" } = options || {};
  
  // Escape function for CSV values
  const escapeCSV = (value: string | number): string => {
    const str = String(value);
    if (str.includes(separator) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV content
  const headerLine = headers.map(escapeCSV).join(separator);
  const dataLines = rows.map((row) => row.map(escapeCSV).join(separator));
  const csvContent = [headerLine, ...dataLines].join("\n");

  // Add BOM for Excel compatibility with UTF-8
  const BOM = encoding === "utf-8-bom" ? "\uFEFF" : "";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  // Trigger download
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formata valor monetario para exibicao
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata data para exibicao
 */
export function formatDate(
  date: string | Date,
  formatStr: string = "dd/MM/yyyy"
): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, formatStr, { locale: ptBR });
  } catch {
    return "-";
  }
}

/**
 * Formata data e hora para exibicao
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, "dd/MM/yyyy HH:mm");
}

/**
 * Prepara dados de agendamentos para exportacao
 */
export function prepareAgendamentosExport(agendamentos: any[]): {
  headers: string[];
  rows: string[][];
} {
  const headers = [
    "Data",
    "Horario",
    "Paciente",
    "Profissional",
    "Modalidade",
    "Tipo Sessao",
    "Status",
    "Valor",
  ];

  const rows = agendamentos.map((a) => [
    formatDate(a.data_horario),
    formatDate(a.data_horario, "HH:mm"),
    a.pacientes?.nome || a.paciente_nome || "-",
    a.profiles?.nome || a.profissional_nome || "-",
    a.tipo_atendimento || "-",
    a.tipo_sessao || "individual",
    a.status || "-",
    a.valor_sessao ? formatCurrency(Number(a.valor_sessao)) : "-",
  ]);

  return { headers, rows };
}

/**
 * Prepara dados de pacientes para exportacao
 */
export function preparePacientesExport(pacientes: any[]): {
  headers: string[];
  rows: string[][];
} {
  const headers = [
    "Nome",
    "CPF",
    "Telefone",
    "Email",
    "Data Nascimento",
    "Status",
    "Tipo Atendimento",
  ];

  const rows = pacientes.map((p) => [
    p.nome || "-",
    p.cpf || "-",
    p.telefone || "-",
    p.email || "-",
    p.data_nascimento ? formatDate(p.data_nascimento) : "-",
    p.status || "-",
    p.tipo_atendimento || "-",
  ]);

  return { headers, rows };
}

/**
 * Prepara dados de pagamentos para exportacao
 */
export function preparePagamentosExport(pagamentos: any[]): {
  headers: string[];
  rows: string[][];
} {
  const headers = [
    "Data Pagamento",
    "Paciente",
    "Valor",
    "Status",
    "Forma Pagamento",
    "Data Vencimento",
    "Referencia",
  ];

  const rows = pagamentos.map((p) => [
    p.data_pagamento ? formatDate(p.data_pagamento) : "-",
    p.pacientes?.nome || p.paciente_nome || "-",
    formatCurrency(Number(p.valor || 0)),
    p.status || "-",
    p.forma_pagamento || "-",
    p.data_vencimento ? formatDate(p.data_vencimento) : "-",
    p.referencia || "-",
  ]);

  return { headers, rows };
}

/**
 * Prepara dados de comissoes para exportacao
 */
export function prepareComissoesExport(comissoes: any[]): {
  headers: string[];
  rows: string[][];
} {
  const headers = [
    "Profissional",
    "Periodo",
    "Atendimentos",
    "Valor Bruto",
    "Taxa Comissao",
    "Valor Comissao",
  ];

  const rows = comissoes.map((c) => [
    c.profissional_nome || "-",
    c.periodo || "-",
    String(c.atendimentos || 0),
    formatCurrency(Number(c.valor_bruto || 0)),
    `${c.taxa_comissao || 0}%`,
    formatCurrency(Number(c.valor_comissao || 0)),
  ]);

  return { headers, rows };
}

/**
 * Gera nome de arquivo com timestamp
 */
export function generateFilename(baseName: string): string {
  const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm");
  return `${baseName}_${timestamp}`;
}
