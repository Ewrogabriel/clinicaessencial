import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileJson } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface PacienteExport {
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  tipo_atendimento?: string | null;
  status?: string | null;
  data_nascimento?: string | null;
}

interface Props {
  pacientes: PacienteExport[];
  disabled?: boolean;
}

function downloadFile(content: string | Blob, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: any): string {
  const s = v == null ? "" : String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function PacientesExportButton({ pacientes, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const date = new Date().toISOString().slice(0, 10);

  const headers = ["Nome", "CPF", "Telefone", "E-mail", "Tipo", "Status", "Nascimento"];
  const rows = () =>
    pacientes.map((p) => [
      p.nome ?? "",
      p.cpf ?? "",
      p.telefone ?? "",
      p.email ?? "",
      p.tipo_atendimento ?? "",
      p.status ?? "",
      p.data_nascimento ?? "",
    ]);

  const exportCsv = () => {
    setBusy(true);
    try {
      const csv =
        headers.join(",") +
        "\n" +
        rows()
          .map((r) => r.map(escapeCsv).join(","))
          .join("\n");
      downloadFile("\uFEFF" + csv, `pacientes-${date}.csv`, "text/csv;charset=utf-8;");
      toast.success("Exportação concluída", { description: `${pacientes.length} pacientes em CSV` });
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () => {
    setBusy(true);
    try {
      // Excel-friendly UTF-8 CSV with semicolon separator (PT-BR Excel default)
      const sep = ";";
      const csv =
        headers.join(sep) +
        "\n" +
        rows()
          .map((r) =>
            r.map((v) => {
              const s = v == null ? "" : String(v);
              return s.includes(sep) || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"`
                : s;
            }).join(sep)
          )
          .join("\n");
      downloadFile("\uFEFF" + csv, `pacientes-${date}.xls.csv`, "text/csv;charset=utf-8;");
      toast.success("Exportação concluída", { description: `${pacientes.length} pacientes em Excel` });
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    setBusy(true);
    try {
      downloadFile(
        JSON.stringify(pacientes, null, 2),
        `pacientes-${date}.json`,
        "application/json"
      );
      toast.success("Exportação concluída", { description: `${pacientes.length} pacientes em JSON` });
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = () => {
    setBusy(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Lista de Pacientes", 14, 14);
      doc.setFontSize(10);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} • ${pacientes.length} registros`, 14, 20);
      autoTable(doc, {
        head: [headers],
        body: rows(),
        startY: 26,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
      });
      doc.save(`pacientes-${date}.pdf`);
      toast.success("Exportação concluída", { description: `${pacientes.length} pacientes em PDF` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled || busy || pacientes.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCsv}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJson}>
          <FileJson className="h-4 w-4 mr-2" /> JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
